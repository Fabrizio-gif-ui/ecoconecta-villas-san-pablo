from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import (
    HistorialEstado,
    MensajeCoordinacion,
    RolUsuario,
    Solicitud,
    Usuario,
)
from app.schemas.schemas import (
    CanjeCreate,
    CanjeOut,
    MensajeCreate,
    MensajeOut,
    MiResumenPuntosOut,
    SolicitudCiudadanoOut,
    SolicitudCreate,
)
from app.services.solicitudes import (
    add_coordination_message,
    assert_can_view_solicitud,
    create_solicitud,
    get_user_points_and_benefits,
    redeem_benefit,
    serialize_canje,
    serialize_solicitud_ciudadano,
)

router = APIRouter(prefix="/solicitudes", tags=["Portal Ciudadano"])


def _load_solicitud_full(db: Session, solicitud_id: int) -> Solicitud:
    solicitud = db.scalar(
        select(Solicitud)
        .options(
            selectinload(Solicitud.coordinador),
            selectinload(Solicitud.registro_recoleccion),
            selectinload(Solicitud.historial_estados).selectinload(HistorialEstado.usuario),
            selectinload(Solicitud.mensajes).selectinload(MensajeCoordinacion.remitente),
        )
        .where(Solicitud.id == solicitud_id)
    )
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontramos esa solicitud.",
        )
    return solicitud


@router.post("", response_model=SolicitudCiudadanoOut, status_code=status.HTTP_201_CREATED)
def crear_solicitud(
    payload: SolicitudCreate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SolicitudCiudadanoOut:
    if current_user.rol in (
        RolUsuario.COORDINADOR_HUERTEROS.value,
        RolUsuario.COORDINADOR_RECICLADORES.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Las cuentas de coordinación atienden pedidos en /coordinacion, no piden recolección ciudadana.",
        )
    created = create_solicitud(db, current_user, payload)
    loaded = _load_solicitud_full(db, created.id)
    return serialize_solicitud_ciudadano(loaded)


@router.get("/mias", response_model=list[SolicitudCiudadanoOut])
def listar_mis_solicitudes(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SolicitudCiudadanoOut]:
    solicitudes = db.scalars(
        select(Solicitud)
        .options(
            selectinload(Solicitud.coordinador),
            selectinload(Solicitud.registro_recoleccion),
            selectinload(Solicitud.historial_estados).selectinload(HistorialEstado.usuario),
            selectinload(Solicitud.mensajes).selectinload(MensajeCoordinacion.remitente),
        )
        .where(Solicitud.usuario_id == current_user.id)
        .order_by(Solicitud.creado_en.desc())
    ).all()
    return [serialize_solicitud_ciudadano(s) for s in solicitudes]


@router.get("/mias/puntos", response_model=MiResumenPuntosOut)
def obtener_mis_puntos(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MiResumenPuntosOut:
    return get_user_points_and_benefits(db, current_user)


@router.post("/mias/canjes", response_model=CanjeOut, status_code=status.HTTP_201_CREATED)
def registrar_canje_usuario(
    payload: CanjeCreate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CanjeOut:
    canje = redeem_benefit(
        db,
        tipo_destinatario="usuario",
        beneficio_id=payload.beneficio_id,
        actor_user=current_user,
        usuario_id=current_user.id,
        observaciones=payload.observaciones,
    )
    return serialize_canje(canje)


@router.get("/{solicitud_id}", response_model=SolicitudCiudadanoOut)
def detalle_mi_solicitud(
    solicitud_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SolicitudCiudadanoOut:
    solicitud = _load_solicitud_full(db, solicitud_id)
    assert_can_view_solicitud(current_user, solicitud)
    return serialize_solicitud_ciudadano(solicitud)


@router.post("/{solicitud_id}/mensajes", response_model=MensajeOut, status_code=status.HTTP_201_CREATED)
def enviar_mensaje_ciudadano(
    solicitud_id: int,
    payload: MensajeCreate,
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MensajeOut:
    solicitud = _load_solicitud_full(db, solicitud_id)
    safe_payload = MensajeCreate(contenido=payload.contenido, enviar_whatsapp=False)
    mensaje = add_coordination_message(db, current_user, solicitud, safe_payload)
    return MensajeOut(
        id=mensaje.id,
        solicitud_id=mensaje.solicitud_id,
        remitente_id=mensaje.remitente_id,
        remitente_nombre=current_user.nombre,
        rol_remitente=mensaje.rol_remitente,
        contenido=mensaje.contenido,
        creado_en=mensaje.creado_en,
    )
