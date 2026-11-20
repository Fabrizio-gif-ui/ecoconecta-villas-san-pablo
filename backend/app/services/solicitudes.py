from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.security import get_coordinator_flow
from app.models.entities import (
    Beneficio,
    CanjeBeneficio,
    EstadoSolicitud,
    HistorialEstado,
    IntegranteColectivo,
    MensajeCoordinacion,
    MovimientoPuntos,
    RegistroRecoleccion,
    ReglaPuntos,
    RolUsuario,
    Solicitud,
    Usuario,
)
from app.schemas.schemas import (
    BeneficioOut,
    CambiarEstadoRequest,
    CanjeOut,
    ExtraccionSolicitudWA,
    HistorialEstadoOut,
    HistorialPublicoOut,
    MensajeCreate,
    MensajeOut,
    MiResumenPuntosOut,
    MovimientoPuntosOut,
    PanelRecolectoresPuntosOut,
    ProgramarSolicitudRequest,
    ProgresoNivelOut,
    ReclasificarFlujoRequest,
    RegistroRecoleccionCreate,
    RegistroRecoleccionOut,
    ResumenPuntosRecolectorOut,
    SolicitudCiudadanoOut,
    SolicitudCoordinadorOut,
    SolicitudCreate,
    SolicitudPublicaTrackOut,
)
from app.services.whatsapp import whatsapp_service

TWO_DECIMALS = Decimal("0.01")
LB_TO_KG_FACTOR = Decimal("0.50")  # En Colombia 1 libra = 500 g = 0.50 kg


def quantize_2(value: Decimal | float | int) -> Decimal:
    return Decimal(str(value)).quantize(TWO_DECIMALS, rounding=ROUND_HALF_UP)


def coordinator_role_for_flow(flujo: str) -> str:
    return (
        RolUsuario.COORDINADOR_HUERTEROS.value
        if flujo == "organico"
        else RolUsuario.COORDINADOR_RECICLADORES.value
    )


def coordinator_label_for_flow(flujo: str) -> str:
    return (
        "Coordinación de Huerteros (Orgánicos)"
        if flujo == "organico"
        else "Coordinación de Recicladores (Reciclables)"
    )


def generate_unique_code(db: Session) -> str:
    """RN-04: Código único trazable tipo ECO-2026-0001."""
    year = datetime.now(timezone.utc).year
    prefix = f"ECO-{year}-"
    existing_codes = db.scalars(
        select(Solicitud.codigo).where(Solicitud.codigo.like(f"{prefix}%"))
    ).all()
    max_seq = 0
    for code in existing_codes:
        parts = code.split("-")
        if len(parts) == 3 and parts[2].isdigit():
            max_seq = max(max_seq, int(parts[2]))
    return f"{prefix}{max_seq + 1:04d}"


def get_default_coordinator(db: Session, flujo: str) -> Optional[Usuario]:
    rol = coordinator_role_for_flow(flujo)
    return db.scalar(
        select(Usuario)
        .where(Usuario.rol == rol, Usuario.activo.is_(True))
        .order_by(Usuario.id.asc())
        .limit(1)
    )


def get_user_points_balance(db: Session, user_id: int) -> Decimal:
    """Saldo disponible del usuario solicitante (créditos menos canjes)."""
    total = db.scalar(
        select(func.coalesce(func.sum(MovimientoPuntos.puntos), Decimal("0.00"))).where(
            MovimientoPuntos.tipo_destinatario == "usuario",
            MovimientoPuntos.usuario_id == user_id,
        )
    )
    return quantize_2(total or Decimal("0.00"))


def get_user_points_total(db: Session, user_id: int) -> float:
    return float(get_user_points_balance(db, user_id))


def get_collector_points_balance(db: Session, integrante_id: int) -> Decimal:
    """Saldo disponible del recolector/huertero (créditos menos canjes)."""
    total = db.scalar(
        select(func.coalesce(func.sum(MovimientoPuntos.puntos), Decimal("0.00"))).where(
            MovimientoPuntos.tipo_destinatario == "recolector",
            MovimientoPuntos.integrante_colectivo_id == integrante_id,
        )
    )
    return quantize_2(total or Decimal("0.00"))


def assert_coordinator_flow_access(user: Usuario, solicitud: Solicitud) -> None:
    """RN-01: Un coordinador jamás ve ni opera solicitudes del otro flujo."""
    allowed_flow = get_coordinator_flow(user)
    if allowed_flow is not None and solicitud.flujo != allowed_flow:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "RN-01: No tienes permiso para acceder a solicitudes de otro flujo "
                f"(tu flujo asignado es '{allowed_flow}')."
            ),
        )


def assert_can_view_solicitud(user: Usuario, solicitud: Solicitud) -> None:
    if user.rol == RolUsuario.ADMINISTRADOR.value:
        return
    if user.rol in (
        RolUsuario.COORDINADOR_HUERTEROS.value,
        RolUsuario.COORDINADOR_RECICLADORES.value,
    ):
        assert_coordinator_flow_access(user, solicitud)
        return
    if solicitud.usuario_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes consultar tus propias solicitudes.",
        )


def _validate_encargado(
    db: Session, flujo: str, encargado_id: Optional[int], nombre_encargado: Optional[str]
) -> tuple[Optional[int], Optional[str]]:
    if encargado_id is None:
        return None, nombre_encargado.strip() if nombre_encargado else None

    integrante = db.get(IntegranteColectivo, encargado_id)
    if not integrante or not integrante.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El integrante del colectivo seleccionado no existe o está inactivo.",
        )
    if integrante.flujo != flujo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"El integrante seleccionado pertenece al flujo '{integrante.flujo}', "
                f"no al flujo '{flujo}'."
            ),
        )
    final_name = nombre_encargado.strip() if nombre_encargado else integrante.nombre
    return integrante.id, final_name


def _resolve_or_create_encargado(
    db: Session,
    flujo: str,
    coordinator: Usuario,
    encargado_id: Optional[int],
    nombre_encargado: str,
) -> IntegranteColectivo:
    """Resuelve el integrante del colectivo para acreditación dual (RN-05)."""
    cleaned_name = nombre_encargado.strip()
    if encargado_id is not None:
        integrante = db.get(IntegranteColectivo, encargado_id)
        if not integrante or not integrante.activo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El integrante del colectivo seleccionado no existe o está inactivo.",
            )
        if integrante.flujo != flujo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"El integrante seleccionado pertenece al flujo '{integrante.flujo}', "
                    f"no al flujo '{flujo}'."
                ),
            )
        return integrante

    existing = db.scalar(
        select(IntegranteColectivo).where(
            IntegranteColectivo.flujo == flujo,
            func.lower(IntegranteColectivo.nombre) == cleaned_name.lower(),
        )
    )
    if existing:
        if not existing.activo:
            existing.activo = True
        return existing

    rol_default = (
        "Huertero comunitario" if flujo == "organico" else "Reciclador de oficio"
    )
    nuevo = IntegranteColectivo(
        nombre=cleaned_name,
        flujo=flujo,
        rol_interno=rol_default,
        zona_cobertura="Villas de San Pablo",
        coordinador_id=coordinator.id,
        activo=True,
    )
    db.add(nuevo)
    db.flush()
    return nuevo


