"""Servicio de Transcripción de Audio y Extracción Estructurada con IA (OpenAI SDK oficial)
con Modo Fallback Determinístico de palabras clave cuando OPENAI_API_KEY no está configurada.

Privacidad por diseño (RN-07):
- Jamás se envía el número de teléfono ni metadatos de cuenta del ciudadano al modelo.
- Antes de invocar a `gpt-4o-mini`, `sanitize_transcript_for_llm()` enmascara cualquier
  secuencia numérica de teléfono o correo que el usuario haya dictado accidentalmente.
"""

import io
import logging
import re
from typing import Optional

from openai import OpenAI

from app.core.config import settings
from app.schemas.schemas import ExtraccionSolicitudWA

logger = logging.getLogger("ecoconecta.ai")

ORGANIC_KEYWORDS = (
    "cáscara",
    "cascara",
    "comida",
    "resto",
    "abono",
    "huerta",
    "orgánico",
    "organico",
    "verdura",
    "fruta",
    "plátano",
    "platano",
    "guineo",
    "yuca",
    "papa",
    "mango",
    "patilla",
    "tomate",
    "cebolla",
    "café",
    "cafe",
    "borra",
    "huevo",
    "hoja",
    "poda",
    "compost",
    "vegetal",
)

RECYCLABLE_KEYWORDS = (
    "cartón",
    "carton",
    "plástico",
    "plastico",
    "botella",
    "pet",
    "lata",
    "aluminio",
    "vidrio",
    "papel",
    "cuaderno",
    "periódico",
    "periodico",
    "reciclable",
    "reciclar",
    "reciclaje",
    "caja",
    "frasco",
    "tarro",
    "envase",
    "chatarra",
)

BUSINESS_KEYWORDS = (
    "tienda",
    "comedor",
    "restaurante",
    "negocio",
    "frutería",
    "fruteria",
    "panadería",
    "panaderia",
    "local",
    "mercado",
    "unidad productiva",
    "puesto",
)


def sanitize_transcript_for_llm(texto: str) -> str:
    """Elimina números telefónicos y correos electrónicos antes de enviar el texto al LLM."""
    without_emails = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "[CORREO_OCULTO]", texto)
    without_phones = re.sub(r"(?:\+?57\s*)?\b3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b", "[TEL_OCULTO]", without_emails)
    return without_phones.strip()


def transcribe_audio_bytes(
    audio_bytes: bytes,
    filename: str = "nota_voz.webm",
    fallback_transcript: Optional[str] = None,
) -> tuple[str, str]:
    """Transcribe una nota de voz a español colombiano usando OpenAI (`whisper-1` o `gpt-4o-mini-transcribe`).
    Si no hay `OPENAI_API_KEY` configurada, utiliza la transcripción de respaldo del navegador o demo.
    Retorna: (texto_transcrito, modo_transcripcion)
    """
    if settings.openai_has_credentials and audio_bytes and len(audio_bytes) > 64:
        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            file_obj = io.BytesIO(audio_bytes)
            file_obj.name = filename
            transcription = client.audio.transcriptions.create(
                model=settings.OPENAI_TRANSCRIBE_MODEL,
                file=file_obj,
                language="es",
                prompt=(
                    "Solicitud comunitaria de recolección de residuos orgánicos para la huerta "
                    "o reciclables en Villas de San Pablo, Barranquilla, Colombia."
                ),
            )
            text = (transcription.text or "").strip()
            if text:
                return text, f"openai:{settings.OPENAI_TRANSCRIBE_MODEL}"
        except Exception as exc:
            logger.warning("Fallo transcripción OpenAI, usando fallback local: %s", exc)

    cleaned_fallback = (fallback_transcript or "").strip()
    if cleaned_fallback:
        return cleaned_fallback, "fallback_transcripcion_local"

    return (
        "Hola, hablo desde Villas de San Pablo para pedir recolección de residuos separados en casa.",
        "fallback_audio_demo",
    )


