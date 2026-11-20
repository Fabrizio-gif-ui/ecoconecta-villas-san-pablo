"""Cliente oficial en producción para WhatsApp Business Cloud API (Meta Graph API v21.0).

Configurado exclusivamente mediante variables de entorno:
- WHATSAPP_TOKEN (o WHATSAPP_ACCESS_TOKEN)
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_VERIFY_TOKEN
- WHATSAPP_API_VERSION (por defecto v21.0)
"""

from typing import Any, Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.whatsapp import whatsapp_service


class WhatsAppCloudClient:
    """Integración directa con Meta Graph API para WhatsApp Business Cloud."""

    @property
    def api_version(self) -> str:
        return (settings.WHATSAPP_API_VERSION or "v21.0").strip()

    @property
    def token(self) -> str:
        return settings.effective_whatsapp_token

    @property
    def phone_number_id(self) -> str:
        return (settings.WHATSAPP_PHONE_NUMBER_ID or "").strip()

    @property
    def verify_token(self) -> str:
        return (settings.WHATSAPP_VERIFY_TOKEN or "").strip()

    @property
    def is_configured(self) -> bool:
        return bool(self.token and self.phone_number_id)

    def verify_webhook_token(
        self,
        hub_mode: Optional[str],
        hub_verify_token: Optional[str],
        hub_challenge: Optional[str],
    ) -> Optional[str]:
        """Valida hub.mode == 'subscribe' y hub.verify_token == WHATSAPP_VERIFY_TOKEN."""
        if (
            hub_mode == "subscribe"
            and hub_verify_token
            and hub_verify_token.strip() == self.verify_token
        ):
            return hub_challenge or ""
        return None

    def get_media_url(self, media_id: str) -> tuple[str, str]:
        """Paso 1 Meta Audio: GET https://graph.facebook.com/{version}/{audio_id}
        con Bearer WHATSAPP_TOKEN para obtener la URL temporal del archivo.
        """
        if not self.token:
            raise RuntimeError("WHATSAPP_TOKEN no está configurado en el entorno.")

        meta_url = f"https://graph.facebook.com/{self.api_version}/{media_id}"
        headers = {"Authorization": f"Bearer {self.token}"}
        with httpx.Client(timeout=20.0) as client:
            res = client.get(meta_url, headers=headers)
            res.raise_for_status()
            info = res.json()
            media_url = info.get("url")
            mime_type = info.get("mime_type", "audio/ogg")
            if not media_url:
                raise RuntimeError("Meta Graph API no devolvió 'url' para el audio.")
            return str(media_url), str(mime_type)

    def download_audio_binary(self, audio_id: str) -> tuple[bytes, str]:
        """Pasos 2 y 3 Meta Audio: Obtiene la URL temporal y descarga el binario .ogg/.mp3
        con el mismo Bearer WHATSAPP_TOKEN.
        """
        media_url, mime_type = self.get_media_url(audio_id)
        headers = {"Authorization": f"Bearer {self.token}"}
        with httpx.Client(timeout=30.0) as client:
            audio_res = client.get(media_url, headers=headers)
            audio_res.raise_for_status()
            return audio_res.content, mime_type

    def send_text_message(
        self,
        db: Session,
        *,
        solicitud_id: Optional[int],
        flujo: str,
        destinatario_nombre: str,
        destinatario_telefono: str,
        tipo_evento: str,
        mensaje: str,
    ) -> Any:
        """Envía mensaje real de WhatsApp usando:
        POST https://graph.facebook.com/{version}/{PHONE_NUMBER_ID}/messages
        y registra la auditoría en PostgreSQL (`notificaciones_whatsapp`).
        """
        return whatsapp_service.send_message(
            db,
            solicitud_id=solicitud_id,
            flujo=flujo,
            destinatario_nombre=destinatario_nombre,
            destinatario_telefono=destinatario_telefono,
            tipo_evento=tipo_evento,
            mensaje=mensaje,
        )


whatsapp_cloud_client = WhatsAppCloudClient()
