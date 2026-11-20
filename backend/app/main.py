from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.routers import admin, auth, coordinacion, public, solicitudes, webhooks_whatsapp
from app.seed import run_seed

logger = logging.getLogger("ecoconecta")

FRIENDLY_FIELD_NAMES: dict[str, str] = {
    "nombre_solicitante": "tu nombre o el del negocio",
    "nombre_solicitante_verificado": "el nombre de la persona que pidió el servicio",
    "telefono_contacto": "tu número de WhatsApp o teléfono",
    "telefono": "tu número de WhatsApp o teléfono",
    "direccion": "tu dirección en Villas de San Pablo",
    "fecha_programada": "la fecha de recolección",
    "hora_programada": "la hora de recolección",
    "nombre_encargado": "el nombre de la persona encargada",
    "peso_ingresado": "el peso recolectado (mayor a 0)",
    "peso_kg": "el peso en kilogramos (mayor a 0)",
    "email": "un correo electrónico válido",
    "password": "la contraseña",
}


def ensure_schema_upgrades() -> None:
    """Garantiza que las columnas nuevas de ingesta por WhatsApp existan en volúmenes previos."""
    statements = [
        "ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS canal_origen VARCHAR(30) NOT NULL DEFAULT 'portal_web'",
        "ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS telefono_whatsapp VARCHAR(40)",
        "ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS nombre_whatsapp VARCHAR(150)",
        "ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS transcripcion_audio TEXT",
        "ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS transcripcion_original TEXT",
        "ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(120)",
        "ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS confianza_ia NUMERIC(4, 2)",
        "ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS requiere_revision_humana BOOLEAN NOT NULL DEFAULT FALSE",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
            except Exception as exc:
                logger.debug("Upgrade columna omitido: %s", exc)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_upgrades()
    if settings.AUTO_SEED:
        db = SessionLocal()
        try:
            summary = run_seed(db)
            logger.info("Auto-seed completado: %s", summary)
        finally:
            db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "API REST del MVP EcoConecta – Villas de San Pablo (Barranquilla, Colombia). "
        "Alianza Fundación Santo Domingo y Universidad Libre."
    ),
    lifespan=lifespan,
)


@app.exception_handler(RequestValidationError)
async def friendly_validation_exception_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    """Convierte errores de validación en mensajes cálidos y claros sin jerga técnica."""
    friendly_messages: list[str] = []
    for err in exc.errors():
        loc = err.get("loc", ())
        field_key = str(loc[-1]) if loc else ""
        friendly_field = FRIENDLY_FIELD_NAMES.get(field_key, field_key or "el campo")
        msg = str(err.get("msg", ""))
        if "greater than 0" in msg or "gt" in str(err.get("type", "")):
            friendly_messages.append(
                f"Por favor escribe un valor mayor a 0 en {friendly_field}."
            )
        elif "Field required" in msg or "missing" in str(err.get("type", "")):
            friendly_messages.append(f"Nos falta {friendly_field} para poder continuar.")
        else:
            friendly_messages.append(f"Por favor revisa {friendly_field}.")

    summary = (
        " ".join(dict.fromkeys(friendly_messages))
        if friendly_messages
        else "Por favor revisa los datos del formulario e intenta de nuevo."
    )
    return JSONResponse(
        status_code=422,
        content={"detail": summary},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
app.include_router(public.router, prefix=API_PREFIX)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(solicitudes.router, prefix=API_PREFIX)
app.include_router(coordinacion.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
# Expone el webhook de WhatsApp tanto en /api/webhooks/whatsapp como en /api/v1/webhooks/whatsapp
app.include_router(webhooks_whatsapp.router, prefix="/api")
app.include_router(webhooks_whatsapp.router, prefix=API_PREFIX)


@app.get("/")
def root() -> dict:
    return {
        "app": settings.APP_NAME,
        "docs": "/docs",
        "health": "/api/v1/health",
        "whatsapp_webhook": "/api/webhooks/whatsapp",
    }