def normalize_weight_to_kg(peso_ingresado: Decimal, unidad_medida: str) -> Decimal:
    """Convierte el peso ingresado a kilogramos (1 lb = 500 g = 0.50 kg)."""
    peso = quantize_2(peso_ingresado)
    if unidad_medida == "lb":
        return quantize_2(peso * LB_TO_KG_FACTOR)
    return peso


def calculate_points(
    db: Session,
    flujo: str,
    peso_ingresado: Decimal,
    unidad_medida: str = "kg",
) -> tuple[Decimal, Decimal, str]:
    """RN-06: Calcula puntos decimales (NUMERIC(10,2)) desde `reglas_puntos`.
    Fórmula parametrizable por defecto:
      - 1 kg = 1.00 punto
      - 1 libra (500 g) = 0.50 puntos
    """
    peso_in = quantize_2(peso_ingresado)
    peso_kg = normalize_weight_to_kg(peso_in, unidad_medida)

    regla = db.scalar(
        select(ReglaPuntos).where(ReglaPuntos.flujo == flujo, ReglaPuntos.activo.is_(True))
    )
    if regla is None:
        base = Decimal("0.00")
        por_kg = Decimal("1.00")
        por_lb = Decimal("0.50")
    else:
        base = quantize_2(regla.puntos_base)
        por_kg = quantize_2(regla.puntos_por_kg)
        por_lb = quantize_2(regla.puntos_por_libra)

    if unidad_medida == "lb":
        puntos = quantize_2(base + peso_in * por_lb)
        factor_label = f"{float(por_lb):.2f} pts/lb ({float(peso_in):.2f} lb = {float(peso_kg):.2f} kg)"
    else:
        puntos = quantize_2(base + peso_in * por_kg)
        factor_label = f"{float(por_kg):.2f} pts/kg ({float(peso_in):.2f} kg)"

    if base > Decimal("0.00"):
        desc = f"{float(base):.2f} base + {factor_label} [{flujo}]"
    else:
        desc = f"{factor_label} [{flujo}]"

    return peso_kg, max(puntos, Decimal("0.00")), desc


def create_solicitud(db: Session, user: Usuario, payload: SolicitudCreate) -> Solicitud:
    # RN-08: Control de habilitación de piloto / solicitudes
    if user.rol in (RolUsuario.HOGAR.value, RolUsuario.UNIDAD_PRODUCTIVA.value):
        if not user.habilitado_solicitudes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Tu cuenta aún no está habilitada en el piloto de Villas de San Pablo "
                    "para pedir recolección. Comunícate con la administración comunitaria."
                ),
            )

    coordinador = get_default_coordinator(db, payload.flujo)
    codigo = generate_unique_code(db)

    solicitud = Solicitud(
        codigo=codigo,
        usuario_id=user.id,
        coordinador_id=coordinador.id if coordinador else None,
        nombre_solicitante=payload.nombre_solicitante.strip(),
        telefono_contacto=payload.telefono_contacto.strip(),
        direccion=payload.direccion.strip(),
        tipo_generador=payload.tipo_generador,
        flujo=payload.flujo,
        estado=EstadoSolicitud.RECIBIDA.value,
        canal_origen="portal_web",
        preferencia_horaria=payload.preferencia_horaria.strip()
        if payload.preferencia_horaria
        else None,
        observaciones=payload.observaciones.strip() if payload.observaciones else None,
    )
    db.add(solicitud)
    db.flush()

    historial = HistorialEstado(
        solicitud_id=solicitud.id,
        estado_anterior=None,
        estado_nuevo=EstadoSolicitud.RECIBIDA.value,
        usuario_id=user.id,
        comentario=(
            f"Solicitud registrada en '{payload.flujo}' y enviada a "
            f"{coordinator_label_for_flow(payload.flujo)}."
        ),
    )
    db.add(historial)

    coord_name = coordinador.nombre if coordinador else coordinator_label_for_flow(payload.flujo)
    wa_text = (
        f"Hola {solicitud.nombre_solicitante}, recibimos tu solicitud {solicitud.codigo} "
        f"en EcoConecta – Villas de San Pablo ({solicitud.flujo}). "
        f"{coord_name} ({coordinator_label_for_flow(solicitud.flujo)}) la revisará y "
        f"acordará contigo el día y la hora de recolección por este medio."
    )
    whatsapp_service.send_message(
        db,
        solicitud_id=solicitud.id,
        flujo=solicitud.flujo,
        destinatario_nombre=solicitud.nombre_solicitante,
        destinatario_telefono=solicitud.telefono_contacto,
        tipo_evento="solicitud_recibida",
        mensaje=wa_text,
    )

    db.commit()
    db.refresh(solicitud)
    return solicitud


def _resolve_whatsapp_user(
    db: Session,
    *,
    sender_phone: str,
    usuario_email_hint: Optional[str],
    tipo_generador: str,
) -> Usuario:
    if usuario_email_hint:
        by_email = db.scalar(
            select(Usuario).where(Usuario.email == usuario_email_hint.strip().lower())
        )
        if by_email:
            return by_email

    digits = "".join(ch for ch in (sender_phone or "") if ch.isdigit())
    if digits:
        tail = digits[-7:]
        by_phone = db.scalar(
            select(Usuario).where(Usuario.telefono.ilike(f"%{tail}%"))
        )
        if by_phone:
            return by_phone

    target_email = (
        "piloto@villas.demo"
        if tipo_generador == "unidad_productiva"
        else "hogar@villas.demo"
    )
    fallback_user = db.scalar(select(Usuario).where(Usuario.email == target_email))
    if fallback_user:
        return fallback_user

    first_user = db.scalar(select(Usuario).order_by(Usuario.id.asc()).limit(1))
    if not first_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No hay usuarios base inicializados en el sistema.",
        )
    return first_user


