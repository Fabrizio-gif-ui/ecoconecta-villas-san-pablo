"use client";

import {
  ArrowRight,
  Award,
  Gift,
  HelpCircle,
  Home,
  Leaf,
  Mic,
  Search,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import EcoConectaLogo from "@/components/EcoConectaLogo";
import SpeakButton from "@/components/SpeakButton";
import { EstadoBadge, FlujoBadge } from "@/components/StatusBadge";
import WasteGuide from "@/components/WasteGuide";
import { apiFetch } from "@/lib/api";
import {
  formatPts,
  type Beneficio,
  type GuiaResiduo,
  type ImpactoPublico,
  type SolicitudPublicaTrack,
} from "@/lib/types";

/* Los 3 grandes pasos inspirados en ecoins.eco (Separa · Entrega y Gana · Canjea),
   con lenguaje claro y botones grandes pensados para personas mayores */
const ECOINS_STEPS = [
  {
    step: "1",
    title: "Separa en casa",
    description:
      "Guarda las cáscaras crudas para la huerta, y el plástico, cartón y botellas limpios y secos aparte.",
    ctaLabel: "Ver qué recibimos",
    ctaHref: "#guia",
    circleBg: "bg-[#168A2E] text-white",
    Icon: Leaf,
  },
  {
    step: "2",
    title: "Pide y entrega",
    description:
      "Pide recolección aquí o envía una nota de voz por WhatsApp. El coordinador acuerda contigo la hora.",
    ctaLabel: "Pedir recolección",
    ctaHref: "/solicitar",
    circleBg: "bg-[#0A9B70] text-white",
    Icon: Truck,
  },
  {
    step: "3",
    title: "Gana y canjea",
    description:
      "Por cada kilo sumas 1 punto y por cada libra medio punto. Reclama abono, descuentos o canastas.",
    ctaLabel: "Ver mis puntos",
    ctaHref: "/mis-puntos",
    circleBg: "bg-[#F6C400] text-[#063B2E]",
    Icon: Gift,
  },
];

export default function HomePage() {
  const [guia, setGuia] = useState<GuiaResiduo[]>([]);
  const [impacto, setImpacto] = useState<ImpactoPublico | null>(null);
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [benefitTab, setBenefitTab] = useState<"usuario" | "recolector">(
    "usuario"
  );

  // Consulta por código (RN-07: sin datos personales)
  const [trackCode, setTrackCode] = useState("");
  const [trackResult, setTrackResult] = useState<SolicitudPublicaTrack | null>(
    null
  );
  const [trackError, setTrackError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    void Promise.allSettled([
      apiFetch<GuiaResiduo[]>("/public/guia-residuos", { auth: false }).then(
        setGuia
      ),
      apiFetch<ImpactoPublico>("/public/impacto", { auth: false }).then(
        setImpacto
      ),
      apiFetch<Beneficio[]>("/public/beneficios", { auth: false }).then(
        setBeneficios
      ),
    ]);
  }, []);

  const handleTrack = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = trackCode.trim().toUpperCase();
    if (!cleaned) return;
    setTracking(true);
    setTrackError(null);
    setTrackResult(null);
    try {
      const data = await apiFetch<SolicitudPublicaTrack>(
        `/public/solicitudes/${encodeURIComponent(cleaned)}`,
        { auth: false }
      );
      setTrackResult(data);
    } catch (err) {
      setTrackError(
        err instanceof Error
          ? err.message
          : "No encontramos ningún pedido con ese código."
      );
    } finally {
      setTracking(false);
    }
  };

  const visibleBenefits = beneficios.filter(
    (b) => b.tipo_destinatario === benefitTab
  );

  return (
    <div>
      {/* 1. HERO ULTRA LIMPIO Y ESPACIOSO (ESTILO ECOINS.ECO · CERO CONTAMINACIÓN VISUAL) */}
      <section className="border-b border-[#E2ECE5] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            {/* Texto claro, letra grande y solo 2 botones principales */}
            <div className="lg:col-span-7">
              <p className="inline-flex items-center gap-2 rounded-full bg-[#E1EFE4] px-4 py-1.5 text-sm font-bold text-[#063B2E]">
                <span>Villas de San Pablo · Barranquilla</span>
              </p>

              <h1 className="mt-5 text-[32px] font-bold leading-[1.18] text-[#063B2E] sm:text-[44px]">
                Separa en casa y{" "}
                <span className="text-[#168A2E]">gana puntos</span> cuidando tu
                barrio
              </h1>

              <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#202522] sm:text-xl">
                Recogemos tus residuos orgánicos para la huerta y tu material
                reciclable en la puerta de tu casa. Es{" "}
                <strong>gratis, seguro y muy fácil</strong>.
              </p>

              {/* Solo 2 botones grandes redondeados estilo ecoins.eco */}
              <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
                <Link
                  href="/solicitar"
                  className="inline-flex min-h-[58px] items-center justify-center gap-2.5 rounded-full bg-[#168A2E] px-7 py-3.5 text-lg font-bold text-white shadow-sm transition hover:bg-[#063B2E]"
                >
                  <Truck className="h-5 w-5 shrink-0" />
                  <span>Pedir Recolección</span>
                  <ArrowRight className="h-5 w-5 shrink-0" />
                </Link>

                <Link
                  href="/whatsapp-demo"
                  className="inline-flex min-h-[58px] items-center justify-center gap-2.5 rounded-full border-2 border-[#0A9B70] bg-white px-7 py-3.5 text-lg font-bold text-[#063B2E] transition hover:bg-[#EAF8F3]"
                >
                  <Mic className="h-5 w-5 shrink-0 text-[#0A9B70]" />
                  <span>Pedir con Nota de Voz</span>
                </Link>
              </div>

              {/* Botón calmado de lectura en voz alta para personas mayores */}
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <SpeakButton
                  label="🔊 Escuchar cómo funciona"
                  text="Bienvenido a EcoConecta Villas de San Pablo. Aquí puedes separar tus residuos orgánicos para la huerta y tu material reciclable, pedir que pasen a recogerlos gratis desde tu casa, y ganar puntos por cada kilo o libra que entregues. Toca el botón verde Pedir Recolección o el botón Pedir con Nota de Voz para empezar."
                />
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#063B2E]">
                  <ShieldCheck className="h-4 w-4 text-[#168A2E]" />
                  <span>Siempre hablas con el coordinador del barrio</span>
                </span>
              </div>
            </div>

            {/* Tarjeta visual derecha limpia y sin recargos */}
            <div className="lg:col-span-5">
              <div className="flex flex-col items-center rounded-3xl border border-[#D8E2DC] bg-[#F2F5F2] p-8 text-center">
                <EcoConectaLogo variant="hero" />

                <div className="mt-6 w-full rounded-2xl bg-[#F6C400] px-5 py-4 text-[#063B2E]">
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Así ganas puntos en cada entrega
                  </p>
                  <p className="mt-1 font-heading text-xl font-bold">
                    1 kilo = 1 punto · 1 libra = 0.5 pts
                  </p>
                </div>

                {impacto && (
                  <p className="mt-5 text-base font-semibold text-[#063B2E]">
                    Ya llevamos{" "}
                    <strong className="text-lg font-bold text-[#168A2E]">
                      {impacto.total_kg_aprovechados} kg
                    </strong>{" "}
                    aprovechados con{" "}
                    <strong>{impacto.recolecciones_completadas} entregas</strong>{" "}
                    en Villas de San Pablo.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ¿CÓMO FUNCIONA? — 3 PASOS CLAROS ESTILO ECOINS.ECO */}
      <section className="border-b border-[#E2ECE5] bg-[#F2F5F2] py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-[#063B2E] sm:text-4xl">
              ¿Cómo funciona EcoConecta?
            </h2>
            <p className="mt-3 text-lg text-[#202522]">
              En solo 3 pasos sencillos ayudas a la huerta y a los recicladores
              del barrio.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {ECOINS_STEPS.map((item) => {
              const Icon = item.Icon;
              return (
                <div
                  key={item.step}
                  className="flex flex-col items-center justify-between rounded-3xl border border-[#D8E2DC] bg-white p-8 text-center shadow-sm"
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-20 w-20 items-center justify-center rounded-full shadow-sm ${item.circleBg}`}
                    >
                      <Icon className="h-9 w-9" />
                    </div>
                    <span className="mt-4 text-sm font-bold uppercase tracking-wider text-[#0A9B70]">
                      Paso {item.step}
                    </span>
                    <h3 className="mt-1 text-2xl font-bold text-[#063B2E]">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-[#202522]">
                      {item.description}
                    </p>
                  </div>

                  <Link
                    href={item.ctaHref}
                    className="mt-6 inline-flex min-h-[48px] items-center gap-1.5 rounded-full border-2 border-[#063B2E] bg-white px-6 py-2.5 text-base font-bold text-[#063B2E] transition hover:bg-[#063B2E] hover:text-white"
                  >
                    <span>{item.ctaLabel}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. GUÍA VISUAL DE MATERIALES (¿QUÉ RECIBIMOS?) — ESTILO ECOINS.ECO */}
      <WasteGuide items={guia} />

      {/* 4. CATÁLOGO DE BENEFICIOS (SECCIÓN "CANJEAR" ESTILO ECOINS.ECO) */}
      <section className="border-y border-[#E2ECE5] bg-[#F2F5F2] py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF6C7] px-4 py-1.5 text-sm font-bold text-[#063B2E]">
              <Award className="h-4 w-4 text-[#F28C00]" />
              <span>Premiamos tu compromiso</span>
            </span>
            <h2 className="mt-3 text-3xl font-bold text-[#063B2E] sm:text-4xl">
              Beneficios que puedes canjear con tus puntos
            </h2>
            <p className="mt-3 text-lg text-[#202522]">
              Al pesar cada entrega ganan puntos tanto tu hogar o negocio como
              el huertero o reciclador que realizó la recolección.
            </p>

            {/* Selector sencillo de 2 pestañas */}
            <div className="mt-6 inline-flex rounded-full border-2 border-[#D8E2DC] bg-white p-1.5">
              <button
                type="button"
                onClick={() => setBenefitTab("usuario")}
                className={`min-h-[46px] rounded-full px-6 text-base font-bold transition ${
                  benefitTab === "usuario"
                    ? "bg-[#168A2E] text-white"
                    : "text-[#063B2E] hover:bg-[#F2F5F2]"
                }`}
              >
                Hogares y Negocios
              </button>
              <button
                type="button"
                onClick={() => setBenefitTab("recolector")}
                className={`min-h-[46px] rounded-full px-6 text-base font-bold transition ${
                  benefitTab === "recolector"
                    ? "bg-[#0A9B70] text-white"
                    : "text-[#063B2E] hover:bg-[#F2F5F2]"
                }`}
              >
                Huerteros y Recicladores
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {visibleBenefits.map((b) => (
              <article
                key={b.id}
                className="flex flex-col justify-between rounded-3xl border border-[#D8E2DC] bg-white p-6 shadow-sm"
              >
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6C400] px-4 py-1.5 text-sm font-bold text-[#063B2E]">
                    <Gift className="h-4 w-4 text-[#063B2E]" />
                    <span>{formatPts(b.puntos_requeridos)} puntos</span>
                  </span>
                  <h3 className="mt-4 text-xl font-bold text-[#063B2E]">
                    {b.nombre}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-[#202522]">
                    {b.descripcion}
                  </p>
                </div>

                <Link
                  href={
                    benefitTab === "usuario" ? "/mis-puntos" : "/coordinacion"
                  }
                  className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#F2F5F2] px-5 py-2.5 text-base font-bold text-[#063B2E] transition hover:bg-[#168A2E] hover:text-white"
                >
                  <span>
                    {benefitTab === "usuario"
                      ? "Ver en Mis Puntos"
                      : "Ver en /coordinacion"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>

          <p className="mt-6 text-center text-sm font-semibold text-[#063B2E]">
            * Cálculo de puntos y beneficios referenciales y parametrizables;
            valores sujetos a validación oficial de la Fundación Santo Domingo.
          </p>
        </div>
      </section>

      {/* 5. SECCIÓN COMUNIDAD: HOGARES VS. NEGOCIOS (ESTILO PERSONA / EMPRESA DE ECOINS.ECO) */}
      <section className="border-b border-[#E2ECE5] bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-[#063B2E] sm:text-4xl">
              Pensado para toda nuestra comunidad
            </h2>
            <p className="mt-3 text-lg text-[#202522]">
              Participa desde tu casa o desde tu negocio en Villas de San Pablo.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="flex flex-col justify-between rounded-3xl border border-[#D8E2DC] bg-[#F2F5F2] p-8">
              <div>
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#168A2E] text-white">
                  <Home className="h-7 w-7" />
                </span>
                <h3 className="mt-4 text-2xl font-bold text-[#063B2E]">
                  Para Familias y Hogares
                </h3>
                <p className="mt-2 text-base leading-relaxed text-[#202522]">
                  Diseñado para que cualquier persona, incluidos nuestros
                  adultos mayores, pueda separar sin enredos, escuchar las
                  instrucciones y pedir recolección con un toque o una nota de
                  voz.
                </p>
              </div>
              <Link
                href="/login"
                className="mt-6 inline-flex min-h-[52px] w-fit items-center gap-2 rounded-full bg-[#168A2E] px-6 py-3 text-base font-bold text-white transition hover:bg-[#063B2E]"
              >
                <span>Entrar o crear mi cuenta</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            <div className="flex flex-col justify-between rounded-3xl border border-[#D8E2DC] bg-[#EAF8F3] p-8">
              <div>
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#0A9B70] text-white">
                  <Store className="h-7 w-7" />
                </span>
                <h3 className="mt-4 text-2xl font-bold text-[#063B2E]">
                  Para Tiendas, Comedores y Negocios
                </h3>
                <p className="mt-2 text-base leading-relaxed text-[#202522]">
                  Recolección diaria de residuos orgánicos y retiro programado
                  de cartón y plástico para mantener limpio tu local y sumar
                  puntos comunitarios.
                </p>
              </div>
              <Link
                href="/solicitar"
                className="mt-6 inline-flex min-h-[52px] w-fit items-center gap-2 rounded-full bg-[#0A9B70] px-6 py-3 text-base font-bold text-white transition hover:bg-[#063B2E]"
              >
                <span>Pedir recolección para mi negocio</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CONSULTA RÁPIDA DE PEDIDO POR CÓDIGO (LIMPIA Y SIN SATURAR EL INICIO) */}
      <section className="bg-[#F2F5F2] py-14 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="rounded-3xl border border-[#D8E2DC] bg-white p-6 text-center shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-[#063B2E]">
              ¿Ya pediste una recolección? Revisa cómo va tu pedido
            </h2>
            <p className="mt-2 text-base text-[#202522]">
              Escribe tu código (ejemplo:{" "}
              <code className="rounded bg-[#F2F5F2] px-2 py-0.5 font-mono font-bold text-[#063B2E]">
                ECO-2026-0002
              </code>
              ). Nunca mostramos tu teléfono ni tu dirección en pantalla.
            </p>

            <form
              onSubmit={handleTrack}
              className="mx-auto mt-5 flex max-w-md flex-col gap-3 sm:flex-row"
            >
              <input
                type="text"
                value={trackCode}
                onChange={(e) => setTrackCode(e.target.value)}
                placeholder="Ej: ECO-2026-0002"
                aria-label="Código del pedido"
                className="min-h-[52px] flex-1 rounded-full border-2 border-[#C5D3CA] bg-[#F2F5F2] px-5 font-mono text-base uppercase text-[#202522] focus:border-[#168A2E] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={tracking}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#063B2E] px-6 text-base font-bold text-white transition hover:bg-[#168A2E] disabled:opacity-60"
              >
                <Search className="h-5 w-5 text-[#F6C400]" />
                <span>Buscar</span>
              </button>
            </form>

            {trackError && (
              <p className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-base font-semibold text-rose-900">
                {trackError}
              </p>
            )}

            {trackResult && (
              <div className="mt-5 rounded-2xl border border-[#D8E2DC] bg-[#F2F5F2] p-5 text-left text-base">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-lg font-bold text-[#063B2E]">
                    {trackResult.codigo}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <FlujoBadge flujo={trackResult.flujo} />
                    <EstadoBadge estado={trackResult.estado} />
                  </div>
                </div>
                <p className="mt-2 text-[#202522]">
                  <strong>Atiende:</strong> {trackResult.coordinador_rol_label}
                </p>
                {trackResult.fecha_programada && (
                  <p className="mt-1 font-bold text-[#0A9B70]">
                    Cita acordada: {trackResult.fecha_programada} ·{" "}
                    {trackResult.hora_programada}
                  </p>
                )}
                {trackResult.peso_kg_registrado !== null &&
                  trackResult.peso_kg_registrado !== undefined && (
                    <p className="mt-1 font-bold text-[#168A2E]">
                      Entregado:{" "}
                      {trackResult.peso_ingresado != null &&
                      trackResult.unidad_medida
                        ? `${trackResult.peso_ingresado} ${trackResult.unidad_medida} (${trackResult.peso_kg_registrado} kg)`
                        : `${trackResult.peso_kg_registrado} kg`}{" "}
                      · +{formatPts(trackResult.puntos_otorgados)} pts
                    </p>
                  )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 7. BANNER FINAL DE AYUDA Y ACCESOS RÁPIDOS */}
      <section className="bg-[#F2F5F2] pb-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="rounded-3xl bg-[#063B2E] p-8 text-center text-white sm:p-12">
            <h2 className="text-2xl font-bold sm:text-3xl">
              ¿Tienes dudas o quieres probar todos los perfiles?
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-base text-white/90 sm:text-lg">
              Consulta el Centro de Ayuda con lectura en voz alta, o entra en 1
              clic a las cuentas de demostración de Hogares, Negocios y
              Coordinadores.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/ayuda"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#F6C400] px-6 py-3 text-base font-bold text-[#063B2E] transition hover:bg-[#F28C00] hover:text-white"
              >
                <HelpCircle className="h-5 w-5" />
                <span>Centro de Ayuda y Reglas</span>
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#168A2E] px-6 py-3 text-base font-bold text-white transition hover:bg-[#65A90A] hover:text-[#063B2E]"
              >
                <span>Entrar / Acceso Rápido Demo</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/coordinacion"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-2 border-white/70 px-6 py-3 text-base font-bold text-white transition hover:bg-white hover:text-[#063B2E]"
              >
                <span>Consola de Coordinadores</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
