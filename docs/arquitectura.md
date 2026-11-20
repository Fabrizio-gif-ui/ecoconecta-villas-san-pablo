# Arquitectura del Sistema — EcoConecta · Villas de San Pablo

Alianza **Fundación Santo Domingo** y **Universidad Libre**.

## 1. Diagrama de Componentes y Servicios

```mermaid
flowchart TB
    subgraph Usuarios["Actores en Villas de San Pablo (Mobile-First 360px–430px)"]
        CIT["Hogar / Unidad Productiva\n(Portal Inclusivo + 🔊 Escuchar)"]
        CH["Coordinador de Huerteros\n(Flujo Orgánico)"]
        CR["Coordinador de Recicladores\n(Flujo Reciclable)"]
        ADM["Administrador\n(Supervisión, Reglas kg/lb, Beneficios, RN-08)"]
    end

    subgraph Frontend["Contenedor Frontend — Next.js 15 (App Router + Tailwind CSS)"]
        UI_PUB["Portal Ciudadano\n/, /ayuda, /solicitar, /mi-cuenta, /mis-puntos, /login"]
        UI_COORD["Página Alterna Protegida\n/coordinacion (Bandeja, Puntos del Equipo, Admin)"]
        TTS["SpeakButton\n(window.speechSynthesis es-CO)"]
        PROXY["Route Handler Proxy\n/api/v1/[...path]"]
    end

    subgraph Backend["Contenedor Backend — Python 3.12 + FastAPI"]
        AUTH["Router Auth & JWT RBAC\n(/api/v1/auth/*)"]
        PUB["Router Público & Centro de Ayuda\n(/api/v1/public/*)"]
        SOL["Router Ciudadano & Canjes\n(/api/v1/solicitudes/*)"]
        CRD["Router Coordinación & Puntos del Equipo\n(/api/v1/coordinacion/*)"]
        ADMIN["Router Administración\n(/api/v1/admin/*)"]
        SVC_SOL["Servicio de Dominio Solicitudes,\nPeso (kg/lb) y Acreditación Dual (RN-01..RN-08)"]
        SVC_WA["Servicio Desacoplado WhatsApp\n(Auto: Real Meta API / Simulado)"]
    end

    subgraph Data["Contenedor Base de Datos"]
        PG[("PostgreSQL 16\nSQLAlchemy 2 + Psycopg 3\n13 Tablas · NUMERIC(10,2)")]
    end

    subgraph External["Servicios Externos"]
        META["Meta WhatsApp Business\nCloud API (Graph API)"]
    end

    CIT --> UI_PUB
    UI_PUB --> TTS
    CH --> UI_COORD
    CR --> UI_COORD
    ADM --> UI_COORD

    UI_PUB --> PROXY
    UI_COORD --> PROXY
    PROXY -->|HTTP Interno / REST + JWT| AUTH & PUB & SOL & CRD & ADMIN

    AUTH --> PG
    PUB --> PG
    SOL --> SVC_SOL
    CRD --> SVC_SOL
    ADMIN --> PG

    SVC_SOL --> PG
    SVC_SOL --> SVC_WA
    SVC_WA -->|Si existen credenciales .env| META
    SVC_WA -->|Persistencia y auditoría| PG
```

---

## 2. Flujo de Intermediación, Peso (`kg` / `lb`) y Acreditación Dual

```mermaid
sequenceDiagram
    actor U as Usuario (Hogar / Unidad Productiva)
    participant FE as Frontend Inclusivo (Next.js)
    participant API as Backend FastAPI (RBAC)
    participant DB as PostgreSQL 16
    participant WA as WhatsApp Service (Meta / Simulado)
    actor C as Coordinador del Flujo

    U->>FE: Consulta /ayuda (toca "🔊 Escuchar") y abre /solicitar
    U->>FE: Completa datos y revisa pantalla "Revisa tus datos antes de enviar"
    FE->>API: POST /api/v1/solicitudes
    API->>DB: Valida RN-08, crea solicitud ECO-YYYY-NNNN y asigna coordinador (RN-01)
    API->>WA: Envía confirmación (solo menciona al coordinador intermediario)
    WA->>DB: Guarda en notificaciones_whatsapp

    C->>FE: Ingresa a /coordinacion y programa fecha, hora y encargado (RN-02 / RN-03)
    FE->>API: POST /api/v1/coordinacion/solicitudes/{id}/programar
    API->>DB: Actualiza a programada + historial_estados (RN-04)
    API->>WA: Notifica día/hora acordados al usuario (sin contacto del recolector)

    C->>FE: Diligencia Formulario de Cierre (solicitante, peso en kg o lb, encargado)
    FE->>API: POST /api/v1/coordinacion/solicitudes/{id}/cerrar
    API->>DB: Normaliza peso a kg (1 lb = 0.50 kg) y calcula puntos NUMERIC(10,2)
    API->>DB: Inserta registros_recoleccion + 2 movimientos_puntos (usuario + recolector)
    API->>WA: Confirma peso y puntos acreditados al solicitante
```