def create_solicitud_from_whatsapp(
    db: Session,
    *,
    sender_phone: str,
    sender_name_hint: Optional[str],
    direccion_hint: Optional[str],
    tipo_generador_hint: Optional[str],
    usuario_email_hint: Optional[str],
    canal_origen: str,
    transcripcion: str,
    extraccion: ExtraccionSolicitudWA,
    modo_ia: str,
    whatsapp_message_id: Optional[str] = None,
) -> tuple[Solicitud, str]:
    """Crea y enruta automáticamente una solicitud entrante por WhatsApp (audio o texto).
    RN-01: organico -> Coordinador de Huerteros; reciclable -> Coordinador de Recicladores.
    RN-04: código único ECO-YYYY-NNNN + historial_estados + transcripción guardada en PostgreSQL.
    """
    if whatsapp_message_id:
        existing_sol = db.scalar(
            select(Solicitud).where(Solicitud.whatsapp_message_id == whatsapp_message_id)
        )
        if existing_sol:
            flujo_lbl = "orgánicos" if existing_sol.flujo == "organico" else "reciclables"
            return (
                existing_sol,
                (
                    f"¡Hola! Recibimos tu solicitud {existing_sol.codigo} para residuos {flujo_lbl}. "
                    "El coordinador del colectivo se comunicará contigo por este medio para acordar "
                    "el día y la hora de recolección."
                ),
            )

    tipo_gen = (
        extraccion.tipo_generador
        if extraccion.tipo_generador in ("hogar", "unidad_productiva")
        else (tipo_generador_hint or "hogar")
    )
    if tipo_generador_hint in ("hogar", "unidad_productiva") and extraccion.tipo_generador == "hogar":
        tipo_gen = tipo_generador_hint

    user = _resolve_whatsapp_user(
        db,
        sender_phone=sender_phone,
        usuario_email_hint=usuario_email_hint,
        tipo_generador=tipo_gen,
    )

    nombre_final = (
        (extraccion.nombre_solicitante or "").strip()
        or (sender_name_hint or "").strip()
        or user.nombre
    )
    direccion_final = (
        (extraccion.direccion or extraccion.direccion_mencionada or "").strip()
        or (direccion_hint or "").strip()
        or (user.direccion or "").strip()
        or "Villas de San Pablo (confirmar dirección exacta con coordinador)"
    )
    telefono_final = (sender_phone or "").strip() or (user.telefono or "+57 300 000 0000")

    coordinador = get_default_coordinator(db, extraccion.flujo)
    codigo = generate_unique_code(db)
    confianza_dec = quantize_2(extraccion.confianza_ia)
    cleaned_transcript = transcripcion.strip()

    solicitud = Solicitud(
        codigo=codigo,
        usuario_id=user.id,
        coordinador_id=coordinador.id if coordinador else None,
        nombre_solicitante=nombre_final,
        telefono_contacto=telefono_final,
        direccion=direccion_final,
        tipo_generador=tipo_gen,
        flujo=extraccion.flujo,
        estado=EstadoSolicitud.RECIBIDA.value,
        canal_origen=canal_origen,
        telefono_whatsapp=telefono_final,
        nombre_whatsapp=(sender_name_hint or nombre_final).strip(),
        transcripcion_audio=cleaned_transcript,
        transcripcion_original=cleaned_transcript,
        whatsapp_message_id=whatsapp_message_id,
        confianza_ia=confianza_dec,
        requiere_revision_humana=bool(extraccion.requiere_revision_humana),
        preferencia_horaria=extraccion.preferencia_horaria or "Por acordar con el coordinador",
        observaciones=(
            extraccion.resumen_residuos
            or extraccion.observaciones
            or cleaned_transcript[:240]
        ),
    )
    db.add(solicitud)
    db.flush()

    canal_label = (
        "Nota de Voz (Audio WhatsApp)"
        if canal_origen == "whatsapp_audio"
        else "Mensaje de Texto WhatsApp"
    )
    revision_tag = (
        " [Requiere verificación humana de flujo/datos]"
        if solicitud.requiere_revision_humana
        else ""
    )
    db.add(
        HistorialEstado(
            solicitud_id=solicitud.id,
            estado_anterior=None,
            estado_nuevo=EstadoSolicitud.RECIBIDA.value,
            usuario_id=user.id,
            comentario=(
                f"Solicitud ingresada por {canal_label} ({modo_ia}, confianza {float(confianza_dec):.0%}). "
                f"Enrutada a {coordinator_label_for_flow(solicitud.flujo)}.{revision_tag}"
            ),
        )
    )

    flujo_humano = "orgánicos" if solicitud.flujo == "organico" else "reciclables"
    wa_reply = (
        f"¡Hola! Recibimos tu solicitud {solicitud.codigo} para residuos {flujo_humano}. "
        f"El coordinador del colectivo ({coordinator_label_for_flow(solicitud.flujo)}) se comunicará "
        "contigo por este medio para acordar el día y la hora de recolección."
    )
    whatsapp_service.send_message(
        db,
        solicitud_id=solicitud.id,
        flujo=solicitud.flujo,
        destinatario_nombre=solicitud.nombre_solicitante,
        destinatario_telefono=solicitud.telefono_contacto,
        tipo_evento="confirmacion_whatsapp_ingesta",
        mensaje=wa_reply,
    )

    db.commit()
    db.refresh(solicitud)
    return solicitud, wa_reply


def reclassify_solicitud_flow(
    db: Session,
    coordinator: Usuario,
    solicitud: Solicitud,
    payload: ReclasificarFlujoRequest,
) -> Solicitud:
    """Control humano en /coordinacion: permite al coordinador corregir/reclasificar el flujo
    (ej. Mover a Recicladores / Mover a Huerteros) si el vecino o la IA clasificaron mal,
    dejando trazabilidad completa en `historial_estados` (RN-04).
    """
    assert_coordinator_flow_access(coordinator, solicitud)

    if solicitud.estado in (
        EstadoSolicitud.RECOLECTADA.value,
        EstadoSolicitud.CANCELADA.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede reclasificar una solicitud que ya fue cerrada o cancelada.",
        )

    flujo_anterior = solicitud.flujo
    nuevo_flujo = payload.nuevo_flujo
    if flujo_anterior == nuevo_flujo:
        solicitud.requiere_revision_humana = False
        db.commit()
        db.refresh(solicitud)
        return solicitud

    nuevo_coordinador = get_default_coordinator(db, nuevo_flujo)
    solicitud.flujo = nuevo_flujo
    solicitud.coordinador_id = (
        nuevo_coordinador.id if nuevo_coordinador else solicitud.coordinador_id
    )
    # Limpia encargado previo porque pertenecía al otro colectivo
    solicitud.encargado_id = None
    solicitud.nombre_encargado = None
    solicitud.requiere_revision_humana = False

    motivo_extra = f" Motivo: {payload.comentario.strip()}." if payload.comentario else ""
    db.add(
        HistorialEstado(
            solicitud_id=solicitud.id,
            estado_anterior=solicitud.estado,
            estado_nuevo=solicitud.estado,
            usuario_id=coordinator.id,
            comentario=(
                f"Control humano: flujo reclasificado de '{flujo_anterior}' a '{nuevo_flujo}' "
                f"por {coordinator.nombre}. Transferida a {coordinator_label_for_flow(nuevo_flujo)}.{motivo_extra}"
            ),
        )
    )

    coord_destino_nombre = (
        nuevo_coordinador.nombre
        if nuevo_coordinador
        else coordinator_label_for_flow(nuevo_flujo)
    )
    whatsapp_service.send_message(
        db,
        solicitud_id=solicitud.id,
        flujo=nuevo_flujo,
        destinatario_nombre=solicitud.nombre_solicitante,
        destinatario_telefono=solicitud.telefono_contacto,
        tipo_evento="reclasificacion_flujo",
        mensaje=(
            f"Hola {solicitud.nombre_solicitante}, revisamos tu pedido {solicitud.codigo} "
            f"y lo pasamos a {coordinator_label_for_flow(nuevo_flujo)} ({coord_destino_nombre}) "
            f"para atenderte mejor."
        ),
    )

    db.commit()
    db.refresh(solicitud)
    return solicitud


