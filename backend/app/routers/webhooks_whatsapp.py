"""Webhook oficial de WhatsApp Business Cloud API (Meta) + Endpoint Simulador con Audio
para demostraciones en vivo desde `/whatsapp-demo`.

Rutas expuestas:
- GET  /api/webhooks/whatsapp          (Verificación de token de Meta `hub.challenge`)
- POST /api/webhooks/whatsapp          (Recepción de mensajes `text` y `audio` de Meta Cloud API)
- POST /api/webhooks/whatsapp/simular  (Recepción de nota de voz grabada o texto desde `/whatsapp-demo`)
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas.schemas import SimulacionWhatsAppResponse
from app.services.ai_extractor import (
    extract_structured_solicitud,
    transcribe_audio_bytes,
)
from app.services.solicitudes import (
    coordinator_label_for_flow,
    create_solicitud_from_whatsapp,
)
from app.services.whatsapp_cloud import whatsapp_cloud_client

router = APIRouter(prefix="/webhooks/whatsapp", tags=["Webhook WhatsApp + IA Audio"])


@router.get("")
def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(default=None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
) -> PlainTextResponse:
    """Verificación oficial de webhook de Meta WhatsApp Business Cloud API."""
    challenge = whatsapp_cloud_client.verify_webhook_token(
        hub_mode, hub_verify_token, hub_challenge
    )
    if challenge is not None:
        return PlainTextResponse(content=challenge, status_code=200)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Token de verificación de WhatsApp inválido.",
    )


@router.post("")
async def receive_whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Recibe eventos entrantes de Meta WhatsApp Business Cloud API (mensajes de texto y notas de voz)."""
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cuerpo JSON inválido en el webhook.",
        ) from exc

    created_records: list[dict[str, Any]] = []

    entries = payload.get("entry", []) if isinstance(payload, dict) else []
    for entry in entries:
        changes = entry.get("changes", []) if isinstance(entry, dict) else []
        for change in changes:
            value = change.get("value", {}) if isinstance(change, dict) else {}
            contacts = value.get("contacts", []) or []
            contact_name: Optional[str] = None
            if contacts and isinstance(contacts[0], dict):
                profile = contacts[0].get("profile", {}) or {}
                contact_name = profile.get("name")

            messages = value.get("messages", []) or []
            if not messages and value.get("statuses"):
                # Ignora eventos de estado (entregado / leído) para no duplicar solicitudes
                continue

            for msg in messages:
                if not isinstance(msg, dict):
                    continue
                msg_type = msg.get("type")
                msg_id = str(msg.get("id", "")).strip() or None
                sender_phone = str(msg.get("from", "")).strip()

                if msg_type == "text":
                    text_body = str((msg.get("text") or {}).get("body", "")).strip()
                    if not text_body:
                        continue
                    extraccion, modo_ext = extract_structured_solicitud(text_body)
                    solicitud, wa_reply = create_solicitud_from_whatsapp(
                        db,
                        sender_phone=sender_phone,
                        sender_name_hint=contact_name,
                        direccion_hint=None,
                        tipo_generador_hint=None,
                        usuario_email_hint=None,
                        canal_origen="whatsapp_texto",
                        transcripcion=text_body,
                        extraccion=extraccion,
                        modo_ia=modo_ext,
                        whatsapp_message_id=msg_id,
                    )
                    created_records.append(
                        {
                            "solicitud_id": solicitud.id,
                            "codigo": solicitud.codigo,
                            "flujo": solicitud.flujo,
                            "canal_origen": solicitud.canal_origen,
                            "modo_ia": modo_ext,
                            "respuesta_whatsapp": wa_reply,
                        }
                    )

                elif msg_type == "audio":
                    audio_info = msg.get("audio") or {}
                    media_id = str(audio_info.get("id", "")).strip()
                    transcript_hint = str(
                        audio_info.get("transcript_hint")
                        or audio_info.get("caption")
                        or ""
                    ).strip()

                    audio_bytes = b""
                    filename = "nota_voz.ogg"
                    if media_id and whatsapp_cloud_client.is_configured:
                        try:
                            audio_bytes, mime = whatsapp_cloud_client.download_audio_binary(media_id)
                            if "mp3" in mime or "mpeg" in mime:
                                filename = "nota_voz.mp3"
                            elif "webm" in mime:
                                filename = "nota_voz.webm"
                        except Exception:
                            audio_bytes = b""

                    transcripcion, modo_trans = transcribe_audio_bytes(
                        audio_bytes,
                        filename=filename,
                        fallback_transcript=transcript_hint or None,
                    )
                    extraccion, modo_ext = extract_structured_solicitud(transcripcion)
                    modo_combinado = f"{modo_trans} + {modo_ext}"

                    solicitud, wa_reply = create_solicitud_from_whatsapp(
                        db,
                        sender_phone=sender_phone,
                        sender_name_hint=contact_name,
                        direccion_hint=None,
                        tipo_generador_hint=None,
                        usuario_email_hint=None,
                        canal_origen="whatsapp_audio",
                        transcripcion=transcripcion,
                        extraccion=extraccion,
                        modo_ia=modo_combinado,
                        whatsapp_message_id=msg_id,
                    )
                    created_records.append(
                        {
                            "solicitud_id": solicitud.id,
                            "codigo": solicitud.codigo,
                            "flujo": solicitud.flujo,
                            "canal_origen": solicitud.canal_origen,
                            "transcripcion": transcripcion,
                            "modo_ia": modo_combinado,
                            "respuesta_whatsapp": wa_reply,
                        }
                    )

    return {
        "status": "processed",
        "count": len(created_records),
        "procesados": len(created_records),
        "created": created_records,
        "solicitudes": created_records,
    }


