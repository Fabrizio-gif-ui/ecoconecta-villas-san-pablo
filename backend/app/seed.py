"""Seed automático idempotente con datos 100% ficticios para la demo de EcoConecta – Villas de San Pablo."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.entities import (
    Beneficio,
    EstadoSolicitud,
    GuiaResiduo,
    HistorialEstado,
    IntegranteColectivo,
    MensajeCoordinacion,
    MovimientoPuntos,
    NotificacionWhatsApp,
    PreguntaAyuda,
    RegistroRecoleccion,
    ReglaPuntos,
    RolUsuario,
    Solicitud,
    TemaAyuda,
    Usuario,
)

DEMO_PASSWORD = "EcoDemo2026!"


def run_seed(db: Session) -> dict:
    created_summary = {
        "usuarios": 0,
        "integrantes": 0,
        "reglas_puntos": 0,
        "beneficios": 0,
        "guia_residuos": 0,
        "temas_ayuda": 0,
        "solicitudes": 0,
    }

    # 1. Usuarios ficticios de la demo
    users_spec = [
        {
            "email": "piloto@villas.demo",
            "nombre": "Comedor Comunitario Sabor Caribeño",
            "rol": RolUsuario.UNIDAD_PRODUCTIVA.value,
            "telefono": "+57 300 000 0101",
            "direccion": "Manzana 14, Casa 8, Sector Las Palmas, Villas de San Pablo",
            "barrio_sector": "Villas de San Pablo - Sector Las Palmas",
            "es_piloto": True,
            "habilitado_solicitudes": True,
        },
        {
            "email": "hogar@villas.demo",
            "nombre": "Familia Mendoza Polo",
            "rol": RolUsuario.HOGAR.value,
            "telefono": "+57 300 000 0102",
            "direccion": "Manzana 22, Casa 15, Etapa 2, Villas de San Pablo",
            "barrio_sector": "Villas de San Pablo - Etapa 2",
            "es_piloto": True,
            "habilitado_solicitudes": True,
        },
        {
            "email": "coord.huerta@villas.demo",
            "nombre": "Marta Lucía Herrera",
            "rol": RolUsuario.COORDINADOR_HUERTEROS.value,
            "telefono": "+57 300 000 0201",
            "direccion": "Huerta Comunitaria El Sembrador, Villas de San Pablo",
            "barrio_sector": "Villas de San Pablo - Zona Huerta",
            "es_piloto": False,
            "habilitado_solicitudes": True,
        },
        {
            "email": "coord.reciclaje@villas.demo",
            "nombre": "Carlos Alberto Barrios",
            "rol": RolUsuario.COORDINADOR_RECICLADORES.value,
            "telefono": "+57 300 000 0202",
            "direccion": "Punto de Acopio Comunitario, Villas de San Pablo",
            "barrio_sector": "Villas de San Pablo - Punto Acopio",
            "es_piloto": False,
            "habilitado_solicitudes": True,
        },
        {
            "email": "admin@villas.demo",
            "nombre": "Andrea Carolina Pacheco",
            "rol": RolUsuario.ADMINISTRADOR.value,
            "telefono": "+57 300 000 0301",
            "direccion": "Centro Comunitario Villas de San Pablo, Barranquilla",
            "barrio_sector": "Villas de San Pablo - Centro",
            "es_piloto": False,
            "habilitado_solicitudes": True,
        },
    ]

    users_by_email: dict[str, Usuario] = {}
    for spec in users_spec:
        existing = db.scalar(select(Usuario).where(Usuario.email == spec["email"]))
        if existing:
            users_by_email[spec["email"]] = existing
        else:
            user = Usuario(
                email=spec["email"],
                nombre=spec["nombre"],
                password_hash=hash_password(DEMO_PASSWORD),
                rol=spec["rol"],
                telefono=spec["telefono"],
                direccion=spec["direccion"],
                barrio_sector=spec["barrio_sector"],
                es_piloto=spec["es_piloto"],
                habilitado_solicitudes=spec["habilitado_solicitudes"],
                activo=True,
            )
            db.add(user)
            db.flush()
            users_by_email[spec["email"]] = user
            created_summary["usuarios"] += 1

    coord_huerta = users_by_email["coord.huerta@villas.demo"]
    coord_reciclaje = users_by_email["coord.reciclaje@villas.demo"]
    piloto_user = users_by_email["piloto@villas.demo"]
    hogar_user = users_by_email["hogar@villas.demo"]
    admin_user = users_by_email["admin@villas.demo"]

    # 2. Integrantes de ambos colectivos (internos, gestionados por cada coordinador)
    integrantes_spec = [
        ("Efraín Cantillo", "organico", "Huertero comunitario - Compostaje", "Etapa 1 y Las Palmas", coord_huerta.id),
        ("Yolanda Pertuz", "organico", "Huertera comunitaria - Recolección orgánica", "Etapa 2 y Parque Central", coord_huerta.id),
        ("Jairo Escorcia", "organico", "Huertero comunitario - Ruta comedores", "Zona Comercial y Manzanas 10-18", coord_huerta.id),
        ("Nubia Sarmiento", "organico", "Huertera comunitaria - Vivero", "Etapa 3", coord_huerta.id),
        ("Luis Eduardo Navarro", "reciclable", "Reciclador de oficio - Ruta Norte", "Etapa 1 y Manzanas 1-15", coord_reciclaje.id),
        ("Sandra Milena Ospino", "reciclable", "Recicladora de oficio - Ruta Sur", "Etapa 2 y Manzanas 16-30", coord_reciclaje.id),
        ("Deivis Gutiérrez", "reciclable", "Reciclador de oficio - Cartón y plástico", "Zona Comercial", coord_reciclaje.id),
        ("Katerine Morales", "reciclable", "Recicladora de oficio - Metales y vidrio", "Etapa 3 y Las Palmas", coord_reciclaje.id),
    ]

    integrantes_by_name: dict[str, IntegranteColectivo] = {}
    for nombre, flujo, rol_interno, zona, coord_id in integrantes_spec:
        existing = db.scalar(
            select(IntegranteColectivo).where(
                IntegranteColectivo.nombre == nombre,
                IntegranteColectivo.flujo == flujo,
            )
        )
        if existing:
            integrantes_by_name[nombre] = existing
        else:
            item = IntegranteColectivo(
                nombre=nombre,
                flujo=flujo,
                rol_interno=rol_interno,
                zona_cobertura=zona,
                coordinador_id=coord_id,
                activo=True,
            )
            db.add(item)
            db.flush()
            integrantes_by_name[nombre] = item
            created_summary["integrantes"] += 1

    # 3. Reglas de puntos parametrizables (RN-06): 1 kg = 1.00 pt, 1 libra (500 g) = 0.50 pts
    reglas_spec = [
        {
            "flujo": "organico",
            "puntos_base": Decimal("0.00"),
            "puntos_por_kg": Decimal("1.00"),
            "puntos_por_libra": Decimal("0.50"),
            "descripcion": "1 kilogramo (kg) = 1.0 punto | 1 libra (500 g) = 0.5 puntos para residuos orgánicos de la huerta.",
        },
        {
            "flujo": "reciclable",
            "puntos_base": Decimal("0.00"),
            "puntos_por_kg": Decimal("1.00"),
            "puntos_por_libra": Decimal("0.50"),
            "descripcion": "1 kilogramo (kg) = 1.0 punto | 1 libra (500 g) = 0.5 puntos para residuos reciclables limpios y secos.",
        },
    ]
    for rspec in reglas_spec:
        existing = db.scalar(select(ReglaPuntos).where(ReglaPuntos.flujo == rspec["flujo"]))
        if not existing:
            db.add(
                ReglaPuntos(
                    flujo=rspec["flujo"],
                    puntos_base=rspec["puntos_base"],
                    puntos_por_kg=rspec["puntos_por_kg"],
                    puntos_por_libra=rspec["puntos_por_libra"],
                    descripcion=rspec["descripcion"],
                    activo=True,
                    actualizado_por_id=admin_user.id,
                )
            )
            created_summary["reglas_puntos"] += 1

    # 4. Catálogo inicial de beneficios por niveles (RN-05 y RN-06)
    beneficios_spec = [
        # Usuarios (Hogares y Unidades Productivas)
        {
            "tipo_destinatario": "usuario",
            "nombre": "Semilla – Abono de la huerta",
            "descripcion": "Insignia digital + bolsa de abono/compost de la huerta comunitaria de Villas de San Pablo.",
            "puntos_requeridos": Decimal("10.00"),
        },
        {
            "tipo_destinatario": "usuario",
            "nombre": "Brote – Descuento en comercio aliado / kit de separación",
            "descripcion": "Descuento en comercios aliados del barrio o kit de bolsas de separación en casa.",
            "puntos_requeridos": Decimal("25.00"),
        },
        {
            "tipo_destinatario": "usuario",
            "nombre": "Árbol – Canasta de huerta / bono comunitario",
            "descripcion": "Canasta de productos frescos de la huerta comunitaria o bono comunitario referencial.",
            "puntos_requeridos": Decimal("50.00"),
        },
        # Recicladores y Huerteros
        {
            "tipo_destinatario": "recolector",
            "nombre": "Aliado Activo – Kit de protección",
            "descripcion": "Kit de elementos de protección personal (guantes reforzados e hidratación para la ruta).",
            "puntos_requeridos": Decimal("30.00"),
        },
        {
            "tipo_destinatario": "recolector",
            "nombre": "Líder Circular – Bono de alimentación / mantenimiento carretilla",
            "descripcion": "Bono de alimentación o apoyo de mantenimiento para carretilla o motocarro de trabajo.",
            "puntos_requeridos": Decimal("75.00"),
        },
        {
            "tipo_destinatario": "recolector",
            "nombre": "Guardián Verde – Dotación operativa",
            "descripcion": "Dotación operativa completa (báscula portátil, sacos reutilizables y chaleco reflectivo).",
            "puntos_requeridos": Decimal("150.00"),
        },
    ]
    for bspec in beneficios_spec:
        existing_b = db.scalar(
            select(Beneficio).where(
                Beneficio.tipo_destinatario == bspec["tipo_destinatario"],
                Beneficio.nombre == bspec["nombre"],
            )
        )
        if not existing_b:
            db.add(
                Beneficio(
                    tipo_destinatario=bspec["tipo_destinatario"],
                    nombre=bspec["nombre"],
                    descripcion=bspec["descripcion"],
                    puntos_requeridos=bspec["puntos_requeridos"],
                    activo=True,
                )
            )
            created_summary["beneficios"] += 1

    # 5. Guía visual interactiva de residuos
    if db.scalar(select(GuiaResiduo.id).limit(1)) is None:
        guia_items = [
            GuiaResiduo(
                nombre="Cáscaras de frutas y verduras",
                flujo="organico",
                categoria="Cocina cruda",
                icono="apple",
                descripcion="Cáscaras de plátano, yuca, papa, mango, patilla, zanahoria, tomate y hojas frescas.",
                buenas_practicas="Guárdalas en un balde limpio con tapa, sin bolsas plásticas ni restos de aceite.",
                horario_referencia="Negocios: recolección diaria · Hogares: día de por medio (7:00 a.m. – 11:00 a.m.)",
            ),
            GuiaResiduo(
                nombre="Borra de café y bolsitas de aromática",
                flujo="organico",
                categoria="Infusiones",
                icono="coffee",
                descripcion="Residuos del café colado, filtros de papel y hierbas naturales de aromática.",
                buenas_practicas="Escurre bien el agua antes de echarla al balde de orgánicos; nutre la tierra de la huerta.",
                horario_referencia="Negocios: recolección diaria · Hogares: día de por medio (7:00 a.m. – 11:00 a.m.)",
            ),
            GuiaResiduo(
                nombre="Cáscaras de huevo trituradas",
                flujo="organico",
                categoria="Cocina cruda",
                icono="sprout",
                descripcion="Cáscaras limpias de huevo que aportan calcio al abono de la huerta comunitaria.",
                buenas_practicas="Déjalas secar un poco y aplástalas antes de guardarlas en el recipiente orgánico.",
                horario_referencia="Negocios: recolección diaria · Hogares: día de por medio (7:00 a.m. – 11:00 a.m.)",
            ),
            GuiaResiduo(
                nombre="Hojas secas y restos de jardín",
                flujo="organico",
                categoria="Patio y terraza",
                icono="leaf",
                descripcion="Hojas secas barridas del patio, flores marchitas y ramitas pequeñas sin plástico.",
                buenas_practicas="Revisa que no lleven colillas, piedras ni envolturas de dulces.",
                horario_referencia="Sábados · 8:00 a.m. – 12:00 m. (acordando con el coordinador)",
            ),
            GuiaResiduo(
                nombre="Botellas plásticas PET y envases",
                flujo="reciclable",
                categoria="Plásticos",
                icono="milk",
                descripcion="Botellas de agua, gaseosa, jugos y envases de champú o jabón líquido.",
                buenas_practicas="Vacía todo el líquido, enjuágalas rápido, aplástalas y ponles la tapa.",
                horario_referencia="Lunes, miércoles y sábados · 8:00 a.m. – 4:00 p.m.",
            ),
            GuiaResiduo(
                nombre="Cartón y cajas desarmadas",
                flujo="reciclable",
                categoria="Papel y cartón",
                icono="package",
                descripcion="Cajas de mercado, empaques limpios de cereal, cubetas de huevo limpias y cartulina.",
                buenas_practicas="Desarma las cajas y amárralas; cuida que estén secas y sin manchas de grasa.",
                horario_referencia="Lunes, miércoles y sábados · 8:00 a.m. – 4:00 p.m.",
            ),
            GuiaResiduo(
                nombre="Papel, cuadernos y periódicos",
                flujo="reciclable",
                categoria="Papel y cartón",
                icono="file-text",
                descripcion="Hojas escritas, cuadernos usados del colegio, revistas, recibos y periódico.",
                buenas_practicas="Entrégalos secos en una bolsa aparte, sin arrugarlos con comida ni líquidos.",
                horario_referencia="Lunes, miércoles y sábados · 8:00 a.m. – 4:00 p.m.",
            ),
            GuiaResiduo(
                nombre="Latas de aluminio y enlatados",
                flujo="reciclable",
                categoria="Metales",
                icono="cup-soda",
                descripcion="Latas de gaseosa, cerveza, atún o sardinas bien enjuagadas y tapas metálicas.",
                buenas_practicas="Pásales un poquito de agua para quitar restos de comida y evitar malos olores.",
                horario_referencia="Lunes, miércoles y sábados · 8:00 a.m. – 4:00 p.m.",
            ),
            GuiaResiduo(
                nombre="Frascos y botellas de vidrio",
                flujo="reciclable",
                categoria="Vidrio",
                icono="wine",
                descripcion="Frascos de café, mayonesa, salsas y botellas de vidrio enteras.",
                buenas_practicas="Entrégalos limpios en una caja firme para que nadie se corte al recogerlos.",
                horario_referencia="Miércoles y sábados · 8:00 a.m. – 4:00 p.m.",
            ),
            GuiaResiduo(
                nombre="Papel higiénico, pañales y toallas",
                flujo="no_aprovechable",
                categoria="Basura ordinaria",
                icono="ban",
                descripcion="Residuos del baño que no sirven para la huerta ni para reciclar.",
                buenas_practicas="Échalos en bolsa negra bien cerrada para el camión de aseo normal.",
                horario_referencia="Camión de aseo municipal",
            ),
            GuiaResiduo(
                nombre="Icopor sucio y servilletas con grasa",
                flujo="no_aprovechable",
                categoria="Contaminado con comida",
                icono="ban",
                descripcion="Portacomidas de icopor untados de salsa y servilletas usadas.",
                buenas_practicas="No los mezcles con el cartón limpio porque dañan todo el reciclaje.",
                horario_referencia="Camión de aseo municipal",
            ),
            GuiaResiduo(
                nombre="Huesos, carnes cocidas y aceite usado",
                flujo="no_aprovechable",
                categoria="No va a la huerta",
                icono="ban",
                descripcion="Sobras de carne, espinas grandes, grasa o aceite de freír.",
                buenas_practicas="No los eches al balde de la huerta porque atraen animales y dañan el abono.",
                horario_referencia="No entregar a la huerta comunitaria",
            ),
        ]
        db.add_all(guia_items)
        created_summary["guia_residuos"] = len(guia_items)

    # 6. Centro de Ayuda, Reglamentos y Dudas (/ayuda — inspirado en cataki.org/posts/duvidas/)
    if db.scalar(select(TemaAyuda.id).limit(1)) is None:
        temas_spec = [
            {
                "slug": "como-separar",
                "titulo": "1. ¿Cómo separar mis residuos?",
                "subtitulo": "Aprende qué va para la huerta y qué va para los recicladores.",
                "icono": "leaf",
                "orden": 1,
                "preguntas": [
                    {
                        "pregunta": "¿Qué residuos orgánicos recibe el colectivo de huerteros?",
                        "flujo_relacionado": "organico",
                        "orden": 1,
                        "puntos_clave": [
                            "Cáscaras crudas de plátano, yuca, papa, guineo, mango, patilla y verduras.",
                            "Borra de café, sobrecitos de aromática y cáscaras de huevo trituradas.",
                            "Hojas secas y flores marchitas del patio sin tierra ni plástico.",
                            "No eches huesos, carnes cocidas, salsas, aceite de cocina ni bolsas plásticas.",
                        ],
                    },
                    {
                        "pregunta": "¿Qué materiales reciben los recicladores de oficio?",
                        "flujo_relacionado": "reciclable",
                        "orden": 2,
                        "puntos_clave": [
                            "Botellas plásticas PET (agua, gaseosa, jugos) y tarros de aseo o champú.",
                            "Cajas de cartón desarmadas, papel, cuadernos usados y periódico seco.",
                            "Latas de aluminio o enlatados enjuagados y frascos o botellas de vidrio enteras.",
                            "Recuerda: todo el material reciclable debe estar limpio y completamente seco.",
                        ],
                    },
                    {
                        "pregunta": "¿Qué cosas NO se deben entregar en EcoConecta?",
                        "flujo_relacionado": "no_aprovechable",
                        "orden": 3,
                        "puntos_clave": [
                            "Papel higiénico, pañales, toallas sanitarias o tapabocas usados.",
                            "Portacomidas de icopor untados de grasa o servilletas sucias.",
                            "Esos residuos van en bolsa negra para el camión de aseo del barrio.",
                        ],
                    },
                ],
            },
            {
                "slug": "reglas-entrega",
                "titulo": "2. Reglas de entrega y horarios",
                "subtitulo": "Cómo alistar tus bolsas o baldes y en qué horarios pasamos.",
                "icono": "clock",
                "orden": 2,
                "preguntas": [
                    {
                        "pregunta": "¿Cada cuánto pasa la recolección de residuos orgánicos?",
                        "flujo_relacionado": "organico",
                        "orden": 1,
                        "puntos_clave": [
                            "En negocios y unidades productivas (comedores, tiendas, fruterías): recolección diaria de referencia para evitar malos olores.",
                            "En hogares de Villas de San Pablo: recolección día de por medio en horas de la mañana.",
                            "Siempre debes pedir la recolección en la página y esperar la confirmación de hora del coordinador.",
                        ],
                    },
                    {
                        "pregunta": "¿Cómo debo entregar mis residuos el día acordado?",
                        "flujo_relacionado": None,
                        "orden": 2,
                        "puntos_clave": [
                            "Ten el material listo 10 minutos antes de la hora que acordaste con el coordinador.",
                            "Los orgánicos entrégalos en balde o recipiente con tapa (te devolvemos tu balde al vaciarlo).",
                            "Los reciclables entrégalos limpios, secos y separados en bolsa o caja de cartón.",
                        ],
                    },
                ],
            },
            {
                "slug": "con-quien-hablo",
                "titulo": "3. ¿Con quién hablo?",
                "subtitulo": "Por tu seguridad y orden, siempre hablas con el coordinador del colectivo.",
                "icono": "shield",
                "orden": 3,
                "preguntas": [
                    {
                        "pregunta": "¿Por qué solo me comunico con el coordinador y no directamente con el recolector?",
                        "flujo_relacionado": None,
                        "orden": 1,
                        "puntos_clave": [
                            "Para cuidar tu privacidad y organizar mejor las rutas del barrio, cada colectivo tiene un líder coordinador.",
                            "Si entregas residuos orgánicos, hablas únicamente con la Coordinación de Huerteros.",
                            "Si entregas material reciclable, hablas únicamente con la Coordinación de Recicladores.",
                            "El coordinador confirma contigo por WhatsApp o en 'Mi Cuenta' el día y la hora, y envía al integrante de su equipo.",
                        ],
                    },
                    {
                        "pregunta": "¿Qué hago si no puedo estar a la hora programada?",
                        "flujo_relacionado": None,
                        "orden": 2,
                        "puntos_clave": [
                            "Entra a 'Mi Cuenta', abre tu pedido y envíale un mensaje al coordinador o responde el WhatsApp de confirmación.",
                            "El coordinador reprogramará tu entrega sin que pierdas tu turno en la ruta.",
                        ],
                    },
                ],
            },
            {
                "slug": "puntos-beneficios",
                "titulo": "4. Puntos y beneficios",
                "subtitulo": "1 kilo = 1 punto · 1 libra = 0.5 puntos. Ganas tú y gana quien recolecta.",
                "icono": "award",
                "orden": 4,
                "preguntas": [
                    {
                        "pregunta": "¿Cómo se calculan mis puntos por cada entrega?",
                        "flujo_relacionado": None,
                        "orden": 1,
                        "puntos_clave": [
                            "Cada 1 kilogramo (kg) pesado suma 1.0 punto.",
                            "Cada 1 libra (500 gramos) pesada suma 0.5 puntos (por ejemplo, 3 libras = 1.5 puntos).",
                            "Los puntos se cargan automáticamente cuando el coordinador pesa tu entrega y guarda el cierre.",
                            "¡Reconocimiento doble! La misma cantidad de puntos se suma a tu cuenta y también al huertero o reciclador que hizo el trabajo.",
                        ],
                    },
                    {
                        "pregunta": "¿Qué beneficios puedo reclamar con mis puntos?",
                        "flujo_relacionado": None,
                        "orden": 2,
                        "puntos_clave": [
                            "Con 10 puntos (Nivel Semilla): insignia digital + bolsa de abono de la huerta comunitaria.",
                            "Con 25 puntos (Nivel Brote): descuento en comercios aliados o kit de bolsas de separación.",
                            "Con 50 puntos (Nivel Árbol): canasta de productos de la huerta comunitaria o bono comunitario.",
                            "Cálculo de puntos y beneficios referenciales y parametrizables; valores sujetos a validación oficial de la Fundación Santo Domingo.",
                        ],
                    },
                ],
            },
            {
                "slug": "datos-privacidad",
                "titulo": "5. Mis datos y privacidad",
                "subtitulo": "Por qué pedimos tu dirección y WhatsApp y cómo los cuidamos.",
                "icono": "lock",
                "orden": 5,
                "preguntas": [
                    {
                        "pregunta": "¿Quién puede ver mi número de WhatsApp y la dirección de mi casa o negocio?",
                        "flujo_relacionado": None,
                        "orden": 1,
                        "puntos_clave": [
                            "Solo los ve el coordinador del colectivo que atiende tu pedido (y la administración del proyecto).",
                            "Tus datos jamás se publican en internet ni se comparten con personas ajenas.",
                            "Si consultas tu pedido con el código (por ejemplo ECO-2026-0002), la página muestra el estado sin enseñar tu teléfono ni tu dirección.",
                        ],
                    },
                ],
            },
        ]

        for tspec in temas_spec:
            tema = TemaAyuda(
                slug=tspec["slug"],
                titulo=tspec["titulo"],
                subtitulo=tspec["subtitulo"],
                icono=tspec["icono"],
                orden=tspec["orden"],
            )
            db.add(tema)
            db.flush()
            for pspec in tspec["preguntas"]:
                db.add(
                    PreguntaAyuda(
                        tema_id=tema.id,
                        pregunta=pspec["pregunta"],
                        puntos_clave=pspec["puntos_clave"],
                        flujo_relacionado=pspec["flujo_relacionado"],
                        orden=pspec["orden"],
                    )
                )
            created_summary["temas_ayuda"] += 1

    # 7. Solicitudes iniciales de ejemplo con acreditación dual (usuario + recolector)
    if db.scalar(select(Solicitud.id).limit(1)) is None:
        now = datetime.now(timezone.utc)
        year = now.year

        efrain = integrantes_by_name["Efraín Cantillo"]
        s1 = Solicitud(
            codigo=f"ECO-{year}-0001",
            usuario_id=piloto_user.id,
            coordinador_id=coord_huerta.id,
            encargado_id=efrain.id,
            nombre_solicitante=piloto_user.nombre,
            telefono_contacto=piloto_user.telefono or "+57 300 000 0101",
            direccion=piloto_user.direccion or "Manzana 14, Casa 8, Villas de San Pablo",
            tipo_generador="unidad_productiva",
            flujo="organico",
            estado=EstadoSolicitud.RECOLECTADA.value,
            preferencia_horaria="Mañana (8:00 a.m. – 10:30 a.m.)",
            observaciones="Residuos vegetales frescos de la semana del comedor comunitario.",
            fecha_programada=(now - timedelta(days=3)).date(),
            hora_programada="08:30",
            nombre_encargado=efrain.nombre,
            creado_en=now - timedelta(days=4),
            actualizado_en=now - timedelta(days=3),
        )
        db.add(s1)
        db.flush()

        r1 = RegistroRecoleccion(
            solicitud_id=s1.id,
            coordinador_id=coord_huerta.id,
            encargado_id=efrain.id,
            nombre_solicitante_verificado=piloto_user.nombre,
            peso_ingresado=Decimal("32.00"),
            unidad_medida="kg",
            peso_kg=Decimal("32.00"),
            nombre_encargado=efrain.nombre,
            fecha_hora_recoleccion=now - timedelta(days=3),
            observaciones="Material muy bien separado y limpio para camas de compostaje.",
            puntos_calculados=Decimal("32.00"),
            creado_en=now - timedelta(days=3),
        )
        db.add(r1)
        db.flush()
        db.add_all(
            [
                MovimientoPuntos(
                    tipo_destinatario="usuario",
                    tipo_movimiento="credito",
                    usuario_id=piloto_user.id,
                    integrante_colectivo_id=None,
                    solicitud_id=s1.id,
                    registro_recoleccion_id=r1.id,
                    flujo="organico",
                    peso_ingresado=Decimal("32.00"),
                    unidad_medida="kg",
                    peso_kg=Decimal("32.00"),
                    puntos=Decimal("32.00"),
                    regla_aplicada="1.00 pts/kg (32.00 kg) [organico]",
                    creado_en=now - timedelta(days=3),
                ),
                MovimientoPuntos(
                    tipo_destinatario="recolector",
                    tipo_movimiento="credito",
                    usuario_id=None,
                    integrante_colectivo_id=efrain.id,
                    solicitud_id=s1.id,
                    registro_recoleccion_id=r1.id,
                    flujo="organico",
                    peso_ingresado=Decimal("32.00"),
                    unidad_medida="kg",
                    peso_kg=Decimal("32.00"),
                    puntos=Decimal("32.00"),
                    regla_aplicada="1.00 pts/kg (32.00 kg) [organico]",
                    creado_en=now - timedelta(days=3),
                ),
            ]
        )
        db.add_all(
            [
                HistorialEstado(
                    solicitud_id=s1.id,
                    estado_anterior=None,
                    estado_nuevo="recibida",
                    usuario_id=piloto_user.id,
                    comentario="Solicitud registrada en flujo 'organico' y enviada a Coordinación de Huerteros.",
                    creado_en=now - timedelta(days=4),
                ),
                HistorialEstado(
                    solicitud_id=s1.id,
                    estado_anterior="recibida",
                    estado_nuevo="programada",
                    usuario_id=coord_huerta.id,
                    comentario="Recolección programada con el comedor piloto. Encargado interno asignado: Efraín Cantillo.",
                    creado_en=now - timedelta(days=3, hours=12),
                ),
                HistorialEstado(
                    solicitud_id=s1.id,
                    estado_anterior="programada",
                    estado_nuevo="recolectada",
                    usuario_id=coord_huerta.id,
                    comentario="Recolección cerrada por Marta Lucía Herrera. Peso: 32.00 kg | Encargado: Efraín Cantillo | Acreditación dual: +32.00 pts usuario y +32.00 pts recolector.",
                    creado_en=now - timedelta(days=3),
                ),
            ]
        )
        db.add(
            NotificacionWhatsApp(
                solicitud_id=s1.id,
                flujo="organico",
                destinatario_nombre=piloto_user.nombre,
                destinatario_telefono=s1.telefono_contacto,
                tipo_evento="recoleccion_completada",
                mensaje=(
                    f"¡Gracias {piloto_user.nombre}! Tu entrega {s1.codigo} (organico) fue "
                    "completada con 32.00 kg. Se acreditaron +32.00 puntos en EcoConecta – Villas de San Pablo."
                ),
                modo="simulado",
                estado_envio="simulado",
                respuesta_api={"simulated": True, "provider": "Meta WhatsApp Business Cloud API"},
                creado_en=now - timedelta(days=3),
            )
        )

        # Solicitud 2: Reciclable en LIBRAS (23.00 lb = 11.50 kg -> 11.50 pts decimales para Hogar y Sandra)
        sandra = integrantes_by_name["Sandra Milena Ospino"]
        s2 = Solicitud(
            codigo=f"ECO-{year}-0002",
            usuario_id=hogar_user.id,
            coordinador_id=coord_reciclaje.id,
            encargado_id=sandra.id,
            nombre_solicitante=hogar_user.nombre,
            telefono_contacto=hogar_user.telefono or "+57 300 000 0102",
            direccion=hogar_user.direccion or "Manzana 22, Casa 15, Villas de San Pablo",
            tipo_generador="hogar",
            flujo="reciclable",
            estado=EstadoSolicitud.RECOLECTADA.value,
            preferencia_horaria="Tarde (2:00 p.m. – 4:30 p.m.)",
            observaciones="Botellas PET aplastadas, cajas de cartón secas y latas enjuagadas.",
            fecha_programada=(now - timedelta(days=2)).date(),
            hora_programada="15:00",
            nombre_encargado=sandra.nombre,
            creado_en=now - timedelta(days=3),
            actualizado_en=now - timedelta(days=2),
        )
        db.add(s2)
        db.flush()

        r2 = RegistroRecoleccion(
            solicitud_id=s2.id,
            coordinador_id=coord_reciclaje.id,
            encargado_id=sandra.id,
            nombre_solicitante_verificado=hogar_user.nombre,
            peso_ingresado=Decimal("23.00"),
            unidad_medida="lb",
            peso_kg=Decimal("11.50"),
            nombre_encargado=sandra.nombre,
            fecha_hora_recoleccion=now - timedelta(days=2),
            observaciones="Material reciclable limpio y seco pesado en báscula de libras (23 lb = 11.5 kg).",
            puntos_calculados=Decimal("11.50"),
            creado_en=now - timedelta(days=2),
        )
        db.add(r2)
        db.flush()
        db.add_all(
            [
                MovimientoPuntos(
                    tipo_destinatario="usuario",
                    tipo_movimiento="credito",
                    usuario_id=hogar_user.id,
                    integrante_colectivo_id=None,
                    solicitud_id=s2.id,
                    registro_recoleccion_id=r2.id,
                    flujo="reciclable",
                    peso_ingresado=Decimal("23.00"),
                    unidad_medida="lb",
                    peso_kg=Decimal("11.50"),
                    puntos=Decimal("11.50"),
                    regla_aplicada="0.50 pts/lb (23.00 lb = 11.50 kg) [reciclable]",
                    creado_en=now - timedelta(days=2),
                ),
                MovimientoPuntos(
                    tipo_destinatario="recolector",
                    tipo_movimiento="credito",
                    usuario_id=None,
                    integrante_colectivo_id=sandra.id,
                    solicitud_id=s2.id,
                    registro_recoleccion_id=r2.id,
                    flujo="reciclable",
                    peso_ingresado=Decimal("23.00"),
                    unidad_medida="lb",
                    peso_kg=Decimal("11.50"),
                    puntos=Decimal("11.50"),
                    regla_aplicada="0.50 pts/lb (23.00 lb = 11.50 kg) [reciclable]",
                    creado_en=now - timedelta(days=2),
                ),
            ]
        )
        db.add_all(
            [
                HistorialEstado(
                    solicitud_id=s2.id,
                    estado_anterior=None,
                    estado_nuevo="recibida",
                    usuario_id=hogar_user.id,
                    comentario="Solicitud registrada en flujo 'reciclable' y enviada a Coordinación de Recicladores.",
                    creado_en=now - timedelta(days=3),
                ),
                HistorialEstado(
                    solicitud_id=s2.id,
                    estado_anterior="recibida",
                    estado_nuevo="programada",
                    usuario_id=coord_reciclaje.id,
                    comentario="Recolección programada con el hogar. Encargado interno asignado: Sandra Milena Ospino.",
                    creado_en=now - timedelta(days=2, hours=8),
                ),
                HistorialEstado(
                    solicitud_id=s2.id,
                    estado_anterior="programada",
                    estado_nuevo="recolectada",
                    usuario_id=coord_reciclaje.id,
                    comentario="Recolección cerrada por Carlos Alberto Barrios. Peso: 23.00 lb (11.50 kg) | Encargado: Sandra Milena Ospino | Acreditación dual: +11.50 pts usuario y +11.50 pts recolector.",
                    creado_en=now - timedelta(days=2),
                ),
            ]
        )
        db.add(
            NotificacionWhatsApp(
                solicitud_id=s2.id,
                flujo="reciclable",
                destinatario_nombre=hogar_user.nombre,
                destinatario_telefono=s2.telefono_contacto,
                tipo_evento="recoleccion_completada",
                mensaje=(
                    f"¡Gracias {hogar_user.nombre}! Tu entrega {s2.codigo} (reciclable) fue "
                    "completada con 23.00 lb (11.50 kg). Se acreditaron +11.50 puntos en EcoConecta – Villas de San Pablo."
                ),
                modo="simulado",
                estado_envio="simulado",
                respuesta_api={"simulated": True, "provider": "Meta WhatsApp Business Cloud API"},
                creado_en=now - timedelta(days=2),
            )
        )

        # Solicitud 3: Orgánica programada (lista para probar el Formulario de Cierre en kg o lb)
        jairo = integrantes_by_name["Jairo Escorcia"]
        s3 = Solicitud(
            codigo=f"ECO-{year}-0003",
            usuario_id=piloto_user.id,
            coordinador_id=coord_huerta.id,
            encargado_id=jairo.id,
            nombre_solicitante=piloto_user.nombre,
            telefono_contacto=piloto_user.telefono or "+57 300 000 0101",
            direccion=piloto_user.direccion or "Manzana 14, Casa 8, Villas de San Pablo",
            tipo_generador="unidad_productiva",
            flujo="organico",
            estado=EstadoSolicitud.PROGRAMADA.value,
            preferencia_horaria="Mañana (7:30 a.m. – 9:30 a.m.)",
            observaciones="Dos baldes con residuos vegetales frescos listos para pesaje.",
            fecha_programada=date.today() + timedelta(days=1),
            hora_programada="08:00",
            nombre_encargado=jairo.nombre,
            creado_en=now - timedelta(hours=18),
            actualizado_en=now - timedelta(hours=6),
        )
        db.add(s3)
        db.flush()
        db.add_all(
            [
                HistorialEstado(
                    solicitud_id=s3.id,
                    estado_anterior=None,
                    estado_nuevo="recibida",
                    usuario_id=piloto_user.id,
                    comentario="Solicitud orgánica registrada por Unidad Productiva Piloto.",
                    creado_en=now - timedelta(hours=18),
                ),
                HistorialEstado(
                    solicitud_id=s3.id,
                    estado_anterior="recibida",
                    estado_nuevo="programada",
                    usuario_id=coord_huerta.id,
                    comentario="Horario acordado con la unidad productiva. Encargado interno asignado: Jairo Escorcia.",
                    creado_en=now - timedelta(hours=6),
                ),
            ]
        )
        db.add_all(
            [
                MensajeCoordinacion(
                    solicitud_id=s3.id,
                    remitente_id=piloto_user.id,
                    rol_remitente=piloto_user.rol,
                    contenido="Hola Marta, ya tenemos listos los dos baldes verdes en la entrada del comedor.",
                    creado_en=now - timedelta(hours=10),
                ),
                MensajeCoordinacion(
                    solicitud_id=s3.id,
                    remitente_id=coord_huerta.id,
                    rol_remitente=coord_huerta.rol,
                    contenido="Perfecto, confirmamos el paso mañana a las 8:00 a.m. con el equipo de la huerta.",
                    creado_en=now - timedelta(hours=6),
                ),
            ]
        )
        db.add(
            NotificacionWhatsApp(
                solicitud_id=s3.id,
                flujo="organico",
                destinatario_nombre=piloto_user.nombre,
                destinatario_telefono=s3.telefono_contacto,
                tipo_evento="recoleccion_programada",
                mensaje=(
                    f"Hola {piloto_user.nombre}, soy {coord_huerta.nombre} (Coordinación de Huerteros). "
                    f"Tu recolección {s3.codigo} quedó programada para el {s3.fecha_programada.isoformat()} "
                    f"a las {s3.hora_programada}."
                ),
                modo="simulado",
                estado_envio="simulado",
                respuesta_api={"simulated": True, "provider": "Meta WhatsApp Business Cloud API"},
                creado_en=now - timedelta(hours=6),
            )
        )

        # Solicitud 4: Reciclable recién recibida (exclusiva para Coordinador de Recicladores)
        s4 = Solicitud(
            codigo=f"ECO-{year}-0004",
            usuario_id=hogar_user.id,
            coordinador_id=coord_reciclaje.id,
            nombre_solicitante=hogar_user.nombre,
            telefono_contacto=hogar_user.telefono or "+57 300 000 0102",
            direccion=hogar_user.direccion or "Manzana 22, Casa 15, Villas de San Pablo",
            tipo_generador="hogar",
            flujo="reciclable",
            estado=EstadoSolicitud.RECIBIDA.value,
            preferencia_horaria="Sábado en la mañana (9:00 a.m. – 12:00 m.)",
            observaciones="Dos costales con botellas PET, cajas de cartón plegadas y cuadernos usados.",
            creado_en=now - timedelta(hours=3),
            actualizado_en=now - timedelta(hours=3),
        )
        db.add(s4)
        db.flush()
        db.add(
            HistorialEstado(
                solicitud_id=s4.id,
                estado_anterior=None,
                estado_nuevo="recibida",
                usuario_id=hogar_user.id,
                comentario="Solicitud registrada en flujo 'reciclable' y enviada a Coordinación de Recicladores.",
                creado_en=now - timedelta(hours=3),
            )
        )
        db.add(
            NotificacionWhatsApp(
                solicitud_id=s4.id,
                flujo="reciclable",
                destinatario_nombre=hogar_user.nombre,
                destinatario_telefono=s4.telefono_contacto,
                tipo_evento="solicitud_recibida",
                mensaje=(
                    f"Hola {hogar_user.nombre}, recibimos tu solicitud {s4.codigo} en EcoConecta "
                    f"(flujo: reciclable). {coord_reciclaje.nombre} coordinará contigo el día y hora."
                ),
                modo="simulado",
                estado_envio="simulado",
                respuesta_api={"simulated": True, "provider": "Meta WhatsApp Business Cloud API"},
                creado_en=now - timedelta(hours=3),
            )
        )

        created_summary["solicitudes"] = 4

    # 8. Solicitudes iniciales de ejemplo ingresadas por Audio de WhatsApp (idempotente para volúmenes existentes)
    has_wa_audio = db.scalar(
        select(Solicitud.id).where(Solicitud.canal_origen == "whatsapp_audio").limit(1)
    )
    if has_wa_audio is None:
        now = datetime.now(timezone.utc)
        from app.services.solicitudes import generate_unique_code

        code_wa_org = generate_unique_code(db)
        s_wa_org = Solicitud(
            codigo=code_wa_org,
            usuario_id=piloto_user.id,
            coordinador_id=coord_huerta.id,
            nombre_solicitante="Tienda La Esquina Verde (Doña Rosa)",
            telefono_contacto="+57 300 555 0199",
            direccion="Manzana 15, Local 2, Villas de San Pablo",
            tipo_generador="unidad_productiva",
            flujo="organico",
            estado=EstadoSolicitud.RECIBIDA.value,
            canal_origen="whatsapp_audio",
            transcripcion_original=(
                "Hola señores de EcoConecta, les habla Doña Rosa de la Tienda La Esquina Verde "
                "en la Manzana 15 Local 2 de Villas de San Pablo. Tengo dos baldes con cáscaras "
                "de plátano, yuca, papaya y restos de verdura para la huerta comunitaria, "
                "pueden pasar mañana por la mañana tipo 8 de la mañana."
            ),
            confianza_ia=Decimal("0.94"),
            requiere_revision_humana=False,
            preferencia_horaria="Mañana (7:00 a.m. – 11:00 a.m.)",
            observaciones="Detectado en mensaje: cáscaras, plátano, yuca, papaya, restos, verdura, huerta.",
            creado_en=now - timedelta(hours=1),
            actualizado_en=now - timedelta(hours=1),
        )
        db.add(s_wa_org)
        db.flush()
        db.add(
            HistorialEstado(
                solicitud_id=s_wa_org.id,
                estado_anterior=None,
                estado_nuevo="recibida",
                usuario_id=piloto_user.id,
                comentario=(
                    "Solicitud ingresada por Nota de Voz (Audio WhatsApp) "
                    "(confianza 94%). Enrutada a Coordinación de Huerteros (Orgánicos)."
                ),
                creado_en=now - timedelta(hours=1),
            )
        )
        db.add(
            NotificacionWhatsApp(
                solicitud_id=s_wa_org.id,
                flujo="organico",
                destinatario_nombre=s_wa_org.nombre_solicitante,
                destinatario_telefono=s_wa_org.telefono_contacto,
                tipo_evento="confirmacion_whatsapp_ingesta",
                mensaje=(
                    f"¡Hola {s_wa_org.nombre_solicitante}! Recibimos tu pedido por WhatsApp en "
                    f"EcoConecta – Villas de San Pablo. Tu código es *{s_wa_org.codigo}* "
                    f"para *residuos orgánicos (Huerta Comunitaria)*. {coord_huerta.nombre} "
                    f"se comunicará contigo para acordar el día y la hora de recolección."
                ),
                modo="simulado",
                estado_envio="simulado",
                respuesta_api={"simulated": True, "channel": "whatsapp_audio"},
                creado_en=now - timedelta(hours=1),
            )
        )

        code_wa_rec = generate_unique_code(db)
        s_wa_rec = Solicitud(
            codigo=code_wa_rec,
            usuario_id=hogar_user.id,
            coordinador_id=coord_reciclaje.id,
            nombre_solicitante="Familia Martínez",
            telefono_contacto="+57 301 444 0288",
            direccion="Manzana 9, Casa 12, Etapa 1, Villas de San Pablo",
            tipo_generador="hogar",
            flujo="reciclable",
            estado=EstadoSolicitud.RECIBIDA.value,
            canal_origen="whatsapp_audio",
            transcripcion_original=(
                "Buenas tardes vecinos, habla Jorge de la Familia Martínez en la Manzana 9 Casa 12 "
                "de Villas de San Pablo. Tenemos tres sacos con botellas plásticas PET limpias, "
                "cajas de cartón desarmadas y unas latas de aluminio para que pasen los recicladores "
                "en la tarde después de las 2."
            ),
            confianza_ia=Decimal("0.93"),
            requiere_revision_humana=False,
            preferencia_horaria="Tarde (2:00 p.m. – 5:00 p.m.)",
            observaciones="Detectado en mensaje: botellas, plásticas, PET, cajas, cartón, latas, aluminio.",
            creado_en=now - timedelta(minutes=40),
            actualizado_en=now - timedelta(minutes=40),
        )
        db.add(s_wa_rec)
        db.flush()
        db.add(
            HistorialEstado(
                solicitud_id=s_wa_rec.id,
                estado_anterior=None,
                estado_nuevo="recibida",
                usuario_id=hogar_user.id,
                comentario=(
                    "Solicitud ingresada por Nota de Voz (Audio WhatsApp) "
                    "(confianza 93%). Enrutada a Coordinación de Recicladores (Reciclables)."
                ),
                creado_en=now - timedelta(minutes=40),
            )
        )
        db.add(
            NotificacionWhatsApp(
                solicitud_id=s_wa_rec.id,
                flujo="reciclable",
                destinatario_nombre=s_wa_rec.nombre_solicitante,
                destinatario_telefono=s_wa_rec.telefono_contacto,
                tipo_evento="confirmacion_whatsapp_ingesta",
                mensaje=(
                    f"¡Hola {s_wa_rec.nombre_solicitante}! Recibimos tu pedido por WhatsApp en "
                    f"EcoConecta – Villas de San Pablo. Tu código es *{s_wa_rec.codigo}* "
                    f"para *material reciclable (Recicladores de Oficio)*. {coord_reciclaje.nombre} "
                    f"se comunicará contigo para acordar el día y la hora de recolección."
                ),
                modo="simulado",
                estado_envio="simulado",
                respuesta_api={"simulated": True, "channel": "whatsapp_audio"},
                creado_en=now - timedelta(minutes=40),
            )
        )
        created_summary["solicitudes"] += 2

    db.commit()
    return created_summary


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        summary = run_seed(db)
        print(f"[EcoConecta seed] Completado: {summary}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