def update_solicitud_status(
    db: Session,
    coordinator: Usuario,
    solicitud: Solicitud,
    payload: CambiarEstadoRequest,
) -> Solicitud:
    assert_coordinator_flow_access(coordinator, solicitud)

    if solicitud.estado == EstadoSolicitud.RECOLECTADA.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La solicitud ya fue cerrada como recolectada y no puede modificarse.",
        )

    estado_anterior = solicitud.estado

    if payload.estado_nuevo == EstadoSolicitud.ASIGNADA.value:
        encargado_id, nombre_encargado = _validate_encargado(
            db, solicitud.flujo, payload.encargado_id, payload.nombre_encargado
        )
        if not nombre_encargado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="RN-03: Debes indicar el encargado/recolector al marcar como asignada.",
            )
        solicitud.encargado_id = encargado_id
        solicitud.nombre_encargado = nombre_encargado

    if coordinator.rol in (
        RolUsuario.COORDINADOR_HUERTEROS.value,
        RolUsuario.COORDINADOR_RECICLADORES.value,
    ):
        solicitud.coordinador_id = coordinator.id
    elif solicitud.coordinador_id is None:
        solicitud.coordinador_id = coordinator.id

    solicitud.estado = payload.estado_nuevo

    db.add(
        HistorialEstado(
            solicitud_id=solicitud.id,
            estado_anterior=estado_anterior,
            estado_nuevo=payload.estado_nuevo,
            usuario_id=coordinator.id,
            comentario=payload.comentario
            or f"Estado actualizado a '{payload.estado_nuevo}' por {coordinator.nombre}.",
        )
    )

    if payload.estado_nuevo == EstadoSolicitud.CANCELADA.value:
        whatsapp_service.send_message(
            db,
            solicitud_id=solicitud.id,
            flujo=solicitud.flujo,
            destinatario_nombre=solicitud.nombre_solicitante,
            destinatario_telefono=solicitud.telefono_contacto,
            tipo_evento="solicitud_cancelada",
            mensaje=(
                f"Hola {solicitud.nombre_solicitante}, tu solicitud {solicitud.codigo} "
                f"fue cancelada por {coordinator.nombre} "
                f"({coordinator_label_for_flow(solicitud.flujo)}). "
                f"{'Motivo: ' + payload.comentario if payload.comentario else ''}"
            ).strip(),
        )

    db.commit()
    db.refresh(solicitud)
    return solicitud


def schedule_solicitud(
    db: Session,
    coordinator: Usuario,
    solicitud: Solicitud,
    payload: ProgramarSolicitudRequest,
) -> Solicitud:
    """RN-02 & RN-03: Programa fecha, hora y encargado; notifica al usuario vía coordinador."""
    assert_coordinator_flow_access(coordinator, solicitud)

    if solicitud.estado in (EstadoSolicitud.RECOLECTADA.value, EstadoSolicitud.CANCELADA.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede programar una solicitud en estado '{solicitud.estado}'.",
        )

    encargado_id, nombre_encargado = _validate_encargado(
        db, solicitud.flujo, payload.encargado_id, payload.nombre_encargado
    )
    if not nombre_encargado:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RN-02: Debes registrar el nombre de la persona encargada para programar.",
        )

    estado_anterior = solicitud.estado
    solicitud.fecha_programada = payload.fecha_programada
    solicitud.hora_programada = payload.hora_programada.strip()
    solicitud.encargado_id = encargado_id
    solicitud.nombre_encargado = nombre_encargado
    solicitud.coordinador_id = coordinator.id
    solicitud.estado = EstadoSolicitud.PROGRAMADA.value

    db.add(
        HistorialEstado(
            solicitud_id=solicitud.id,
            estado_anterior=estado_anterior,
            estado_nuevo=EstadoSolicitud.PROGRAMADA.value,
            usuario_id=coordinator.id,
            comentario=(
                payload.comentario
                or f"Recolección programada para {solicitud.fecha_programada.isoformat()} "
                f"a las {solicitud.hora_programada}. Encargado interno asignado: {nombre_encargado}."
            ),
        )
    )

    wa_text = (
        f"Hola {solicitud.nombre_solicitante}, soy {coordinator.nombre} "
        f"({coordinator_label_for_flow(solicitud.flujo)}). "
        f"Tu recolección {solicitud.codigo} quedó programada para el "
        f"{solicitud.fecha_programada.isoformat()} a las {solicitud.hora_programada} "
        f"en {solicitud.direccion}. Si necesitas cambiar la hora, respóndeme por aquí "
        f"o en tu cuenta de EcoConecta."
    )
    whatsapp_service.send_message(
        db,
        solicitud_id=solicitud.id,
        flujo=solicitud.flujo,
        destinatario_nombre=solicitud.nombre_solicitante,
        destinatario_telefono=solicitud.telefono_contacto,
        tipo_evento="recoleccion_programada",
        mensaje=wa_text,
    )

    db.commit()
    db.refresh(solicitud)
    return solicitud


