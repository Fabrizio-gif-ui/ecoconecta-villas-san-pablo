"""Pruebas de integración de reglas de negocio RN-01 a RN-08, Centro de Ayuda (/ayuda),
cálculo kg/lb, acreditación dual (usuario + recolector) y catálogo/canje de beneficios.
"""

from datetime import date, timedelta

from fastapi.testclient import TestClient
import pytest

from app.core.database import Base, SessionLocal, engine
from app.main import app
from app.seed import DEMO_PASSWORD, run_seed


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        run_seed(db)
    finally:
        db.close()
    with TestClient(app) as c:
        yield c


def auth_headers(client: TestClient, email: str) -> dict[str, str]:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": DEMO_PASSWORD},
    )
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_rn01_to_rn08_ayuda_dual_points_lb_kg_and_benefits(client: TestClient):
    h_piloto = auth_headers(client, "piloto@villas.demo")
    h_hogar = auth_headers(client, "hogar@villas.demo")
    h_huerta = auth_headers(client, "coord.huerta@villas.demo")
    h_reciclaje = auth_headers(client, "coord.reciclaje@villas.demo")
    h_admin = auth_headers(client, "admin@villas.demo")

    # 0. Centro de Ayuda (/api/v1/public/ayuda) contiene los 5 temas y horarios de referencia
    ayuda_res = client.get("/api/v1/public/ayuda")
    assert ayuda_res.status_code == 200, ayuda_res.text
    ayuda_data = ayuda_res.json()
    assert len(ayuda_data["temas"]) == 5
    assert len(ayuda_data["canales_coordinacion"]) == 2
    assert "Fundación Santo Domingo" in ayuda_data["nota_institucional"]

    # 1. Unidad Productiva Piloto crea solicitud ORGÁNICA (se cerrará en KG)
    res_org = client.post(
        "/api/v1/solicitudes",
        headers=h_piloto,
        json={
            "nombre_solicitante": "Comedor Comunitario Sabor Caribeño",
            "telefono_contacto": "+57 300 000 0101",
            "direccion": "Manzana 14, Casa 8, Villas de San Pablo",
            "tipo_generador": "unidad_productiva",
            "flujo": "organico",
            "preferencia_horaria": "Mañana 8:00 a.m.",
            "observaciones": "Prueba E2E orgánica en kg",
        },
    )
    assert res_org.status_code == 201, res_org.text
    sol_org = res_org.json()
    assert sol_org["codigo"].startswith("ECO-")
    assert "nombre_encargado" not in sol_org

    # 2. Hogar crea solicitud RECICLABLE (se cerrará en LIBRAS: 3 lb -> 1.50 kg -> 1.50 pts)
    res_rec = client.post(
        "/api/v1/solicitudes",
        headers=h_hogar,
        json={
            "nombre_solicitante": "Familia Mendoza Polo",
            "telefono_contacto": "+57 300 000 0102",
            "direccion": "Manzana 22, Casa 15, Villas de San Pablo",
            "tipo_generador": "hogar",
            "flujo": "reciclable",
            "preferencia_horaria": "Tarde 3:00 p.m.",
            "observaciones": "Prueba E2E reciclable en libras",
        },
    )
    assert res_rec.status_code == 201, res_rec.text
    sol_rec = res_rec.json()

    # RN-01: Separación estricta de flujos
    assert (
        client.get(
            f"/api/v1/coordinacion/solicitudes/{sol_rec['id']}", headers=h_huerta
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/coordinacion/solicitudes/{sol_org['id']}", headers=h_reciclaje
        ).status_code
        == 403
    )
    assert (
        client.get("/api/v1/coordinacion/solicitudes", headers=h_hogar).status_code
        == 403
    )

    # RN-07: Consulta pública sin PII
    pub = client.get(f"/api/v1/public/solicitudes/{sol_org['codigo']}").json()
    assert "telefono_contacto" not in pub
    assert "direccion" not in pub

    # RN-02: Programación obligatoria devuelve mensaje amigable en español
    bad_prog = client.post(
        f"/api/v1/coordinacion/solicitudes/{sol_org['id']}/programar",
        headers=h_huerta,
        json={"fecha_programada": str(date.today() + timedelta(days=1))},
    )
    assert bad_prog.status_code == 422
    assert isinstance(bad_prog.json()["detail"], str)

    colectivo_huerta = client.get(
        "/api/v1/coordinacion/colectivo", headers=h_huerta
    ).json()
    huertero = colectivo_huerta[0]

    assert (
        client.post(
            f"/api/v1/coordinacion/solicitudes/{sol_org['id']}/programar",
            headers=h_huerta,
            json={
                "fecha_programada": str(date.today() + timedelta(days=1)),
                "hora_programada": "09:15",
                "encargado_id": huertero["id"],
                "nombre_encargado": huertero["nombre"],
            },
        ).status_code
        == 200
    )

    # Captura saldos previos de usuario y recolector (Acreditación dual RN-05)
    user_pts_before = client.get(
        "/api/v1/solicitudes/mias/puntos", headers=h_piloto
    ).json()["puntos_disponibles"]
    panel_before = client.get(
        "/api/v1/coordinacion/recolectores/puntos", headers=h_huerta
    ).json()["recolectores"]
    col_pts_before = next(
        r["puntos_disponibles"]
        for r in panel_before
        if r["integrante_id"] == huertero["id"]
    )

    # Cierre en KG: 2.50 kg -> 2.50 pts para usuario Y 2.50 pts para huertero
    close_kg = client.post(
        f"/api/v1/coordinacion/solicitudes/{sol_org['id']}/cerrar",
        headers=h_huerta,
        json={
            "nombre_solicitante_verificado": "Comedor Comunitario Sabor Caribeño",
            "peso_ingresado": 2.5,
            "unidad_medida": "kg",
            "encargado_id": huertero["id"],
            "nombre_encargado": huertero["nombre"],
        },
    )
    assert close_kg.status_code == 200, close_kg.text
    reg_kg = close_kg.json()["registro_recoleccion"]
    assert reg_kg["peso_ingresado"] == 2.5
    assert reg_kg["unidad_medida"] == "kg"
    assert reg_kg["peso_kg"] == 2.5
    assert reg_kg["puntos_calculados"] == 2.5

    user_pts_after = client.get(
        "/api/v1/solicitudes/mias/puntos", headers=h_piloto
    ).json()["puntos_disponibles"]
    panel_after = client.get(
        "/api/v1/coordinacion/recolectores/puntos", headers=h_huerta
    ).json()["recolectores"]
    col_pts_after = next(
        r["puntos_disponibles"]
        for r in panel_after
        if r["integrante_id"] == huertero["id"]
    )
    assert user_pts_after == pytest.approx(user_pts_before + 2.5, abs=0.01)
    assert col_pts_after == pytest.approx(col_pts_before + 2.5, abs=0.01)

    # Cierre en LIBRAS (reciclable): 21.00 lb -> 10.50 kg -> 10.50 pts decimales (acreditación dual)
    colectivo_rec = client.get(
        "/api/v1/coordinacion/colectivo", headers=h_reciclaje
    ).json()
    reciclador = colectivo_rec[0]

    hogar_before = client.get(
        "/api/v1/solicitudes/mias/puntos", headers=h_hogar
    ).json()["puntos_disponibles"]
    rec_panel_before = client.get(
        "/api/v1/coordinacion/recolectores/puntos", headers=h_reciclaje
    ).json()["recolectores"]
    rec_col_before = next(
        r["puntos_disponibles"]
        for r in rec_panel_before
        if r["integrante_id"] == reciclador["id"]
    )

    close_lb = client.post(
        f"/api/v1/coordinacion/solicitudes/{sol_rec['id']}/cerrar",
        headers=h_reciclaje,
        json={
            "nombre_solicitante_verificado": "Familia Mendoza Polo",
            "peso_ingresado": 21.0,
            "unidad_medida": "lb",
            "encargado_id": reciclador["id"],
            "nombre_encargado": reciclador["nombre"],
        },
    )
    assert close_lb.status_code == 200, close_lb.text
    reg_lb = close_lb.json()["registro_recoleccion"]
    assert reg_lb["peso_ingresado"] == 21.0
    assert reg_lb["unidad_medida"] == "lb"
    assert reg_lb["peso_kg"] == 10.5
    assert reg_lb["puntos_calculados"] == 10.5

    hogar_after_resp = client.get(
        "/api/v1/solicitudes/mias/puntos", headers=h_hogar
    ).json()
    assert hogar_after_resp["puntos_disponibles"] == pytest.approx(
        hogar_before + 10.5, abs=0.01
    )
    rec_panel_after = client.get(
        "/api/v1/coordinacion/recolectores/puntos", headers=h_reciclaje
    ).json()["recolectores"]
    rec_col_after = next(
        r["puntos_disponibles"]
        for r in rec_panel_after
        if r["integrante_id"] == reciclador["id"]
    )
    assert rec_col_after == pytest.approx(rec_col_before + 10.5, abs=0.01)

    # Catálogo de beneficios y canje de usuario (Semilla - 10 pts)
    semilla = next(
        b for b in hogar_after_resp["beneficios"] if "Semilla" in b["nombre"]
    )
    assert semilla["puntos_requeridos"] == 10.0
    assert semilla["desbloqueado"] is True

    canje_u = client.post(
        "/api/v1/solicitudes/mias/canjes",
        headers=h_hogar,
        json={"beneficio_id": semilla["id"], "observaciones": "Canje prueba E2E"},
    )
    assert canje_u.status_code == 201, canje_u.text
    assert canje_u.json()["puntos_canjeados"] == 10.0

    # Saldo descontado correctamente y canje sin saldo rechazado con 400
    arbol = next(
        b for b in hogar_after_resp["beneficios"] if "Árbol" in b["nombre"]
    )
    assert (
        client.post(
            "/api/v1/solicitudes/mias/canjes",
            headers=h_hogar,
            json={"beneficio_id": arbol["id"]},
        ).status_code
        == 400
    )

    # Admin puede consultar reglas de puntos (kg y lb) y catálogo de beneficios (RN-06)
    reglas = client.get("/api/v1/admin/reglas-puntos", headers=h_admin).json()
    assert reglas[0]["puntos_por_kg"] == 1.0
    assert reglas[0]["puntos_por_libra"] == 0.5
    assert (
        "Cálculo de puntos y beneficios referenciales y parametrizables"
        in reglas[0]["nota_institucional"]
    )

    beneficios_admin = client.get(
        "/api/v1/admin/beneficios", headers=h_admin
    ).json()
    assert len(beneficios_admin) >= 6