@router.post("/simular", response_model=SimulacionWhatsAppResponse, status_code=status.HTTP_201_CREATED)
async def simulate_whatsapp_message(
    tipo_mensaje: Optional[str] = Form(default=None),
    telefono: Optional[str] = Form(default=None),
    remitente_telefono: Optional[str] = Form(default=None),
    nombre_remitente: Optional[str] = Form(default=None),
    remitente_nombre: Optional[str] = Form(default=None),
    direccion_remitente: Optional[str] = Form(default=None),
    direccion_referencia: Optional[str] = Form(default=None),
    tipo_generador: Optional[str] = Form(default=None),
    email_usuario: Optional[str] = Form(default=None),
    usuario_email: Optional[str] = Form(default=None),
    texto: Optional[str] = Form(default=None),
    archivo_audio: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
) -> SimulacionWhatsAppResponse:
    """Procesa un audio grabado desde el micrófono de `/whatsapp-demo` o un texto simulado
    exactamente con el mismo flujo de transcripción, extracción estructurada y enrutamiento RN-01.
    """
    es_audio = (
        (tipo_mensaje or "").strip().lower() == "audio"
        or archivo_audio is not None
    )

    if es_audio:
        audio_bytes = b""
        filename = "nota_voz.webm"
        if archivo_audio is not None:
            audio_bytes = await archivo_audio.read()
            filename = archivo_audio.filename or "nota_voz.webm"

        transcripcion, modo_trans = transcribe_audio_bytes(
            audio_bytes,
            filename=filename,
            fallback_transcript=texto,
        )
        extraccion, modo_ext = extract_structured_solicitud(transcripcion)
        canal_origen = "whatsapp_audio"
        modo_ia = f"{modo_trans} + {modo_ext}"
    else:
        transcripcion = (texto or "").strip()
        if not transcripcion:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Escribe un mensaje o graba una nota de voz para enviar por WhatsApp.",
            )
        extraccion, modo_ext = extract_structured_solicitud(transcripcion)
        canal_origen = "whatsapp_texto"
        modo_ia = modo_ext

    final_phone = (remitente_telefono or telefono or "+57 300 000 0101").strip()
    final_name = nombre_remitente or remitente_nombre
    final_addr = direccion_remitente or direccion_referencia
    final_email = email_usuario or usuario_email

    solicitud, wa_reply = create_solicitud_from_whatsapp(
        db,
        sender_phone=final_phone,
        sender_name_hint=final_name,
        direccion_hint=final_addr,
        tipo_generador_hint=tipo_generador,
        usuario_email_hint=final_email,
        canal_origen=canal_origen,
        transcripcion=transcripcion,
        extraccion=extraccion,
        modo_ia=modo_ia,
    )

    coordinador_label = (
        f"{solicitud.coordinador.nombre} ({coordinator_label_for_flow(solicitud.flujo)})"
        if solicitud.coordinador
        else coordinator_label_for_flow(solicitud.flujo)
    )

    return SimulacionWhatsAppResponse(
        solicitud_id=solicitud.id,
        codigo=solicitud.codigo,
        codigo_solicitud=solicitud.codigo,
        flujo=solicitud.flujo,  # type: ignore[arg-type]
        canal_origen=canal_origen,  # type: ignore[arg-type]
        transcripcion=transcripcion,
        direccion=solicitud.direccion,
        confianza_ia=float(solicitud.confianza_ia or extraccion.confianza_ia),
        requiere_revision_humana=bool(solicitud.requiere_revision_humana),
        modo_ia=modo_ia,
        coordinador_asignado=coordinador_label,
        respuesta_whatsapp=wa_reply,
        respuesta_bot=wa_reply,
        extraccion=extraccion,
    )