def close_and_register_collection(
    db: Session,
    coordinator: Usuario,
    solicitud: Solicitud,
    payload: RegistroRecoleccionCreate,
) -> Solicitud:
    """RN-05: Cierre obligatorio desde /coordinacion con peso en kg o lb y acreditación dual:
    1. Acredita puntos al usuario solicitante.
    2. Acredita puntos al recolector/huertero encargado registrado en el formulario.
    """
    assert_coordinator_flow_access(coordinator, solicitud)

    if solicitud.estado == EstadoSolicitud.CANCELADA.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede cerrar una solicitud cancelada.",
        )
    if solicitud.estado == EstadoSolicitud.RECOLECTADA.value or solicitud.registro_recoleccion:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta solicitud ya tiene un registro de recolección y cierre guardado.",
        )

    encargado = _resolve_or_create_encargado(
        db,
        solicitud.flujo,
        coordinator,
        payload.encargado_id,
        payload.nombre_encargado,
    )
    nombre_encargado = payload.nombre_encargado.strip() or encargado.nombre

    peso_ingresado = quantize_2(payload.peso_ingresado)
    unidad_medida = payload.unidad_medida
    peso_kg, puntos_calculados, regla_desc = calculate_points(
        db, solicitud.flujo, peso_ingresado, unidad_medida
    )

    fecha_recoleccion = payload.fecha_hora_recoleccion or datetime.now(timezone.utc)
    if fecha_recoleccion.tzinfo is None:
        fecha_recoleccion = fecha_recoleccion.replace(tzinfo=timezone.utc)

    estado_anterior = solicitud.estado

    registro = RegistroRecoleccion(
        solicitud_id=solicitud.id,
        coordinador_id=coordinator.id,
        encargado_id=encargado.id,
        nombre_solicitante_verificado=payload.nombre_solicitante_verificado.strip(),
        peso_ingresado=peso_ingresado,
        unidad_medida=unidad_medida,
        peso_kg=peso_kg,
        nombre_encargado=nombre_encargado,
        fecha_hora_recoleccion=fecha_recoleccion,
        observaciones=payload.observaciones.strip() if payload.observaciones else None,
        puntos_calculados=puntos_calculados,
    )
    db.add(registro)
    db.flush()

    solicitud.estado = EstadoSolicitud.RECOLECTADA.value
    solicitud.coordinador_id = coordinator.id
    solicitud.encargado_id = encargado.id
    solicitud.nombre_encargado = nombre_encargado

    mov_usuario = MovimientoPuntos(
        tipo_destinatario="usuario",
        tipo_movimiento="credito",
        usuario_id=solicitud.usuario_id,
        integrante_colectivo_id=None,
        solicitud_id=solicitud.id,
        registro_recoleccion_id=registro.id,
        flujo=solicitud.flujo,
        peso_ingresado=peso_ingresado,
        unidad_medida=unidad_medida,
        peso_kg=peso_kg,
        puntos=puntos_calculados,
        regla_aplicada=regla_desc,
    )
    mov_recolector = MovimientoPuntos(
        tipo_destinatario="recolector",
        tipo_movimiento="credito",
        usuario_id=None,
        integrante_colectivo_id=encargado.id,
        solicitud_id=solicitud.id,
        registro_recoleccion_id=registro.id,
        flujo=solicitud.flujo,
        peso_ingresado=peso_ingresado,
        unidad_medida=unidad_medida,
        peso_kg=peso_kg,
        puntos=puntos_calculados,
        regla_aplicada=regla_desc,
    )
    db.add_all([mov_usuario, mov_recolector])

    db.add(
        HistorialEstado(
            solicitud_id=solicitud.id,
            estado_anterior=estado_anterior,
            estado_nuevo=EstadoSolicitud.RECOLECTADA.value,
            usuario_id=coordinator.id,
            comentario=(
                f"Recolección registrada y cerrada por {coordinator.nombre}. "
                f"Solicitante verificado: {registro.nombre_solicitante_verificado} | "
                f"Peso: {float(peso_ingresado):.2f} {unidad_medida} ({float(peso_kg):.2f} kg) | "
                f"Encargado: {nombre_encargado} | "
                f"Acreditación dual: +{float(puntos_calculados):.2f} pts usuario y "
                f"+{float(puntos_calculados):.2f} pts recolector."
            ),
        )
    )

    wa_text = (
        f"¡Gracias {registro.nombre_solicitante_verificado}! Tu entrega {solicitud.codigo} "
        f"({solicitud.flujo}) fue completada con {float(peso_ingresado):.2f} {unidad_medida} "
        f"(equiv. {float(peso_kg):.2f} kg). Se acreditaron +{float(puntos_calculados):.2f} puntos "
        f"en EcoConecta – Villas de San Pablo. ({settings.POINTS_DISCLAIMER})."
    )
    whatsapp_service.send_message(
        db,
        solicitud_id=solicitud.id,
        flujo=solicitud.flujo,
        destinatario_nombre=registro.nombre_solicitante_verificado,
        destinatario_telefono=solicitud.telefono_contacto,
        tipo_evento="recoleccion_completada",
        mensaje=wa_text,
    )

    db.commit()
    db.refresh(solicitud)
    return solicitud


def add_coordination_message(
    db: Session,
    sender: Usuario,
    solicitud: Solicitud,
    payload: MensajeCreate,
) -> MensajeCoordinacion:
    """Canal intermediario exclusivo entre solicitante y coordinador de flujo."""
    assert_can_view_solicitud(sender, solicitud)

    mensaje = MensajeCoordinacion(
        solicitud_id=solicitud.id,
        remitente_id=sender.id,
        rol_remitente=sender.rol,
        contenido=payload.contenido.strip(),
    )
    db.add(mensaje)

    is_coordinator_side = sender.rol in (
        RolUsuario.COORDINADOR_HUERTEROS.value,
        RolUsuario.COORDINADOR_RECICLADORES.value,
        RolUsuario.ADMINISTRADOR.value,
    )
    if is_coordinator_side and payload.enviar_whatsapp:
        whatsapp_service.send_message(
            db,
            solicitud_id=solicitud.id,
            flujo=solicitud.flujo,
            destinatario_nombre=solicitud.nombre_solicitante,
            destinatario_telefono=solicitud.telefono_contacto,
            tipo_evento="mensaje_coordinador",
            mensaje=(
                f"Mensaje de {sender.nombre} ({coordinator_label_for_flow(solicitud.flujo)}) "
                f"sobre {solicitud.codigo}: {mensaje.contenido}"
            ),
        )

    db.commit()
    db.refresh(mensaje)
    return mensaje


# --- Beneficios, Progreso por Niveles y Canjes ---

def _extract_level_title(benefit_name: str) -> str:
    for sep in ("–", "-", ":"):
        if sep in benefit_name:
            return benefit_name.split(sep, 1)[0].strip()
    return benefit_name.strip()


def compute_level_progress(
    saldo: Decimal, beneficios_activos: list[Beneficio]
) -> tuple[ProgresoNivelOut, list[BeneficioOut]]:
    ordered = sorted(beneficios_activos, key=lambda b: (b.puntos_requeridos, b.id))
    saldo_q = quantize_2(saldo)

    beneficios_out: list[BeneficioOut] = []
    highest_unlocked: Optional[Beneficio] = None
    next_locked: Optional[Beneficio] = None

    for b in ordered:
        req = quantize_2(b.puntos_requeridos)
        unlocked = saldo_q >= req
        missing = quantize_2(max(req - saldo_q, Decimal("0.00")))
        if unlocked:
            highest_unlocked = b
        elif next_locked is None:
            next_locked = b
        beneficios_out.append(
            BeneficioOut(
                id=b.id,
                tipo_destinatario=b.tipo_destinatario,  # type: ignore[arg-type]
                nombre=b.nombre,
                descripcion=b.descripcion,
                puntos_requeridos=float(req),
                activo=b.activo,
                desbloqueado=unlocked,
                puntos_faltantes=float(missing),
            )
        )

    nivel_actual = (
        _extract_level_title(highest_unlocked.nombre)
        if highest_unlocked
        else "Inicio (sin nivel aún)"
    )

    if next_locked is not None:
        target = quantize_2(next_locked.puntos_requeridos)
        faltantes = quantize_2(max(target - saldo_q, Decimal("0.00")))
        pct = float(
            min(
                max((saldo_q / target) * Decimal("100"), Decimal("0.00")),
                Decimal("100.00"),
            ).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
        )
        progreso = ProgresoNivelOut(
            nivel_actual=nivel_actual,
            siguiente_beneficio_id=next_locked.id,
            siguiente_nivel_nombre=next_locked.nombre,
            puntos_siguiente_nivel=float(target),
            puntos_faltantes=float(faltantes),
            porcentaje_avance=pct,
        )
    else:
        progreso = ProgresoNivelOut(
            nivel_actual=nivel_actual,
            siguiente_beneficio_id=None,
            siguiente_nivel_nombre="Nivel máximo alcanzado",
            puntos_siguiente_nivel=float(highest_unlocked.puntos_requeridos)
            if highest_unlocked
            else None,
            puntos_faltantes=0.0,
            porcentaje_avance=100.0 if ordered else 0.0,
        )

    return progreso, beneficios_out


