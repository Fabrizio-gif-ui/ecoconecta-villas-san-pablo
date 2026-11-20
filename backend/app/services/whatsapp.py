import re
from typing import Any, Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import NotificacionWhatsApp


def normalize_phone_e164(phone: str, default_country_code: str = "57") -> str:
    digits = re.sub(r"\D+", "", phone or "")
    if not digits:
        return ""
    if len(digits) == 10 and not digits.startswith(default_country_code):
        return f"{default_country_code}{digits}"
    return digits


class WhatsAppService:
    """Servicio desacoplado para WhatsApp Business Cloud API (Meta).

    - Si existen WHATSAPP_TOKEN (o WHATSAPP_ACCESS_TOKEN) y WHATSAPP_PHONE_NUMBER_ID,
      realiza envío real y descarga de audios contra Meta Graph API.
    - Si no hay credenciales configuradas, opera en modo simulación persistiendo el registro
      completo en PostgreSQL (`notificaciones_whatsapp`) para inspección en la demo.
    """

    def send_message(
        self,
        db: Session,
        *,
        solicitud_id: Optional[int],
        flujo: str,
        destinatario_nombre: str,
        destinatario_telefono: str,
        tipo_evento: str,
        mensaje: str,
    ) -> NotificacionWhatsApp:
        phone_e164 = normalize_phone_e164(
            destinatario_telefono, settings.WHATSAPP_DEFAULT_COUNTRY_CODE
        )
        effective_mode = settings.whatsapp_effective_mode
        token = settings.effective_whatsapp_token

        modo = "simulado"
        estado_envio = "simulado"
        respuesta_api: dict[str, Any] = {
            "simulated": True,
            "provider": "Meta WhatsApp Business Cloud API (modo simulación)",
            "to": phone_e164,
            "event": tipo_evento,
        }

        if effective_mode == "real" and settings.whatsapp_has_credentials and phone_e164:
            modo = "real"
            url = (
                f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/"
                f"{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
            )
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            body = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": phone_e164,
                "type": "text",
                "text": {"preview_url": False, "body": mensaje},
            }
            try:
                with httpx.Client(timeout=10.0) as client:
                    response = client.post(url, headers=headers, json=body)
                try:
                    response_json = response.json()
                except Exception:
                    response_json = {"raw_text": response.text}

                if 200 <= response.status_code < 300:
                    estado_envio = "enviado"
                else:
                    estado_envio = "error"
                respuesta_api = {
                    "http_status": response.status_code,
                    "response": response_json,
                }
            except Exception as exc:
                estado_envio = "error"
                respuesta_api = {"error": str(exc)}
        elif effective_mode == "real" and not settings.whatsapp_has_credentials:
            modo = "simulado"
            estado_envio = "simulado"
            respuesta_api = {
                "simulated": True,
                "reason": "WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurados; fallback a simulación",
                "to": phone_e164,
            }

        registro = NotificacionWhatsApp(
            solicitud_id=solicitud_id,
            flujo=flujo,
            destinatario_nombre=destinatario_nombre,
            destinatario_telefono=destinatario_telefono,
            tipo_evento=tipo_evento,
            mensaje=mensaje,
            modo=modo,
            estado_envio=estado_envio,
            respuesta_api=respuesta_api,
        )
        db.add(registro)
        db.flush()
        return registro

    def download_meta_media(self, media_id: str) -> tuple[bytes, str]:
        """Descarga un archivo de audio (nota de voz .ogg/.mp3/.webm) desde Meta Graph API."""
        token = settings.effective_whatsapp_token
        if not token:
            return b"", "audio/ogg"

        meta_url = f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/{media_id}"
        headers = {"Authorization": f"Bearer {token}"}
        with httpx.Client(timeout=20.0) as client:
            info_res = client.get(meta_url, headers=headers)
            info_res.raise_for_status()
            info_data = info_res.json()
            download_url = info_data.get("url")
            mime_type = info_data.get("mime_type", "audio/ogg")
            if not download_url:
                return b"", mime_type
            media_res = client.get(download_url, headers=headers)
            media_res.raise_for_status()
            return media_res.content, mime_type


whatsapp_service = WhatsAppService()
