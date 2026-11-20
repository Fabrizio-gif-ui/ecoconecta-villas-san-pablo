# Modelo de Datos Relacional (PostgreSQL) — EcoConecta

La base de datos está implementada en **PostgreSQL 16** mediante **SQLAlchemy 2.0** y **Psycopg 3**, con tipo `NUMERIC(10,2)` para pesos y puntajes decimales (`0.5`, `1.5`, etc.).

## Diagrama Entidad-Relación (Mermaid)

```mermaid
erDiagram
    usuarios ||--o{ solicitudes : "crea (usuario_id)"
    usuarios ||--o{ solicitudes : "coordina (coordinador_id)"
    usuarios ||--o{ integrantes_colectivo : "gestiona (coordinador_id)"
    integrantes_colectivo ||--o{ solicitudes : "asignado (encargado_id)"
    solicitudes ||--o| registros_recoleccion : "se cierra con"
    usuarios ||--o{ registros_recoleccion : "registra (coordinador_id)"
    integrantes_colectivo ||--o{ registros_recoleccion : "ejecuta (encargado_id)"
    solicitudes ||--o{ historial_estados : "audita (RN-04)"
    usuarios ||--o{ historial_estados : "ejecuta cambio"
    solicitudes ||--o{ mensajes_coordinacion : "contiene"
    usuarios ||--o{ mensajes_coordinacion : "envia"
    solicitudes ||--o{ notificaciones_whatsapp : "dispara"
    registros_recoleccion ||--o{ movimientos_puntos : "acreditacion dual (RN-05)"
    solicitudes ||--o{ movimientos_puntos : "vincula"
    usuarios ||--o{ movimientos_puntos : "billetera usuario"
    integrantes_colectivo ||--o{ movimientos_puntos : "billetera recolector"
    beneficios ||--o{ movimientos_puntos : "debito por canje"
    beneficios ||--o{ canjes_beneficios : "se canjea en"
    usuarios ||--o{ canjes_beneficios : "canje usuario"
    integrantes_colectivo ||--o{ canjes_beneficios : "canje recolector"
    usuarios ||--o{ reglas_puntos : "parametriza (RN-06)"
    temas_ayuda ||--o{ preguntas_ayuda : "contiene"

    usuarios {
        serial id PK
        varchar nombre
        varchar email UK
        varchar password_hash
        varchar rol "hogar | unidad_productiva | coordinador_huerteros | coordinador_recicladores | administrador"
        varchar telefono
        varchar direccion
        varchar barrio_sector
        boolean es_piloto "RN-08"
        boolean habilitado_solicitudes "RN-08"
        boolean activo
        timestamptz creado_en
    }

    integrantes_colectivo {
        serial id PK
        varchar nombre
        varchar flujo "organico | reciclable"
        varchar rol_interno
        varchar zona_cobertura
        integer coordinador_id FK
        boolean activo
        timestamptz creado_en
    }

    solicitudes {
        serial id PK
        varchar codigo UK "ECO-2026-0001"
        integer usuario_id FK
        integer coordinador_id FK
        integer encargado_id FK
        varchar nombre_solicitante
        varchar telefono_contacto
        varchar direccion
        varchar tipo_generador "hogar | unidad_productiva"
        varchar flujo "organico | reciclable"
        varchar estado "recibida | en_revision | asignada | programada | recolectada | cancelada"
        varchar canal_origen "portal_web | whatsapp_audio | whatsapp_texto"
        text transcripcion_original "Transcripcion exacta del audio o texto WhatsApp"
        numeric confianza_ia "NUMERIC(4,2) 0.00 a 1.00"
        boolean requiere_revision_humana "true si requiere validacion del coordinador"
        varchar preferencia_horaria
        text observaciones
        date fecha_programada "RN-02"
        varchar hora_programada "RN-02"
        varchar nombre_encargado "RN-02 / RN-03"
        timestamptz creado_en
        timestamptz actualizado_en
    }

    registros_recoleccion {
        serial id PK
        integer solicitud_id UK,FK
        integer coordinador_id FK
        integer encargado_id FK
        varchar nombre_solicitante_verificado
        numeric peso_ingresado "NUMERIC(10,2) CHECK > 0"
        varchar unidad_medida "kg | lb"
        numeric peso_kg "NUMERIC(10,2) normalizado (1 lb = 0.50 kg)"
        varchar nombre_encargado
        timestamptz fecha_hora_recoleccion
        text observaciones
        numeric puntos_calculados "NUMERIC(10,2)"
        timestamptz creado_en
    }

    historial_estados {
        serial id PK
        integer solicitud_id FK
        varchar estado_anterior
        varchar estado_nuevo
        integer usuario_id FK
        text comentario
        timestamptz creado_en
    }

    reglas_puntos {
        serial id PK
        varchar flujo UK "organico | reciclable"
        numeric puntos_base "NUMERIC(10,2) default 0.00"
        numeric puntos_por_kg "NUMERIC(10,2) default 1.00"
        numeric puntos_por_libra "NUMERIC(10,2) default 0.50"
        varchar descripcion
        boolean activo
        integer actualizado_por_id FK
        timestamptz actualizado_en
    }

    beneficios {
        serial id PK
        varchar tipo_destinatario "usuario | recolector"
        varchar nombre
        text descripcion
        numeric puntos_requeridos "NUMERIC(10,2) CHECK > 0"
        boolean activo
        timestamptz creado_en
        timestamptz actualizado_en
    }

    canjes_beneficios {
        serial id PK
        integer beneficio_id FK
        varchar tipo_destinatario "usuario | recolector"
        integer usuario_id FK
        integer integrante_colectivo_id FK
        integer registrado_por_id FK
        numeric puntos_canjeados "NUMERIC(10,2)"
        varchar estado
        text observaciones
        timestamptz creado_en
    }

    movimientos_puntos {
        serial id PK
        varchar tipo_destinatario "usuario | recolector"
        varchar tipo_movimiento "credito | canje"
        integer usuario_id FK
        integer integrante_colectivo_id FK
        integer solicitud_id FK
        integer registro_recoleccion_id FK
        integer beneficio_id FK
        varchar flujo
        numeric peso_ingresado "NUMERIC(10,2)"
        varchar unidad_medida "kg | lb"
        numeric peso_kg "NUMERIC(10,2)"
        numeric puntos "NUMERIC(10,2) (+credito / -canje)"
        varchar regla_aplicada
        timestamptz creado_en
    }

    mensajes_coordinacion {
        serial id PK
        integer solicitud_id FK
        integer remitente_id FK
        varchar rol_remitente
        text contenido
        timestamptz creado_en
    }

    notificaciones_whatsapp {
        serial id PK
        integer solicitud_id FK
        varchar flujo
        varchar destinatario_nombre
        varchar destinatario_telefono
        varchar tipo_evento
        text mensaje
        varchar modo "real | simulado"
        varchar estado_envio "enviado | simulado | error"
        jsonb respuesta_api
        timestamptz creado_en
    }

    guia_residuos {
        serial id PK
        varchar nombre
        varchar flujo "organico | reciclable | no_aprovechable"
        varchar categoria
        varchar icono
        text descripcion
        text buenas_practicas
        varchar horario_referencia
    }

    temas_ayuda {
        serial id PK
        varchar slug UK
        varchar titulo
        varchar subtitulo
        varchar icono
        integer orden
    }

    preguntas_ayuda {
        serial id PK
        integer tema_id FK
        varchar pregunta
        jsonb puntos_clave
        varchar flujo_relacionado
        integer orden
    }
```