def serialize_movimiento(m: MovimientoPuntos) -> MovimientoPuntosOut:
    return MovimientoPuntosOut(
        id=m.id,
        tipo_destinatario=m.tipo_destinatario,
        tipo_movimiento=m.tipo_movimiento,
        solicitud_id=m.solicitud_id,
        codigo_solicitud=m.solicitud.codigo if m.solicitud else None,
        beneficio_nombre=m.beneficio.nombre if m.beneficio else None,
        flujo=m.flujo,
        peso_ingresado=float(m.peso_ingresado) if m.peso_ingresado is not None else None,
        unidad_medida=m.unidad_medida,
        peso_kg=float(m.peso_kg) if m.peso_kg is not None else None,
        puntos=float(m.puntos),
        regla_aplicada=m.regla_aplicada,
        creado_en=m.creado_en,
    )


def serialize_canje(c: CanjeBeneficio) -> CanjeOut:
    destinatario = (
        c.usuario.nombre
        if c.tipo_destinatario == "usuario" and c.usuario
        else c.integrante_colectivo.nombre
        if c.integrante_colectivo
        else "Participante"
    )
    return CanjeOut(
        id=c.id,
        beneficio_id=c.beneficio_id,
        beneficio_nombre=c.beneficio.nombre if c.beneficio else "",
        tipo_destinatario=c.tipo_destinatario,
        destinatario_nombre=destinatario,
        puntos_canjeados=float(c.puntos_canjeados),
        estado=c.estado,
        observaciones=c.observaciones,
        registrado_por_nombre=c.registrado_por.nombre if c.registrado_por else "",
        creado_en=c.creado_en,
    )


def get_user_points_and_benefits(db: Session, user: Usuario) -> MiResumenPuntosOut:
    movimientos = db.scalars(
        select(MovimientoPuntos)
        .options(
            selectinload(MovimientoPuntos.solicitud),
            selectinload(MovimientoPuntos.beneficio),
        )
        .where(
            MovimientoPuntos.tipo_destinatario == "usuario",
            MovimientoPuntos.usuario_id == user.id,
        )
        .order_by(MovimientoPuntos.creado_en.desc())
    ).all()

    creditos = [m for m in movimientos if m.tipo_movimiento == "credito"]
    canjes_movs = [m for m in movimientos if m.tipo_movimiento == "canje"]

    ganados = quantize_2(sum((Decimal(str(m.puntos)) for m in creditos), Decimal("0.00")))
    canjeados = quantize_2(
        sum((abs(Decimal(str(m.puntos))) for m in canjes_movs), Decimal("0.00"))
    )
    disponibles = quantize_2(ganados - canjeados)
    total_kg = quantize_2(
        sum((Decimal(str(m.peso_kg or 0)) for m in creditos), Decimal("0.00"))
    )

    beneficios_db = list(
        db.scalars(
            select(Beneficio)
            .where(Beneficio.tipo_destinatario == "usuario", Beneficio.activo.is_(True))
            .order_by(Beneficio.puntos_requeridos.asc(), Beneficio.id.asc())
        ).all()
    )
    progreso, beneficios_out = compute_level_progress(disponibles, beneficios_db)

    canjes_db = db.scalars(
        select(CanjeBeneficio)
        .options(
            selectinload(CanjeBeneficio.beneficio),
            selectinload(CanjeBeneficio.usuario),
            selectinload(CanjeBeneficio.registrado_por),
        )
        .where(
            CanjeBeneficio.tipo_destinatario == "usuario",
            CanjeBeneficio.usuario_id == user.id,
        )
        .order_by(CanjeBeneficio.creado_en.desc())
    ).all()

    return MiResumenPuntosOut(
        puntos_disponibles=float(disponibles),
        puntos_totales=float(disponibles),
        puntos_ganados=float(ganados),
        puntos_canjeados=float(canjeados),
        total_kg=float(total_kg),
        recolecciones_completadas=len(creditos),
        progreso_nivel=progreso,
        beneficios=beneficios_out,
        canjes=[serialize_canje(c) for c in canjes_db],
        nota_institucional=settings.POINTS_DISCLAIMER,
        movimientos=[serialize_movimiento(m) for m in movimientos],
    )


