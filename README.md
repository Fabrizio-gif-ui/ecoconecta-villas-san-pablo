# EcoConecta – Villas de San Pablo (MVP Inclusivo)

Plataforma web responsive (**mobile-first 360px–430px**) para conectar hogares y unidades productivas de **Villas de San Pablo (Barranquilla, Colombia)** con los colectivos comunitarios de **huerteros** (residuos orgánicos) y **recicladores de oficio** (residuos reciclables), en alianza con la **Fundación Santo Domingo** y la **Universidad Libre**, e inspirada en [Cataki](https://www.cataki.org/) y su centro de dudas (`cataki.org/posts/duvidas/`).

> **Principio rector de privacidad e intermediación:** Los hogares y unidades productivas nunca se comunican directamente con los huerteros ni recicladores. Toda solicitud, programación y notificación ocurre **exclusivamente** con el coordinador del colectivo correspondiente (`coordinador_huerteros` o `coordinador_recicladores`), quien opera desde la página alterna protegida `/coordinacion`.

---

## Principios de UX Inclusivo Implementados

- **Mobile-first real (`360px–430px`) y ligero para datos móviles:** SVGs livianos, tipografía base mínima de `16px`, alto contraste WCAG AA y botones táctiles grandes (`min-h-[48px]`).
- **Lenguaje claro y cálido en español colombiano:** sin jerga técnica en ninguna vista ni mensaje de validación.
- **Ícono + etiqueta de texto siempre:** todos los botones, menús y materiales llevan ícono acompañado de texto visible.
- **Lectura en voz alta (`🔊 Escuchar` / `⏹ Detener`):** componente reutilizable `SpeakButton` con `window.speechSynthesis` (`es-CO`/`es-ES`, sin APIs externas) en las tarjetas de `/ayuda`, los 4 pasos de inicio, la guía de separación y la confirmación de pedidos.
- **Eliminar el miedo a equivocarse:** botón visible **`← Volver`** en cada paso, validación amigable campo por campo y pantalla de resumen ***"Revisa tus datos antes de enviar"*** en `/solicitar`.

---

## Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 3 |
| **Backend** | Python 3.12 · FastAPI · SQLAlchemy 2.0 · Psycopg 3 · Pydantic v2 · PyJWT · OpenAI SDK |
| **Base de datos** | PostgreSQL 16 (`NUMERIC(10,2)` para pesos y puntajes decimales) |
| **IA & Mensajería** | WhatsApp Business Cloud API (Webhook + envío) + OpenAI API (`whisper-1` / `gpt-4o-mini` Structured Outputs + fallback determinístico local) |
| **Contenedores** | Docker & `docker-compose.yml` (PostgreSQL + Backend + Frontend) |

---

## Inicio Rápido con Docker

### 1. Configurar variables de entorno
Copia el archivo de ejemplo (sin credenciales reales):

```bash
cp .env.example .env
```

*(En PowerShell: `Copy-Item .env.example .env`)*

### 2. Levantar toda la plataforma

```bash
docker compose up --build
```

Al iniciar, el backend crea automáticamente las 13 tablas en PostgreSQL y ejecuta `seed.py` (si `AUTO_SEED=true`) con datos **100 % ficticios** listos para la demostración.

### 3. URLs locales
- **Inicio / Landing Ciudadana:** `http://localhost:3000`
- **Simulador de WhatsApp con Micrófono en Vivo (Audio y Texto):** `http://localhost:3000/whatsapp-demo`
- **Centro de Ayuda, Reglamentos y Dudas (`🔊 Escuchar`):** `http://localhost:3000/ayuda`
- **Pedir Recolección (con revisión previa):** `http://localhost:3000/solicitar`
- **Mis Puntos y Beneficios:** `http://localhost:3000/mis-puntos`
- **Página Alterna de Coordinadores:** `http://localhost:3000/coordinacion`
- **Acceso Rápido Demo (Login):** `http://localhost:3000/login`
- **Swagger / OpenAPI Backend:** `http://localhost:8000/docs`

---

## Solicitud de Recolección por WhatsApp (Notas de Voz / Audio y Texto) + OpenAI + Control Humano

1. **Webhook Oficial y Simulador con Micrófono (`GET/POST /api/webhooks/whatsapp` y `POST /api/webhooks/whatsapp/simular`):**
   - Recibe mensajes entrantes de WhatsApp Business Cloud API de tipo `text` y `audio` (`.ogg`, `.mp3`, `.webm`, `.wav`).
   - En `/whatsapp-demo`, cualquier evaluador puede seleccionar un usuario ficticio (*Tienda La Esquina Verde*, *Familia Martínez*, *Comedor Sabor Caribeño*), **grabar una nota de voz real desde el micrófono del navegador (`MediaRecorder` API)** o usar notas de voz de prueba en 1 toque.
2. **Transcripción y Extracción Estructurada con Privacidad por Diseño (OpenAI API):**
   - Si el mensaje es audio, el backend lo descarga desde Meta Graph API (o recibe el archivo desde `/whatsapp-demo`) y lo transcribe a español colombiano con `whisper-1` / `gpt-4o-mini-transcribe`.
   - **Privacidad estricta:** Antes de invocar a `gpt-4o-mini` con **Structured Outputs (Pydantic)**, la función `sanitize_transcript_for_llm()` enmascara cualquier teléfono en el texto y **jamás envía el número telefónico ni metadatos personales del remitente** al modelo externo.
   - **Modo Fallback Determinístico sin API Key:** Si `OPENAI_API_KEY` está vacía en `.env`, activa automáticamente un parser determinístico de palabras clave (`cáscaras, comida, restos, abono` → `organico`; `cartón, plástico, botellas, latas, vidrio` → `reciclable`) para que el flujo nunca falle en pruebas locales.
3. **Enrutamiento Automático (RN-01 / RN-04) y Control Humano en `/coordinacion`:**
   - Guarda en PostgreSQL (`solicitudes`) con código único `ECO-2026-XXXX`, `canal_origen` (`whatsapp_audio` o `whatsapp_texto`), `transcripcion_original`, `confianza_ia` y `requiere_revision_humana`, asignándola al coordinador correspondiente.
   - En `/coordinacion`, cada pedido muestra la etiqueta **🎙️ Pedido por Audio WhatsApp** o **💬 Pedido por WhatsApp**, la **transcripción exacta** (con botón **🔊 Escuchar transcripción**) y el botón de **Control Humano frente a errores de IA** (*“Mover a Recicladores”* / *“Mover a Huerteros”*), que reclasifica el flujo y registra la trazabilidad en `historial_estados`.

---

## Sistema de Puntaje Dual (`kg` / `lb`) y Beneficios (RN-05 y RN-06)

- **Regla de cálculo (`NUMERIC(10,2)`):**
  - `1 kilogramo (kg) = 1.0 punto`
  - `1 libra (500 g) = 0.5 puntos` (ej. `3 libras = 1.50 kg = 1.5 puntos`)
- **Acreditación dual al cerrar (RN-05):** solo cuando el coordinador guarda el cierre (`recolectada`) en `/coordinacion`, se acreditan los puntos simultáneamente al **usuario solicitante** y al **recolector/huertero encargado** en `movimientos_puntos`.
- **Niveles de beneficios (`beneficios`):**
  - **Usuarios:** `10 pts` (*Semilla – Abono de la huerta*), `25 pts` (*Brote – Descuento en comercio aliado / kit de separación*), `50 pts` (*Árbol – Canasta de huerta / bono comunitario*).
  - **Recicladores y Huerteros:** `30 pts` (*Aliado Activo – Kit de protección*), `75 pts` (*Líder Circular – Bono de alimentación / mantenimiento carretilla*), `150 pts` (*Guardián Verde – Dotación operativa*).

> **Nota legal/académica obligatoria (RN-06):** *"Cálculo de puntos y beneficios referenciales y parametrizables; valores sujetos a validación oficial de la Fundación Santo Domingo"*.

---

## Cuentas Demo (100 % Ficticias)

La pantalla `/login` incluye botones de **"Acceso rápido demo"** en 1 toque. Clave manual para todas las cuentas semilla: `EcoDemo2026!`.

| Rol | Correo | Flujo / Alcance |
| :--- | :--- | :--- |
| **Unidad Productiva Piloto** (`unidad_productiva`) | `piloto@villas.demo` | Comedor piloto (`32.0 pts` iniciales; niveles Semilla y Brote listos para canje). |
| **Hogar** (`hogar`) | `hogar@villas.demo` | Familia vecina (`11.5 pts` por entrega de `23 lb`; nivel Semilla listo para canje). |
| **Coordinador de Huerteros** (`coordinador_huerteros`) | `coord.huerta@villas.demo` | Acceso a `/coordinacion` — bandeja exclusiva `organico` (RN-01) y **Puntos del Equipo**. |
| **Coordinador de Recicladores** (`coordinador_recicladores`) | `coord.reciclaje@villas.demo` | Acceso a `/coordinacion` — bandeja exclusiva `reciclable` (RN-01) y **Puntos del Equipo**. |
| **Administrador** (`administrador`) | `admin@villas.demo` | Supervisión global, edición de reglas kg/lb, catálogo de beneficios (RN-06) y piloto (RN-08). |

---

## Variables de Entorno (sin valores reales)

Consulta [.env.example](.env.example):
- **PostgreSQL:** `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`
- **Backend:** `DATABASE_URL`, `SECRET_KEY`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`, `AUTO_SEED`, `ENABLE_DEMO_QUICK_LOGIN`, `BACKEND_PORT`
- **OpenAI API (Transcripción de Audio y Structured Outputs):** `OPENAI_API_KEY`, `OPENAI_TRANSCRIBE_MODEL` (`whisper-1` / `gpt-4o-mini-transcribe`), `OPENAI_EXTRACT_MODEL` (`gpt-4o-mini`)
- **WhatsApp Business Cloud API:** `WHATSAPP_MODE` (`auto` | `simulation` | `real`), `WHATSAPP_API_VERSION`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_DEFAULT_COUNTRY_CODE`
- **Frontend:** `FRONTEND_PORT`, `NEXT_PUBLIC_API_URL`, `INTERNAL_API_URL`, `NEXT_PUBLIC_APP_NAME`

---

## Funciones Implementadas vs. Simuladas

- **Implementadas 100 %:** Portal ciudadano inclusivo, síntesis de voz nativa (`window.speechSynthesis`), Centro de Ayuda `/ayuda` respaldado en PostgreSQL, asistente de solicitud con pantalla de revisión previa, autenticación JWT + RBAC, reglas RN-01 a RN-08, consola `/coordinacion`, cierre en `kg`/`lb`, acreditación dual, catálogo y canje de beneficios, exportación CSV y pruebas `pytest`.
- **Simulada cuando no hay credenciales en `.env`:** El servicio de **WhatsApp Business Cloud API** (`backend/app/services/whatsapp.py`) envía mensajes reales a Meta Graph API si se configuran `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`; si están vacíos, guarda cada notificación en modo `simulado` dentro de PostgreSQL (`notificaciones_whatsapp`) para visualizarla en la pestaña **WhatsApp** de `/coordinacion`.

---

## Pruebas Automatizadas

```bash
docker compose exec backend pytest -v
```

---

## Documentación Técnica

- [Arquitectura del sistema (Mermaid)](docs/arquitectura.md)
- [Modelo relacional de PostgreSQL (Diagrama ER)](docs/modelo_datos.md)

---

## Guía de Despliegue en Nube

1. **PostgreSQL gestionado:** Provisiona PostgreSQL 16 (Cloud SQL, RDS, Neon o Render) y configura `DATABASE_URL`.
2. **Backend FastAPI:** Despliega `./backend/Dockerfile` en Cloud Run, Render o Railway con `SECRET_KEY` aleatoria segura, `ENABLE_DEMO_QUICK_LOGIN=false` en producción real y credenciales de Meta WhatsApp Cloud API.
3. **Frontend Next.js:** Despliega `./frontend/Dockerfile` definiendo `INTERNAL_API_URL=https://tu-backend.ejemplo.com` para que el proxy `/api/v1` enrute hacia FastAPI.