def test_whatsapp_audio_text_webhook_and_human_reclassification(client: TestClient):
    from app.core.config import settings
    from app.services.ai_extractor import sanitize_transcript_for_llm

    h_huerta = auth_headers(client, "coord.huerta@villas.demo")
    h_reciclaje = auth_headers(client, "coord.reciclaje@villas.demo")

    # 1. Privacidad: sanitize_transcript_for_llm nunca envía teléfonos al LLM
    sanitized = sanitize_transcript_for_llm(
        "Hola mi teléfono es +57 300 123 4567 y tengo cáscaras de plátano en Manzana 10 Casa 4"
    )
    assert "300" not in sanitized
    assert "4567" not in sanitized
    assert "[TEL_OCULTO]" in sanitized

    # 2. GET /api/webhooks/whatsapp (verificación oficial de token de Meta)
    verify_ok = client.get(
        "/api/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": settings.WHATSAPP_VERIFY_TOKEN,
            "hub.challenge": "987654321",
        },
    )
    assert verify_ok.status_code == 200
    assert verify_ok.text == "987654321"

    verify_fail = client.get(
        "/api/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "token_invalido",
            "hub.challenge": "987654321",
        },
    )
    assert verify_fail.status_code == 403

    # 3. POST /api/webhooks/whatsapp/simular con archivo de audio (.webm) para ORGÁNICO
    fake_ogg_bytes = b"OggS\x00\x02simulated_voice_note_ecoconecta"
    sim_org = client.post(
        "/api/webhooks/whatsapp/simular",
        data={
            "remitente_nombre": "Tienda La Esquina Verde",
            "remitente_telefono": "+57 300 555 0199",
            "direccion_referencia": "Manzana 15, Local 2, Villas de San Pablo",
            "tipo_generador": "unidad_productiva",
            "usuario_email": "piloto@villas.demo",
            "texto": (
                "Hola amigos de EcoConecta, soy Doña Rosa de la Tienda La Esquina Verde en "
                "Manzana 15 Local 2. Tengo dos baldes con cáscaras de plátano, yuca y restos "
                "de fruta para la huerta mañana por la mañana."
            ),
        },
        files={"archivo_audio": ("nota_voz.webm", fake_ogg_bytes, "audio/webm")},
    )
    assert sim_org.status_code == 201, sim_org.text
    sim_org_data = sim_org.json()
    assert sim_org_data["canal_origen"] == "whatsapp_audio"
    assert sim_org_data["extraccion"]["flujo"] == "organico"
    assert sim_org_data["codigo_solicitud"].startswith("ECO-")
    assert "cáscaras" in sim_org_data["transcripcion"]
    sol_wa_id = sim_org_data["solicitud_id"]

    # 4. Coordinador de Huerteros ve la solicitud con etiqueta whatsapp_audio y transcripción exacta
    detail_huerta = client.get(
        f"/api/v1/coordinacion/solicitudes/{sol_wa_id}", headers=h_huerta
    )
    assert detail_huerta.status_code == 200, detail_huerta.text
    detail_json = detail_huerta.json()
    assert detail_json["canal_origen"] == "whatsapp_audio"
    assert "Tienda La Esquina Verde" in detail_json["transcripcion_original"]
    # RN-01: Coordinador de Recicladores NO puede verla mientras sea orgánica
    assert (
        client.get(
            f"/api/v1/coordinacion/solicitudes/{sol_wa_id}", headers=h_reciclaje
        ).status_code
        == 403
    )

    # 5. Control humano en /coordinacion frente a errores de IA: Reclasificar ("Mover a Recicladores")
    reclas_res = client.post(
        f"/api/v1/coordinacion/solicitudes/{sol_wa_id}/reclasificar",
        headers=h_huerta,
        json={
            "nuevo_flujo": "reciclable",
            "comentario": "El vecino aclaró por audio que eran cajas de cartón y botellas PET.",
        },
    )
    assert reclas_res.status_code == 200, reclas_res.text
    reclas_json = reclas_res.json()
    assert reclas_json["flujo"] == "reciclable"
    assert any(
        "Control humano: flujo reclasificado" in (h["comentario"] or "")
        for h in reclas_json["historial_estados"]
    )

    # Ahora pertenece a la bandeja de Recicladores (200) y ya no a Huerteros (403)
    assert (
        client.get(
            f"/api/v1/coordinacion/solicitudes/{sol_wa_id}", headers=h_reciclaje
        ).status_code
        == 200
    )
    assert (
        client.get(
            f"/api/v1/coordinacion/solicitudes/{sol_wa_id}", headers=h_huerta
        ).status_code
        == 403
    )

    # 6. POST /api/webhooks/whatsapp (payload oficial de Meta WhatsApp Cloud API)
    meta_payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "1092837465",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "contacts": [
                                {
                                    "profile": {"name": "Familia Martínez"},
                                    "wa_id": "573000000102",
                                }
                            ],
                            "messages": [
                                {
                                    "from": "573000000102",
                                    "id": "wamid.HBgMNTczMDAwMDAwMTAyFQIAEhgg",
                                    "timestamp": "1763650000",
                                    "type": "text",
                                    "text": {
                                        "body": (
                                            "Hola EcoConecta, somos la Familia Martínez en Manzana 22 Casa 15, "
                                            "tenemos cajas de cartón, botellas plásticas y latas para reciclar "
                                            "en la tarde."
                                        )
                                    },
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }
    meta_res = client.post("/api/webhooks/whatsapp", json=meta_payload)
    assert meta_res.status_code == 200, meta_res.text
    meta_json = meta_res.json()
    assert meta_json["status"] == "processed"
    assert meta_json["procesados"] == 1
    assert meta_json["solicitudes"][0]["flujo"] == "reciclable"
    assert meta_json["solicitudes"][0]["canal_origen"] == "whatsapp_texto"

    # 7. Eventos de estado (statuses: entregado/leído) son ignorados y devuelven 200 OK sin duplicar
    status_payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "1092837465",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "statuses": [
                                {
                                    "id": "wamid.HBgMNTczMDAwMDAwMTAyFQIAEhgg",
                                    "status": "delivered",
                                    "timestamp": "1763650010",
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }
    status_res = client.post("/api/webhooks/whatsapp", json=status_payload)
    assert status_res.status_code == 200
    assert status_res.json()["procesados"] == 0