def get_collectors_points_panel(
    db: Session, effective_flow: Optional[str]
) -> PanelRecolectoresPuntosOut:
    beneficios_db = list(
        db.scalars(
            select(Beneficio)
            .where(Beneficio.tipo_destinatario == "recolector", Beneficio.activo.is_(True))
            .order_by(Beneficio.puntos_requeridos.asc(), Beneficio.id.asc())
        ).all()
    )

    stmt = (
        select(IntegranteColectivo)
        .where(IntegranteColectivo.activo.is_(True))
        .order_by(IntegranteColectivo.flujo.asc(), IntegranteColectivo.nombre.asc())
    )
    if effective_flow:
        stmt = stmt.where(IntegranteColectivo.flujo == effective_flow)
    integrantes = list(db.scalars(stmt).all())

    recolectores_out: list[ResumenPuntosRecolectorOut] = []
    for integrante in integrantes:
        movs = db.scalars(
            select(MovimientoPuntos)
            .options(
                selectinload(MovimientoPuntos.solicitud),
                selectinload(MovimientoPuntos.beneficio),
            )
            .where(
                MovimientoPuntos.tipo_destinatario == "recolector",
                MovimientoPuntos.integrante_colectivo_id == integrante.id,
            )
            .order_by(MovimientoPuntos.creado_en.desc())
        ).all()

        creditos = [m for m in movs if m.tipo_movimiento == "credito"]
        canjes_movs = [m for m in movs if m.tipo_movimiento == "canje"]

        ganados = quantize_2(sum((Decimal(str(m.puntos)) for m in creditos), Decimal("0.00")))
        canjeados = quantize_2(
            sum((abs(Decimal(str(m.puntos))) for m in canjes_movs), Decimal("0.00"))
        )
        disponibles = quantize_2(ganados - canjeados)
        total_kg = quantize_2(
            sum((Decimal(str(m.peso_kg or 0)) for m in creditos), Decimal("0.00"))
        )

        progreso, beneficios_con_estado = compute_level_progress(disponibles, beneficios_db)

        canjes_db = db.scalars(
            select(CanjeBeneficio)
            .options(
                selectinload(CanjeBeneficio.beneficio),
                selectinload(CanjeBeneficio.integrante_colectivo),
                selectinload(CanjeBeneficio.registrado_por),
            )
            .where(
                CanjeBeneficio.tipo_destinatario == "recolector",
                CanjeBeneficio.integrante_colectivo_id == integrante.id,
            )
            .order_by(CanjeBeneficio.creado_en.desc())
            .limit(10)
        ).all()

        recolectores_out.append(
            ResumenPuntosRecolectorOut(
                integrante_id=integrante.id,
                nombre=integrante.nombre,
                flujo=integrante.flujo,
                rol_interno=integrante.rol_interno,
                zona_cobertura=integrante.zona_cobertura,
                recolecciones_realizadas=len(creditos),
                total_kg_recolectados=float(total_kg),
                puntos_disponibles=float(disponibles),
                puntos_ganados=float(ganados),
                puntos_canjeados=float(canjeados),
                progreso_nivel=progreso,
                beneficios=beneficios_con_estado,
                canjes_recientes=[serialize_canje(c) for c in canjes_db],
                movimientos_recientes=[serialize_movimiento(m) for m in movs[:10]],
            )
        )

    recolectores_out.sort(key=lambda r: (-r.puntos_disponibles, r.nombre))

    _, catalogo_base = compute_level_progress(Decimal("0.00"), beneficios_db)
    return PanelRecolectoresPuntosOut(
        nota_institucional=settings.POINTS_DISCLAIMER,
        catalogo_beneficios=catalogo_base,
        recolectores=recolectores_out,
    )


def redeem_benefit(
    db: Session,
    *,
    tipo_destinatario: str,
    beneficio_id: int,
    actor_user: Usuario,
    usuario_id: Optional[int] = None,
    integrante_id: Optional[int] = None,
    observaciones: Optional[str] = None,
) -> CanjeBeneficio:
    beneficio = db.get(Beneficio, beneficio_id)
    if not beneficio or not beneficio.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El beneficio seleccionado no existe o no está activo.",
        )
    if beneficio.tipo_destinatario != tipo_destinatario:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Este beneficio corresponde a '{beneficio.tipo_destinatario}', "
                f"no a '{tipo_destinatario}'."
            ),
        )

    costo = quantize_2(beneficio.puntos_requeridos)

    if tipo_destinatario == "usuario":
        if usuario_id is None:
            raise HTTPException(status_code=400, detail="Usuario requerido para el canje.")
        saldo = get_user_points_balance(db, usuario_id)
        if saldo < costo:
            faltan = quantize_2(costo - saldo)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Aún no tienes puntos suficientes para '{beneficio.nombre}'. "
                    f"Tienes {float(saldo):.2f} puntos y necesitas {float(costo):.2f} puntos "
                    f"(te faltan {float(faltan):.2f} puntos)."
                ),
            )
    else:
        if integrante_id is None:
            raise HTTPException(status_code=400, detail="Recolector requerido para el canje.")
        integrante = db.get(IntegranteColectivo, integrante_id)
        if not integrante or not integrante.activo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El integrante del colectivo no existe o está inactivo.",
            )
        allowed_flow = get_coordinator_flow(actor_user)
        if allowed_flow is not None and integrante.flujo != allowed_flow:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="RN-01: Solo puedes registrar canjes para integrantes de tu propio flujo.",
            )
        saldo = get_collector_points_balance(db, integrante_id)
        if saldo < costo:
            faltan = quantize_2(costo - saldo)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Saldo insuficiente para {integrante.nombre}. "
                    f"Disponibles: {float(saldo):.2f} pts · Requeridos: {float(costo):.2f} pts "
                    f"(faltan {float(faltan):.2f} pts)."
                ),
            )

    canje = CanjeBeneficio(
        beneficio_id=beneficio.id,
        tipo_destinatario=tipo_destinatario,
        usuario_id=usuario_id if tipo_destinatario == "usuario" else None,
        integrante_colectivo_id=integrante_id if tipo_destinatario == "recolector" else None,
        registrado_por_id=actor_user.id,
        puntos_canjeados=costo,
        estado="registrado",
        observaciones=observaciones.strip() if observaciones else None,
    )
    db.add(canje)
    db.flush()

    movimiento = MovimientoPuntos(
        tipo_destinatario=tipo_destinatario,
        tipo_movimiento="canje",
        usuario_id=usuario_id if tipo_destinatario == "usuario" else None,
        integrante_colectivo_id=integrante_id if tipo_destinatario == "recolector" else None,
        solicitud_id=None,
        registro_recoleccion_id=None,
        beneficio_id=beneficio.id,
        flujo=None,
        peso_ingresado=None,
        unidad_medida=None,
        peso_kg=None,
        puntos=-costo,
        regla_aplicada=f"Canje beneficio: {beneficio.nombre} (-{float(costo):.2f} pts)",
    )
    db.add(movimiento)
    db.commit()

    loaded = db.scalar(
        select(CanjeBeneficio)
        .options(
            selectinload(CanjeBeneficio.beneficio),
            selectinload(CanjeBeneficio.usuario),
            selectinload(CanjeBeneficio.integrante_colectivo),
            selectinload(CanjeBeneficio.registrado_por),
        )
        .where(CanjeBeneficio.id == canje.id)
    )
    return loaded or canje


# --- Serializers (Enforcement of RN-07 & Intermediary Privacy) ---

def _serialize_historial(
    items: list[HistorialEstado], *, mask_collector: bool = False
) -> list[HistorialEstadoOut]:
    result: list[HistorialEstadoOut] = []
    for h in items:
        comentario = h.comentario
        if mask_collector and comentario and "Encargado" in comentario:
            if h.estado_nuevo == EstadoSolicitud.PROGRAMADA.value:
                comentario = "Recolección programada por el coordinador del colectivo."
            elif h.estado_nuevo == EstadoSolicitud.RECOLECTADA.value:
                comentario = "Recolección confirmada y cerrada por el coordinador. Puntos acreditados."
        result.append(
            HistorialEstadoOut(
                id=h.id,
                estado_anterior=h.estado_anterior,
                estado_nuevo=h.estado_nuevo,
                usuario_nombre=h.usuario.nombre if h.usuario else "Sistema",
                usuario_rol=h.usuario.rol if h.usuario else "sistema",
                comentario=comentario,
                creado_en=h.creado_en,
            )
        )
    return result