def deterministic_keyword_parser(transcripcion: str) -> ExtraccionSolicitudWA:
    """Parser determinístico de palabras clave cuando OPENAI_API_KEY no está configurada."""
    text_clean = transcripcion.strip()
    lower = text_clean.lower()

    org_hits = sum(1 for kw in ORGANIC_KEYWORDS if kw in lower)
    rec_hits = sum(1 for kw in RECYCLABLE_KEYWORDS if kw in lower)

    requiere_revision = False
    confianza = 0.90

    if org_hits > 0 and rec_hits == 0:
        flujo = "organico"
        confianza = min(0.78 + org_hits * 0.05, 0.96)
    elif rec_hits > 0 and org_hits == 0:
        flujo = "reciclable"
        confianza = min(0.78 + rec_hits * 0.05, 0.96)
    elif org_hits > 0 and rec_hits > 0:
        # Mezcla ambos tipos de residuos en un mismo audio: marcar para revisión humana
        flujo = "organico" if org_hits >= rec_hits else "reciclable"
        requiere_revision = True
        confianza = 0.58
    else:
        flujo = "reciclable"
        requiere_revision = True
        confianza = 0.45

    # Tipo de generador
    tipo_generador = (
        "unidad_productiva"
        if any(bkw in lower for bkw in BUSINESS_KEYWORDS)
        else "hogar"
    )

    # Dirección en Villas de San Pablo
    direccion: Optional[str] = None
    dir_match = re.search(
        r"((?:manzana|mz\.?)\s*\d+[^.,;\n]{0,60})",
        text_clean,
        flags=re.IGNORECASE,
    )
    if dir_match:
        direccion = f"{dir_match.group(1).strip()}, Villas de San Pablo"
    elif "villas de san pablo" in lower:
        direccion = "Villas de San Pablo, Barranquilla"

    # Nombre del solicitante si lo menciona en el mensaje
    nombre: Optional[str] = None
    name_match = re.search(
        r"(?:soy|mi nombre es|les habla|de parte de|habla)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]{2,40}?)(?:[,.;]|\s+de\s+|\s+en\s+|\s+desde\s+|\s+para\s+|\s+y\s+tengo|$)",
        text_clean,
        flags=re.IGNORECASE,
    )
    if name_match:
        candidate = name_match.group(1).strip()
        if len(candidate) >= 3:
            nombre = candidate.title()

    # Preferencia horaria
    preferencia: Optional[str] = None
    if "mañana" in lower or "manana" in lower:
        preferencia = "En la mañana (7:30 a.m. – 11:00 a.m.)"
    elif "tarde" in lower:
        preferencia = "En la tarde (2:00 p.m. – 5:00 p.m.)"
    elif "sábado" in lower or "sabado" in lower:
        preferencia = "Sábado en la mañana (8:00 a.m. – 12:00 m.)"

    if not direccion:
        requiere_revision = True

    resumen = (
        text_clean[:240]
        if len(text_clean) <= 240
        else f"{text_clean[:237]}..."
    )

    return ExtraccionSolicitudWA(
        flujo=flujo,  # type: ignore[arg-type]
        nombre_solicitante=nombre,
        direccion=direccion,
        direccion_mencionada=direccion,
        tipo_generador=tipo_generador,  # type: ignore[arg-type]
        preferencia_horaria=preferencia,
        observaciones=resumen,
        resumen_residuos=resumen,
        requiere_revision_humana=requiere_revision,
        confianza_ia=round(confianza, 2),
    )


def extract_structured_solicitud(
    transcripcion: str,
) -> tuple[ExtraccionSolicitudWA, str]:
    """Extrae los campos estructurados de una solicitud a partir del texto transcrito.
    Envía ÚNICAMENTE el texto sanitizado (sin teléfono ni PII de cuenta) a `gpt-4o-mini`
    con Structured Outputs (Pydantic). Si no hay `OPENAI_API_KEY`, usa el parser determinístico.
    """
    sanitized_text = sanitize_transcript_for_llm(transcripcion)

    if settings.openai_has_credentials and sanitized_text:
        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            completion = client.beta.chat.completions.parse(
                model=settings.OPENAI_EXTRACT_MODEL,
                temperature=0.1,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Eres un asistente comunitario de EcoConecta en el barrio Villas de San Pablo "
                            "(Barranquilla, Colombia). Analiza el mensaje o transcripción de voz de un vecino "
                            "o negocio y extrae los datos de su pedido de recolección.\n"
                            "- Si menciona cáscaras, restos de comida cruda, verduras, frutas, café o abono para la huerta, "
                            "clasifica `flujo` como 'organico'.\n"
                            "- Si menciona cartón, botellas PET, plástico, papel, cuadernos, latas o vidrio, "
                            "clasifica `flujo` como 'reciclable'.\n"
                            "- Si mezcla ambos flujos, es ambiguo o faltan datos clave como la dirección, marca "
                            "`requiere_revision_humana = true`."
                        ),
                    },
                    {
                        "role": "user",
                        "content": sanitized_text,
                    },
                ],
                response_format=ExtraccionSolicitudWA,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is not None:
                return parsed, f"openai:{settings.OPENAI_EXTRACT_MODEL}"
        except Exception as exc:
            logger.warning("Fallo extracción estructurada OpenAI, usando parser determinístico: %s", exc)

    return deterministic_keyword_parser(sanitized_text), "fallback_palabras_clave"
