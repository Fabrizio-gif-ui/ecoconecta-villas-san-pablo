"use client";

import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  Leaf,
  Loader2,
  Lock,
  MessageCircle,
  Recycle,
  Search,
  ShieldCheck,
  Sprout,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import BackButton from "@/components/BackButton";
import SpeakButton from "@/components/SpeakButton";
import { FlujoBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import type { CentroAyuda, TemaAyuda } from "@/lib/types";

function TopicIcon({ name, active }: { name: string; active: boolean }) {
  const cls = `h-7 w-7 ${active ? "text-white" : "text-huerta-700"}`;
  switch (name) {
    case "leaf":
      return <Leaf className={cls} />;
    case "clock":
      return <Clock className={cls} />;
    case "shield":
      return <ShieldCheck className={cls} />;
    case "award":
      return <Award className={cls} />;
    case "lock":
      return <Lock className={cls} />;
    default:
      return <HelpCircle className={cls} />;
  }
}

export default function AyudaPage() {
  const [data, setData] = useState<CentroAyuda | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [openIds, setOpenIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    apiFetch<CentroAyuda>("/public/ayuda", { auth: false })
      .then((res) => {
        setData(res);
        // Abrir la primera pregunta de cada tema por defecto para facilitar lectura
        const defaults: Record<number, boolean> = {};
        for (const t of res.temas) {
          if (t.preguntas[0]) {
            defaults[t.preguntas[0].id] = true;
          }
        }
        setOpenIds(defaults);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredTemas = useMemo<TemaAyuda[]>(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();

    return data.temas
      .filter((tema) => selectedSlug === "todos" || tema.slug === selectedSlug)
      .map((tema) => {
        if (!q) return tema;
        const matchingPreguntas = tema.preguntas.filter(
          (p) =>
            p.pregunta.toLowerCase().includes(q) ||
            p.puntos_clave.some((pt) => pt.toLowerCase().includes(q))
        );
        return {
          ...tema,
          preguntas: matchingPreguntas,
        };
      })
      .filter((tema) => tema.preguntas.length > 0);
  }, [data, selectedSlug, searchQuery]);

  const toggleAccordion = (id: number) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Botón Volver siempre visible */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton href="/" label="Volver al inicio" />
        <SpeakButton
          label="Escuchar bienvenida"
          text="Bienvenido al Centro de Ayuda y Reglamentos de EcoConecta Villas de San Pablo. Aquí puedes tocar cualquier tema para conocer cómo separar tus residuos, los horarios de entrega, con quién hablar, cómo ganar puntos y cómo cuidamos tus datos. Cada tarjeta tiene un botón para escuchar la explicación en voz alta."
        />
      </div>

      {/* Encabezado cercano */}
      <div className="mt-6 rounded-3xl border-2 border-huerta-200 bg-gradient-to-br from-huerta-50 via-white to-sol-50 p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-huerta-600 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-white">
          <HelpCircle className="h-4 w-4" />
          <span>Centro de Ayuda y Reglamentos · Estilo Cataki</span>
        </span>
        <h1 className="mt-3 text-2xl font-black leading-tight text-stone-950 sm:text-4xl">
          ¿Cómo podemos ayudarte? Reglas claras para cuidar Villas de San Pablo
        </h1>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-stone-700 sm:text-lg">
          Toca uno de los 5 temas de abajo o escribe tu duda. Todas las
          respuestas tienen el botón <strong>🔊 Escuchar</strong> para que
          puedas oírlas desde tu celular.
        </p>

        {/* Buscador simple */}
        <div className="relative mt-5 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Busca una palabra: horario, balde, puntos, coordinador..."
            aria-label="Buscar en el centro de ayuda"
            className="eco-input pl-12"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-huerta-600" />
        </div>
      ) : (
        <>
          {/* Ayuda por temas — 5 tarjetas grandes clicables */}
          <section className="mt-8" aria-label="Ayuda por temas">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-black text-stone-900">
                Ayuda por temas (toca un tema para filtrar)
              </h2>
              {selectedSlug !== "todos" && (
                <button
                  type="button"
                  onClick={() => setSelectedSlug("todos")}
                  className="min-h-[44px] rounded-xl border-2 border-stone-300 bg-white px-4 py-2 text-sm font-extrabold text-stone-800 hover:bg-stone-100"
                >
                  Ver los 5 temas
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {data?.temas.map((tema) => {
                const active = selectedSlug === tema.slug;
                return (
                  <button
                    key={tema.id}
                    type="button"
                    onClick={() =>
                      setSelectedSlug(active ? "todos" : tema.slug)
                    }
                    className={`flex min-h-[110px] items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition ${
                      active
                        ? "border-huerta-700 bg-huerta-600 text-white shadow-md"
                        : "border-stone-200 bg-white text-stone-900 hover:border-huerta-500 hover:bg-huerta-50/50"
                    }`}
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                        active ? "bg-white/20" : "bg-huerta-100"
                      }`}
                    >
                      <TopicIcon name={tema.icono} active={active} />
                    </span>
                    <div>
                      <p className="text-base font-black leading-snug">
                        {tema.titulo}
                      </p>
                      <p
                        className={`mt-1 text-sm leading-snug ${
                          active ? "text-white/90" : "text-stone-600"
                        }`}
                      >
                        {tema.subtitulo}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Acordeones desplegables estilo Cataki con botón 🔊 Escuchar */}
          <section className="mt-10 space-y-8" aria-label="Preguntas y reglas">
            {filteredTemas.length === 0 ? (
              <div className="eco-card p-8 text-center">
                <p className="text-lg font-extrabold text-stone-900">
                  No encontramos resultados para &ldquo;{searchQuery}&rdquo;
                </p>
                <p className="mt-1 text-base text-stone-600">
                  Prueba con otra palabra o toca &ldquo;Ver los 5 temas&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSlug("todos");
                  }}
                  className="eco-btn-primary mt-4"
                >
                  Mostrar todas las preguntas
                </button>
              </div>
            ) : (
              filteredTemas.map((tema) => (
                <div key={tema.id} className="space-y-3.5">
                  <div className="border-b-2 border-stone-200 pb-2">
                    <h3 className="text-xl font-black text-stone-900">
                      {tema.titulo}
                    </h3>
                    <p className="text-base text-stone-600">{tema.subtitulo}</p>
                  </div>

                  <div className="space-y-3">
                    {tema.preguntas.map((preg) => {
                      const isOpen = Boolean(openIds[preg.id]);
                      const speechText = `${preg.pregunta}. ${preg.puntos_clave.join(
                        " "
                      )}`;

                      return (
                        <article
                          key={preg.id}
                          className="rounded-2xl border-2 border-stone-200 bg-white shadow-sm transition"
                        >
                          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                            <button
                              type="button"
                              onClick={() => toggleAccordion(preg.id)}
                              aria-expanded={isOpen}
                              className="flex flex-1 items-center justify-between gap-3 text-left"
                            >
                              <div className="space-y-1">
                                {preg.flujo_relacionado && (
                                  <FlujoBadge
                                    flujo={
                                      preg.flujo_relacionado as
                                        | "organico"
                                        | "reciclable"
                                        | "no_aprovechable"
                                    }
                                  />
                                )}
                                <h4 className="text-lg font-black text-stone-900">
                                  {preg.pregunta}
                                </h4>
                              </div>
                              <span className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl bg-stone-100 px-3 py-2 text-xs font-extrabold text-stone-800">
                                {isOpen ? (
                                  <>
                                    <ChevronUp className="h-5 w-5" />
                                    <span>Ocultar</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-5 w-5" />
                                    <span>Ver regla</span>
                                  </>
                                )}
                              </span>
                            </button>

                            <SpeakButton
                              text={speechText}
                              label="Escuchar"
                              className="sm:shrink-0"
                            />
                          </div>

                          {isOpen && (
                            <div className="border-t border-stone-200 bg-stone-50/70 px-5 py-4">
                              <ul className="space-y-2.5 text-base leading-relaxed text-stone-800">
                                {preg.puntos_clave.map((punto, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-2.5"
                                  >
                                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-huerta-600" />
                                    <span>{punto}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Nota obligatoria RN-06 */}
          <div className="mt-8 rounded-2xl border-2 border-sol-400/60 bg-sol-50 p-4 text-sm font-bold text-stone-800">
            <strong>Nota legal y académica (RN-06):</strong>{" "}
            {data?.nota_institucional ||
              "Cálculo de puntos y beneficios referenciales y parametrizables; valores sujetos a validación oficial de la Fundación Santo Domingo."}
          </div>

          {/* Caja final: "¿Tienes otra duda?" que dirige al coordinador correspondiente */}
          <section className="mt-8 rounded-3xl border-2 border-stone-900 bg-stone-900 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sol-400 px-3 py-1 text-xs font-extrabold text-stone-950">
                  <MessageCircle className="h-4 w-4" />
                  <span>Acompañamiento comunitario</span>
                </span>
                <h2 className="mt-2.5 text-2xl font-black">
                  ¿Tienes otra duda? Habla con el coordinador de tu flujo
                </h2>
                <p className="mt-1 text-base text-stone-200">
                  Recuerda que en Villas de San Pablo nunca quedas sin respuesta:
                  cada colectivo tiene su líder coordinador autorizado.
                </p>
              </div>
              <SpeakButton
                label="Escuchar contacto"
                text="Si tienes otra duda, comunícate con el coordinador de tu colectivo. Para residuos orgánicos de la huerta te atiende la Coordinación de Huerteros. Para material reciclable te atiende la Coordinación de Recicladores. Puedes pedir recolección o enviarles un mensaje desde Mi Cuenta."
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {data?.canales_coordinacion.map((canal) => {
                const isOrg = canal.flujo === "organico";
                return (
                  <div
                    key={canal.flujo}
                    className={`flex flex-col justify-between rounded-2xl border-2 p-5 ${
                      isOrg
                        ? "border-huerta-500/60 bg-huerta-900/50"
                        : "border-reciclaje-500/60 bg-reciclaje-700/30"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                            isOrg
                              ? "bg-huerta-600 text-white"
                              : "bg-reciclaje-600 text-white"
                          }`}
                        >
                          {isOrg ? (
                            <Sprout className="h-6 w-6" />
                          ) : (
                            <Recycle className="h-6 w-6" />
                          )}
                        </span>
                        <div>
                          <h3 className="text-base font-black text-white">
                            {canal.etiqueta_colectivo}
                          </h3>
                          <p className="text-sm font-bold text-sol-300">
                            Coordinador(a): {canal.coordinador_nombre}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-stone-200">
                        <strong>Horario de referencia:</strong>{" "}
                        {canal.horario_atencion}
                      </p>
                      <p className="mt-1.5 text-sm text-stone-300">
                        {canal.mensaje_orientacion}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Link
                        href={`/solicitar?flujo=${canal.flujo}`}
                        className={
                          isOrg
                            ? "eco-btn-primary flex-1 text-sm"
                            : "eco-btn-teal flex-1 text-sm"
                        }
                      >
                        <Truck className="h-4 w-4" />
                        <span>
                          Pedir recolección{" "}
                          {isOrg ? "orgánica" : "reciclable"}
                        </span>
                      </Link>
                      <Link
                        href="/mi-cuenta"
                        className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border-2 border-white/30 px-4 py-2 text-sm font-extrabold text-white hover:bg-white/10"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Escribir en Mi Cuenta</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