---

## 3. Flujo de Ingesta por WhatsApp (Notas de Voz / Audio y Texto) + OpenAI + Control Humano

```mermaid
sequenceDiagram
    actor V as Vecino / Tienda (WhatsApp o /whatsapp-demo)
    participant WH as FastAPI Webhook (/api/webhooks/whatsapp)
    participant AI as Servicio IA (OpenAI Whisper + GPT-4o-mini / Fallback Local)
    participant DB as PostgreSQL 16
    actor C as Coordinador Humano (/coordinacion)

    V->>WH: Envía Nota de Voz (.ogg/.webm/.mp3) o Texto
    WH->>AI: 1. Transcribe audio a español colombiano (whisper-1 / gpt-4o-mini-transcribe)
    WH->>AI: 2. Sanitiza texto (elimina teléfonos/PII) y envía SOLO texto a gpt-4o-mini (Structured Outputs)
    AI-->>WH: Devuelve JSON Pydantic (flujo, nombre, direccion, tipo_generador, horario, requiere_revision_humana)
    WH->>DB: Guarda Solicitud ECO-YYYY-NNNN (estado="recibida", canal_origen, transcripcion_original) + enruta RN-01
    WH-->>V: Responde por WhatsApp con código ECO-YYYY-NNNN y coordinador asignado
    C->>DB: Revisa en /coordinacion etiqueta "🎙️ Pedido por Audio WhatsApp" y lee/escucha transcripción exacta
    opt Si la IA o el vecino clasificó mal el residuo (Control Humano)
        C->>WH: POST /api/v1/coordinacion/solicitudes/{id}/reclasificar ("Mover a Recicladores / Huerteros")
        WH->>DB: Actualiza flujo, reasigna coordinador y registra auditoría en historial_estados (RN-04)
    end
```

### Decisiones de Diseño de IA, Privacidad y Control Humano

1. **Privacidad por diseño (Solo Texto Transcrito y Sanitizado):**
   - El módulo `backend/app/services/ai_extractor.py` ejecuta `sanitize_transcript_for_llm(transcripcion)` antes de llamar a `gpt-4o-mini`.
   - El número telefónico del remitente (`from` del webhook de Meta) y cualquier teléfono dictado dentro del audio se reemplazan por `[TELEFONO_RESERVADO]`, garantizando que **jamás se envíen teléfonos ni metadatos personales innecesarios** a la API externa de OpenAI (cumpliendo **RN-07**).
2. **Extracción Estructurada con Pydantic + Fallback Determinístico Local:**
   - Cuando `OPENAI_API_KEY` está configurada, utiliza `client.beta.chat.completions.parse(..., response_format=ExtraccionSolicitudWA)` con `gpt-4o-mini` para obtener una estructura tipada y validada.
   - Si `OPENAI_API_KEY` no está configurada en `.env` (o si la red falla), activa automáticamente `deterministic_keyword_parser()`, que clasifica residuos orgánicos (`cáscaras, comida, restos, abono, plátano, yuca, verdura`) frente a reciclables (`cartón, plástico, botellas, latas, vidrio, papel`) y detecta mezclas ambiguas (`requiere_revision_humana = true`).
3. **Control Humano Final en `/coordinacion` (Human-in-the-Loop):**
   - La IA nunca reemplaza la decisión operativa del líder comunitario: solo pre-clasifica la solicitud en estado `recibida` y guarda `transcripcion_original`, `confianza_ia` y `requiere_revision_humana`.
   - En `/coordinacion`, el coordinador lee o escucha (`🔊 Escuchar transcripción`) lo que dijo exactamente el vecino y puede pulsar **"Mover a Recicladores"** o **"Mover a Huerteros"** (`POST /api/v1/coordinacion/solicitudes/{id}/reclasificar`), dejando trazabilidad completa en `historial_estados`.