def _serialize_mensajes(items: list[MensajeCoordinacion]) -> list[MensajeOut]:
    return [
        MensajeOut(
            id=m.id,
            solicitud_id=m.solicitud_id,
            remitente_id=m.remitente_id,
            remitente_nombre=m.remitente.nombre if m.remitente else "Usuario",
            rol_remitente=m.rol_remitente,
            contenido=m.contenido,
            creado_en=m.creado_en,
        )
        for m in items
    ]


def serialize_registro_recoleccion(registro: RegistroRecoleccion) -> RegistroRecoleccionOut:
    return RegistroRecoleccionOut(
        id=registro.id,
        solicitud_id=registro.solicitud_id,
        codigo_solicitud=registro.solicitud.codigo if registro.solicitud else "",
        flujo=registro.solicitud.flujo if registro.solicitud else "",
        tipo_generador=registro.solicitud.tipo_generador if registro.solicitud else "",
        coordinador_id=registro.coordinador_id,
        coordinador_nombre=registro.coordinador.nombre if registro.coordinador else "",
        encargado_id=registro.encargado_id,
        nombre_solicitante_verificado=registro.nombre_solicitante_verificado,
        peso_ingresado=float(registro.peso_ingresado),
        unidad_medida=registro.unidad_medida,  # type: ignore[arg-type]
        peso_kg=float(registro.peso_kg),
        nombre_encargado=registro.nombre_encargado,
        fecha_hora_recoleccion=registro.fecha_hora_recoleccion,
        observaciones=registro.observaciones,
        puntos_calculados=float(registro.puntos_calculados),
        creado_en=registro.creado_en,
    )


def serialize_solicitud_ciudadano(solicitud: Solicitud) -> SolicitudCiudadanoOut:
    """Serialización para ciudadanos: solo coordinador intermediario, nunca datos del recolector."""
    reg = solicitud.registro_recoleccion
    return SolicitudCiudadanoOut(
        id=solicitud.id,
        codigo=solicitud.codigo,
        nombre_solicitante=solicitud.nombre_solicitante,
        telefono_contacto=solicitud.telefono_contacto,
        direccion=solicitud.direccion,
        tipo_generador=solicitud.tipo_generador,
        flujo=solicitud.flujo,
        estado=solicitud.estado,
        canal_origen=solicitud.canal_origen or "portal_web",
        telefono_whatsapp=solicitud.telefono_whatsapp or solicitud.telefono_contacto,
        nombre_whatsapp=solicitud.nombre_whatsapp or solicitud.nombre_solicitante,
        transcripcion_audio=solicitud.transcripcion_audio or solicitud.transcripcion_original,
        transcripcion_original=solicitud.transcripcion_original or solicitud.transcripcion_audio,
        preferencia_horaria=solicitud.preferencia_horaria,
        observaciones=solicitud.observaciones,
        fecha_programada=solicitud.fecha_programada,
        hora_programada=solicitud.hora_programada,
        coordinador_nombre=solicitud.coordinador.nombre
        if solicitud.coordinador
        else coordinator_label_for_flow(solicitud.flujo),
        coordinador_rol_label=coordinator_label_for_flow(solicitud.flujo),
        peso_ingresado=float(reg.peso_ingresado) if reg else None,
        unidad_medida=reg.unidad_medida if reg else None,
        peso_kg_registrado=float(reg.peso_kg) if reg else None,
        puntos_otorgados=float(reg.puntos_calculados) if reg else 0.0,
        creado_en=solicitud.creado_en,
        actualizado_en=solicitud.actualizado_en,
        historial_estados=_serialize_historial(
            solicitud.historial_estados, mask_collector=True
        ),
        mensajes=_serialize_mensajes(solicitud.mensajes),
    )


def serialize_solicitud_coordinador(solicitud: Solicitud) -> SolicitudCoordinadorOut:
    """Serialización operativa exclusiva de /coordinacion."""
    reg = solicitud.registro_recoleccion
    return SolicitudCoordinadorOut(
        id=solicitud.id,
        codigo=solicitud.codigo,
        usuario_id=solicitud.usuario_id,
        es_piloto_solicitante=bool(solicitud.usuario.es_piloto) if solicitud.usuario else False,
        nombre_solicitante=solicitud.nombre_solicitante,
        telefono_contacto=solicitud.telefono_contacto,
        direccion=solicitud.direccion,
        tipo_generador=solicitud.tipo_generador,
        flujo=solicitud.flujo,
        estado=solicitud.estado,
        canal_origen=solicitud.canal_origen or "portal_web",
        telefono_whatsapp=solicitud.telefono_whatsapp or solicitud.telefono_contacto,
        nombre_whatsapp=solicitud.nombre_whatsapp or solicitud.nombre_solicitante,
        transcripcion_audio=solicitud.transcripcion_audio or solicitud.transcripcion_original,
        transcripcion_original=solicitud.transcripcion_original or solicitud.transcripcion_audio,
        confianza_ia=float(solicitud.confianza_ia)
        if solicitud.confianza_ia is not None
        else None,
        requiere_revision_humana=bool(solicitud.requiere_revision_humana),
        preferencia_horaria=solicitud.preferencia_horaria,
        observaciones=solicitud.observaciones,
        coordinador_id=solicitud.coordinador_id,
        coordinador_nombre=solicitud.coordinador.nombre if solicitud.coordinador else None,
        encargado_id=solicitud.encargado_id,
        nombre_encargado=solicitud.nombre_encargado,
        fecha_programada=solicitud.fecha_programada,
        hora_programada=solicitud.hora_programada,
        creado_en=solicitud.creado_en,
        actualizado_en=solicitud.actualizado_en,
        registro_recoleccion=serialize_registro_recoleccion(reg) if reg else None,
        historial_estados=_serialize_historial(
            solicitud.historial_estados, mask_collector=False
        ),
        mensajes=_serialize_mensajes(solicitud.mensajes),
    )


def serialize_solicitud_publica(solicitud: Solicitud) -> SolicitudPublicaTrackOut:
    """RN-07: Consulta pública por código sin datos personales (sin teléfono, dirección ni nombre)."""
    reg = solicitud.registro_recoleccion
    return SolicitudPublicaTrackOut(
        codigo=solicitud.codigo,
        flujo=solicitud.flujo,
        estado=solicitud.estado,
        fecha_programada=solicitud.fecha_programada,
        hora_programada=solicitud.hora_programada,
        coordinador_rol_label=coordinator_label_for_flow(solicitud.flujo),
        peso_ingresado=float(reg.peso_ingresado) if reg else None,
        unidad_medida=reg.unidad_medida if reg else None,
        peso_kg_registrado=float(reg.peso_kg) if reg else None,
        puntos_otorgados=float(reg.puntos_calculados) if reg else 0.0,
        creado_en=solicitud.creado_en,
        actualizado_en=solicitud.actualizado_en,
        historial_publico=[
            HistorialPublicoOut(estado_nuevo=h.estado_nuevo, creado_en=h.creado_en)
            for h in solicitud.historial_estados
        ],
    )
