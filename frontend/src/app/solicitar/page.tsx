"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Edit3,
  HelpCircle,
  Home,
  Loader2,
  MessageCircle,
  Recycle,
  Send,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

import BackButton from "@/components/BackButton";
import SpeakButton from "@/components/SpeakButton";
import { EstadoBadge, FlujoBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { FlujoResiduo, SolicitudCiudadano } from "@/lib/types";

const SCHEDULE_PRESETS = [
  "Mañana (7:30 a.m. – 11:00 a.m.)",
  "Tarde (2:00 p.m. – 5:00 p.m.)",
  "Sábado en la mañana (8:00 a.m. – 12:00 m.)",
];

function SolicitarFormContent() {
  const searchParams = useSearchParams();
  const initialFlow =
    searchParams.get("flujo") === "reciclable" ? "reciclable" : "organico";

  const { user, loading, isCoordinatorOrAdmin, demoLogin } = useAuth();

  const [flujo, setFlujo] = useState<FlujoResiduo>(initialFlow);
  const [tipoGenerador, setTipoGenerador] = useState<
    "hogar" | "unidad_productiva"
  >("hogar");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [preferenciaHoraria, setPreferenciaHoraria] = useState(
    SCHEDULE_PRESETS[0]
  );
  const [observaciones, setObservaciones] = useState("");

  // Field-by-field friendly validation errors + review screen state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SolicitudCiudadano | null>(null);

  useEffect(() => {
    if (user) {
      setNombre((prev) => prev || user.nombre);
      setTelefono((prev) => prev || user.telefono || "");
      setDireccion((prev) => prev || user.direccion || "");
      if (user.rol === "unidad_productiva" || user.rol === "hogar") {
        setTipoGenerador(user.rol);
      }
    }
  }, [user]);

  const handleQuickDemo = async (email: string) => {
    setError(null);
    setDemoBusy(email);
    try {
      const logged = await demoLogin(email);
      setNombre(logged.nombre);
      setTelefono(logged.telefono || "");
      setDireccion(logged.direccion || "");
      if (logged.rol === "unidad_productiva" || logged.rol === "hogar") {
        setTipoGenerador(logged.rol);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos abrir la cuenta demo.");
    } finally {
      setDemoBusy(null);
    }
  };

  const validateFields = (): boolean => {
    const errs: Record<string, string> = {};
    if (nombre.trim().length < 2) {
      errs.nombre =
        "Por favor escribe tu nombre o el nombre de tu negocio (mínimo 2 letras).";
    }
    const digits = telefono.replace(/\D+/g, "");
    if (digits.length < 7) {
      errs.telefono =
        "Escribe tu número de WhatsApp o celular para que el coordinador te avise cuándo pasamos.";
    }
    if (direccion.trim().length < 5) {
      errs.direccion =
        "Escribe tu dirección en Villas de San Pablo (Manzana, Casa o punto de referencia).";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinueToReview = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateFields()) return;
    setReviewing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleConfirmAndSend = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<SolicitudCiudadano>("/solicitudes", {
        method: "POST",
        body: JSON.stringify({
          nombre_solicitante: nombre.trim(),
          telefono_contacto: telefono.trim(),
          direccion: direccion.trim(),
          tipo_generador: tipoGenerador,
          flujo,
          preferencia_horaria: preferenciaHoraria.trim() || null,
          observaciones: observaciones.trim() || null,
        }),
      });
      setCreated(res);
      setReviewing(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos guardar tu pedido. Por favor revisa tus datos e intenta de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-huerta-600" />
      </div>
    );
  }

  // Coordinadores operan en /coordinacion
  if (
    user &&
    (user.rol === "coordinador_huerteros" ||
      user.rol === "coordinador_recicladores")
  ) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <BackButton href="/coordinacion" label="Volver a coordinación" />
        <div className="eco-card mt-4 p-6 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-huerta-600" />
          <h1 className="mt-3 text-xl font-black text-stone-900">
            Estás conectado como Coordinador
          </h1>
          <p className="mt-2 text-base text-stone-700">
            Tu cuenta atiende y cierra recolecciones desde la página alterna{" "}
            <strong>/coordinacion</strong>. Si quieres probar cómo pide un
            vecino o negocio, cambia a una cuenta de Hogar o Unidad Productiva.
          </p>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              disabled={demoBusy !== null}
              onClick={() => void handleQuickDemo("hogar@villas.demo")}
              className="eco-btn-primary text-sm"
            >
              {demoBusy === "hogar@villas.demo" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Home className="h-5 w-5" />
              )}
              <span>Cambiar a Hogar Vecino</span>
            </button>
            <button
              type="button"
              disabled={demoBusy !== null}
              onClick={() => void handleQuickDemo("piloto@villas.demo")}
              className="eco-btn-teal text-sm"
            >
              {demoBusy === "piloto@villas.demo" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
              <span>Cambiar a Negocio Piloto</span>
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/coordinacion" className="eco-btn-amber">
              <span>Volver a /coordinacion</span>
            </Link>
            <Link href="/login" className="eco-btn-outline">
              <span>Ver todas las cuentas</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Confirmación tras crear solicitud
  if (created) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="eco-card border-2 border-huerta-300 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-huerta-100 text-huerta-700">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-huerta-800">
                ¡Tu pedido fue recibido!
              </p>
              <h1 className="text-2xl font-black text-stone-900">
                Código {created.codigo}
              </h1>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <FlujoBadge flujo={created.flujo} />
              <EstadoBadge estado={created.estado} />
            </div>
            <SpeakButton
              label="Escuchar confirmación"
              text={`Listo. Recibimos tu pedido con el código ${created.codigo}. El coordinador ${created.coordinador_nombre} te escribirá por WhatsApp para acordar el día y la hora en que pasarán por tu dirección.`}
            />
          </div>

          <div className="mt-5 space-y-2.5 rounded-2xl bg-stone-50 p-4 text-base text-stone-800">
            <p>
              <strong>Te atiende:</strong> {created.coordinador_nombre} (
              {created.coordinador_rol_label})
            </p>
            <p>
              <strong>Dirección:</strong> {created.direccion}
            </p>
            {created.preferencia_horaria && (
              <p>
                <strong>Horario que prefieres:</strong>{" "}
                {created.preferencia_horaria}
              </p>
            )}
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border-2 border-huerta-200 bg-huerta-50 p-4 text-sm font-semibold text-huerta-900">
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Ya enviamos el aviso por WhatsApp.{" "}
              <strong>{created.coordinador_nombre}</strong> acordará contigo el
              día y la hora exactos de la recolección.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/mi-cuenta" className="eco-btn-primary flex-1">
              <span>Ver mi pedido en Mi Cuenta</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setObservaciones("");
              }}
              className="eco-btn-outline flex-1"
            >
              <span>Hacer otro pedido</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Navegación sin miedo a equivocarse: Botón Volver siempre visible */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {reviewing ? (
          <BackButton
            onClick={() => setReviewing(false)}
            label="Volver a corregir mis datos"
          />
        ) : (
          <BackButton href="/" label="Volver al inicio" />
        )}
        <Link
          href="/ayuda"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-sol-400 bg-sol-50 px-3.5 py-2 text-sm font-extrabold text-stone-900 hover:bg-sol-100"
        >
          <HelpCircle className="h-4 w-4 text-sol-600" />
          <span>¿Dudas sobre cómo separar?</span>
        </Link>
      </div>

      <div className="mt-5">
        <span className="inline-flex rounded-full bg-huerta-100 px-3 py-1 text-xs font-extrabold text-huerta-800">
          {reviewing
            ? "Paso 2 de 2 · Confirmación segura"
            : "Paso 1 de 2 · Completa tus datos"}
        </span>
        <h1 className="mt-2 text-2xl font-black text-stone-900 sm:text-3xl">
          {reviewing
            ? "Revisa tus datos antes de enviar"
            : "Pide tu recolección en Villas de San Pablo"}
        </h1>
        <p className="mt-1.5 text-base text-stone-700">
          {reviewing
            ? "Verifica que todo esté bien escrito. Si necesitas cambiar algo, toca el botón para volver sin perder lo que escribiste."
            : "Elige qué vas a entregar. Tu pedido llegará únicamente al coordinador de ese colectivo."}
        </p>
      </div>

      {/* Si no ha iniciado sesión: acceso demo en 1 toque */}
      {!user && (
        <div className="mt-6 rounded-2xl border-2 border-sol-400 bg-sol-50 p-5">
          <h2 className="text-lg font-black text-stone-900">
            Entra a tu cuenta para guardar tus puntos
          </h2>
          <p className="mt-1 text-base text-stone-800">
            Para pedir recolección y sumar puntos en tu cuenta, elige una cuenta
            de demostración en 1 toque:
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={demoBusy !== null}
              onClick={() => handleQuickDemo("piloto@villas.demo")}
              className="eco-btn-primary text-sm"
            >
              {demoBusy === "piloto@villas.demo" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
              <span>Entrar como Negocio Piloto</span>
            </button>
            <button
              type="button"
              disabled={demoBusy !== null}
              onClick={() => handleQuickDemo("hogar@villas.demo")}
              className="eco-btn-teal text-sm"
            >
              {demoBusy === "hogar@villas.demo" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Home className="h-5 w-5" />
              )}
              <span>Entrar como Hogar Vecino</span>
            </button>
          </div>
          <p className="mt-3 text-center text-sm font-semibold text-stone-700">
            ¿Quieres crear tu propia cuenta?{" "}
            <Link
              href="/login?next=/solicitar"
              className="font-extrabold text-huerta-800 underline"
            >
              Ir a Entrar / Registrarme
            </Link>
          </p>
        </div>
      )}

      {/* Aviso RN-08 si cuenta no habilitada */}
      {user && !isCoordinatorOrAdmin && !user.habilitado_solicitudes && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-base text-amber-950">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <p className="font-extrabold">
              Tu cuenta está pendiente de activación en el piloto (RN-08)
            </p>
            <p className="mt-1 text-sm">
              La administración comunitaria de Villas de San Pablo puede
              activarla desde el panel de coordinación.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3.5 text-base font-bold text-rose-800">
          {error}
        </div>
      )}

      {/* PANTALLA DE RESUMEN: "Revisa tus datos antes de enviar" */}
      {reviewing ? (
        <div className="eco-card mt-6 space-y-5 border-2 border-huerta-500 p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-huerta-700">
                Resumen de tu pedido
              </p>
              <h2 className="text-xl font-black text-stone-900">
                Revisa tus datos antes de enviar
              </h2>
            </div>
            <SpeakButton
              label="Escuchar mis datos"
              text={`Revisa tus datos antes de enviar. Vas a entregar residuos ${
                flujo === "organico"
                  ? "orgánicos para la huerta"
                  : "reciclables para los recicladores"
              }. Desde un ${
                tipoGenerador === "unidad_productiva" ? "negocio" : "hogar"
              }. A nombre de ${nombre}. Teléfono WhatsApp ${telefono}. Dirección ${direccion}. Horario preferido ${preferenciaHoraria}. Si todo está bien, toca el botón verde Confirmar y enviar mi pedido.`}
            />
          </div>

          <dl className="space-y-3 rounded-2xl bg-stone-50 p-4 text-base">
            <div className="flex flex-wrap justify-between gap-2 border-b border-stone-200/70 pb-2.5">
              <dt className="font-bold text-stone-600">¿Qué vas a entregar?</dt>
              <dd>
                <FlujoBadge flujo={flujo} />
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-stone-200/70 pb-2.5">
              <dt className="font-bold text-stone-600">Lugar de recogida:</dt>
              <dd className="font-extrabold text-stone-900">
                {tipoGenerador === "unidad_productiva"
                  ? "Unidad Productiva / Negocio"
                  : "Hogar / Casa"}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-stone-200/70 pb-2.5">
              <dt className="font-bold text-stone-600">Nombre:</dt>
              <dd className="font-extrabold text-stone-900">{nombre}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-stone-200/70 pb-2.5">
              <dt className="font-bold text-stone-600">WhatsApp / Celular:</dt>
              <dd className="font-extrabold text-stone-900">{telefono}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-stone-200/70 pb-2.5">
              <dt className="font-bold text-stone-600">Dirección:</dt>
              <dd className="font-extrabold text-stone-900">{direccion}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="font-bold text-stone-600">Horario preferido:</dt>
              <dd className="font-extrabold text-stone-900">
                {preferenciaHoraria || "Por acordar con el coordinador"}
              </dd>
            </div>
            {observaciones.trim() && (
              <div className="border-t border-stone-200/70 pt-2.5">
                <dt className="font-bold text-stone-600">Que tienes listo:</dt>
                <dd className="mt-1 text-stone-800">{observaciones}</dd>
              </div>
            )}
          </dl>

          <div className="flex items-start gap-2.5 rounded-xl bg-huerta-50 p-3.5 text-sm font-semibold text-huerta-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-huerta-600" />
            <p>
              Este pedido lo recibirá únicamente el{" "}
              <strong>
                Coordinador de{" "}
                {flujo === "organico" ? "Huerteros" : "Recicladores"}
              </strong>
              , quien te escribirá para confirmar la hora exacta.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setReviewing(false)}
              disabled={submitting}
              className="eco-btn-outline flex-1"
            >
              <Edit3 className="h-5 w-5" />
              <span>← Volver y corregir</span>
            </button>
            <button
              type="button"
              onClick={handleConfirmAndSend}
              disabled={!user || submitting}
              className={
                flujo === "organico"
                  ? "eco-btn-primary flex-1"
                  : "eco-btn-teal flex-1"
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Enviando pedido...</span>
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  <span>Confirmar y enviar mi pedido</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* PASO 1: FORMULARIO GUIADO CON LENGUAJE CLARO */
        <form
          onSubmit={handleContinueToReview}
          noValidate
          className="eco-card mt-6 space-y-6 p-5 sm:p-7"
        >
          {/* 1. Selección de flujo */}
          <div>
            <label className="mb-2.5 block text-base font-black text-stone-900">
              1. ¿Qué residuos tienes listos para entregar? *
            </label>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setFlujo("organico")}
                className={`flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition ${
                  flujo === "organico"
                    ? "border-huerta-600 bg-huerta-50 ring-2 ring-huerta-200"
                    : "border-stone-200 bg-white hover:border-huerta-400"
                }`}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-huerta-600 text-white">
                  <Sprout className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-base font-black text-huerta-900">
                    🌱 Orgánicos (Huerta)
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-stone-700">
                    Cáscaras crudas, verduras, borra de café. Atiende{" "}
                    <strong>Coord. Huerteros</strong>.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFlujo("reciclable")}
                className={`flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition ${
                  flujo === "reciclable"
                    ? "border-reciclaje-600 bg-reciclaje-50 ring-2 ring-reciclaje-200"
                    : "border-stone-200 bg-white hover:border-reciclaje-400"
                }`}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-reciclaje-600 text-white">
                  <Recycle className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-base font-black text-reciclaje-700">
                    ♻️ Reciclables (Limpios)
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-stone-700">
                    Botellas PET, cartón, papel, latas, vidrio. Atiende{" "}
                    <strong>Coord. Recicladores</strong>.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Tipo de generador */}
          <div>
            <label className="mb-2.5 block text-base font-black text-stone-900">
              2. ¿De dónde pasamos a recoger? *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTipoGenerador("hogar")}
                className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 px-4 text-base font-extrabold transition ${
                  tipoGenerador === "hogar"
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 bg-white text-stone-800"
                }`}
              >
                <Home className="h-5 w-5" />
                <span>Mi Hogar / Casa</span>
              </button>
              <button
                type="button"
                onClick={() => setTipoGenerador("unidad_productiva")}
                className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 px-4 text-base font-extrabold transition ${
                  tipoGenerador === "unidad_productiva"
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 bg-white text-stone-800"
                }`}
              >
                <Building2 className="h-5 w-5" />
                <span>Mi Negocio</span>
              </button>
            </div>
          </div>

          {/* 3. Datos de contacto y dirección */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-base font-extrabold text-stone-900">
                Tu nombre o el del negocio *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  if (fieldErrors.nombre)
                    setFieldErrors((prev) => ({ ...prev, nombre: "" }));
                }}
                placeholder="Ej: Familia Mendoza / Tienda La Bendición"
                className="eco-input"
              />
              {fieldErrors.nombre && (
                <p className="mt-1.5 text-sm font-bold text-rose-700">
                  {fieldErrors.nombre}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-base font-extrabold text-stone-900">
                Número de WhatsApp o celular *
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => {
                  setTelefono(e.target.value);
                  if (fieldErrors.telefono)
                    setFieldErrors((prev) => ({ ...prev, telefono: "" }));
                }}
                placeholder="Escribe tu WhatsApp para avisarte"
                className="eco-input"
              />
              <p className="mt-1 text-xs font-semibold text-stone-600">
                Escribe tu número de WhatsApp para avisarte cuándo pasamos.
              </p>
              {fieldErrors.telefono && (
                <p className="mt-1 text-sm font-bold text-rose-700">
                  {fieldErrors.telefono}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-base font-extrabold text-stone-900">
              Dirección exacta en Villas de San Pablo *
            </label>
            <input
              type="text"
              value={direccion}
              onChange={(e) => {
                setDireccion(e.target.value);
                if (fieldErrors.direccion)
                  setFieldErrors((prev) => ({ ...prev, direccion: "" }));
              }}
              placeholder="Ej: Manzana 14, Casa 8, cerca al parque"
              className="eco-input"
            />
            {fieldErrors.direccion && (
              <p className="mt-1.5 text-sm font-bold text-rose-700">
                {fieldErrors.direccion}
              </p>
            )}
          </div>

          {/* 4. Preferencia horaria */}
          <div>
            <label className="mb-1.5 block text-base font-extrabold text-stone-900">
              ¿En qué horario te queda más fácil entregar?
            </label>
            <div className="mb-2.5 flex flex-wrap gap-2">
              {SCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPreferenciaHoraria(preset)}
                  className={`min-h-[42px] rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                    preferenciaHoraria === preset
                      ? "bg-sol-400 text-stone-950 shadow-sm"
                      : "border border-stone-300 bg-stone-100 text-stone-800 hover:bg-stone-200"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={preferenciaHoraria}
              onChange={(e) => setPreferenciaHoraria(e.target.value)}
              placeholder="O escribe aquí el horario en que estás en casa"
              className="eco-input"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-base font-extrabold text-stone-900">
              ¿Qué tienes listo para entregar? (opcional)
            </label>
            <textarea
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Tengo un balde con cáscaras de plátano / dos bolsas con botellas limpias y cartón."
              className="eco-input"
            />
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-4 text-sm font-semibold text-stone-700">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-huerta-600" />
            <p>
              Tu teléfono y dirección solo los verá el{" "}
              <strong>
                coordinador de{" "}
                {flujo === "organico" ? "huerteros" : "recicladores"}
              </strong>
              . Antes de enviar podrás revisar todos tus datos en la siguiente
              pantalla.
            </p>
          </div>

          <button
            type="submit"
            disabled={!user}
            className={
              flujo === "organico"
                ? "eco-btn-primary w-full text-base"
                : "eco-btn-teal w-full text-base"
            }
          >
            <span>Continuar y revisar mis datos</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      )}
    </div>
  );
}

export default function SolicitarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-huerta-600" />
        </div>
      }
    >
      <SolicitarFormContent />
    </Suspense>
  );
}
