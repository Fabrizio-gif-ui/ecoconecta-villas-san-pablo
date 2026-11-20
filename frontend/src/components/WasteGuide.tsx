"use client";

import {
  Apple,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  Coffee,
  CupSoda,
  FileText,
  Leaf,
  Milk,
  Package,
  Recycle,
  Search,
  Sprout,
  Wine,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import SpeakButton from "@/components/SpeakButton";
import { FlujoBadge } from "@/components/StatusBadge";
import type { GuiaResiduo } from "@/lib/types";

function ItemIcon({ name, flujo }: { name: string; flujo: string }) {
  const color =
    flujo === "organico"
      ? "text-[#168A2E]"
      : flujo === "reciclable"
        ? "text-[#0A9B70]"
        : "text-stone-500";
  const cls = `h-7 w-7 ${color}`;

  switch (name) {
    case "apple":
      return <Apple className={cls} />;
    case "coffee":
      return <Coffee className={cls} />;
    case "sprout":
      return <Sprout className={cls} />;
    case "leaf":
      return <Leaf className={cls} />;
    case "milk":
      return <Milk className={cls} />;
    case "package":
      return <Package className={cls} />;
    case "file-text":
      return <FileText className={cls} />;
    case "cup-soda":
      return <CupSoda className={cls} />;
    case "wine":
      return <Wine className={cls} />;
    default:
      return <Ban className={cls} />;
  }
}

export default function WasteGuide({ items }: { items: GuiaResiduo[] }) {
  const [filter, setFilter] = useState<
    "organico" | "reciclable" | "no_aprovechable" | "todos"
  >("organico");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (q) {
        return (
          item.nombre.toLowerCase().includes(q) ||
          item.categoria.toLowerCase().includes(q) ||
          item.descripcion.toLowerCase().includes(q) ||
          item.buenas_practicas.toLowerCase().includes(q)
        );
      }
      if (filter !== "todos" && item.flujo !== filter) return false;
      return true;
    });
  }, [items, filter, query]);

  return (
    <section id="guia" className="scroll-mt-24 bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Encabezado limpio estilo ecoins.eco */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1EFE4] px-4 py-1.5 text-sm font-bold text-[#063B2E]">
            ¿Qué residuos recibimos?
          </span>
          <h2 className="mt-3 text-3xl font-bold text-[#063B2E] sm:text-4xl">
            Elige un grupo para ver qué puedes entregar
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-[#202522]">
            Toca un botón grande abajo o escribe el nombre de cualquier residuo.
            Cada tarjeta tiene <strong>🔊 Escuchar</strong>.
          </p>
        </div>

        {/* Pestañas gigantes fáciles de tocar para tercera edad */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {(
            [
              {
                id: "organico",
                label: "🌱 Orgánicos (Huerta)",
                activeCls: "bg-[#168A2E] text-white border-[#168A2E]",
              },
              {
                id: "reciclable",
                label: "♻️ Reciclables (Limpios)",
                activeCls: "bg-[#0A9B70] text-white border-[#0A9B70]",
              },
              {
                id: "no_aprovechable",
                label: "🚫 No recibimos",
                activeCls: "bg-[#202522] text-white border-[#202522]",
              },
              {
                id: "todos",
                label: "Ver todos",
                activeCls: "bg-[#063B2E] text-white border-[#063B2E]",
              },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id && !query.trim();
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter(tab.id);
                }}
                className={`min-h-[52px] rounded-full border-2 px-6 py-2.5 text-base font-bold transition ${
                  active
                    ? `${tab.activeCls} shadow-sm`
                    : "border-[#C5D3CA] bg-white text-[#063B2E] hover:border-[#168A2E] hover:bg-[#F2F5F2]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Buscador amplio y sencillo */}
        <div className="mx-auto mt-6 max-w-lg">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#063B2E]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca un material: plátano, botella, cartón, café..."
              aria-label="Buscar residuo en la guía"
              className="min-h-[54px] w-full rounded-full border-2 border-[#C5D3CA] bg-[#F2F5F2] pl-12 pr-5 text-base text-[#202522] placeholder:text-stone-500 focus:border-[#168A2E] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Tarjetas limpias estilo ecoins.eco (solo 3–5 visibles por pestaña para no saturar) */}
        {filtered.length === 0 ? (
          <div className="mt-8 rounded-3xl border-2 border-dashed border-[#C5D3CA] bg-[#F2F5F2] p-8 text-center text-lg font-semibold text-[#202522]">
            No encontramos ese residuo con ese nombre. Puedes preguntarle al
            coordinador o revisar el Centro de Ayuda.
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const speechText = `${item.nombre}. ${
                item.flujo === "organico"
                  ? "Residuo orgánico para la huerta. Suma un punto por kilo o medio punto por libra."
                  : item.flujo === "reciclable"
                    ? "Material reciclable para los recicladores. Suma un punto por kilo o medio punto por libra."
                    : "Residuo no aprovechable, va al camión de aseo."
              } ${item.descripcion} Cómo alistarlo: ${item.buenas_practicas}`;

              return (
                <article
                  key={item.id}
                  className="flex flex-col justify-between rounded-3xl border border-[#D8E2DC] bg-white p-6 shadow-sm transition hover:border-[#168A2E]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                          item.flujo === "organico"
                            ? "bg-[#E1EFE4]"
                            : item.flujo === "reciclable"
                              ? "bg-[#CEF0E5]"
                              : "bg-stone-100"
                        }`}
                      >
                        <ItemIcon name={item.icono} flujo={item.flujo} />
                      </span>
                      <FlujoBadge flujo={item.flujo} />
                    </div>

                    <h3 className="mt-4 text-xl font-bold text-[#063B2E]">
                      {item.nombre}
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-[#202522]">
                      {item.descripcion}
                    </p>
                  </div>

                  <div className="mt-5 space-y-3 border-t border-[#E6EFE9] pt-4">
                    <div className="flex items-start gap-2 rounded-2xl bg-[#F2F5F2] p-3.5 text-sm leading-relaxed text-[#202522]">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#168A2E]" />
                      <span>
                        <strong>Cómo alistarlo:</strong> {item.buenas_practicas}
                      </span>
                    </div>

                    {item.flujo !== "no_aprovechable" && (
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-[#063B2E]">
                        <Clock className="h-4 w-4 shrink-0 text-[#0A9B70]" />
                        <span>{item.horario_referencia}</span>
                      </p>
                    )}

                    <SpeakButton
                      text={speechText}
                      label="🔊 Escuchar"
                      className="w-full"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Acción directa limpia debajo de la guía */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={
              filter === "reciclable"
                ? "/solicitar?flujo=reciclable"
                : "/solicitar?flujo=organico"
            }
            className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-[#168A2E] px-7 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#063B2E]"
          >
            {filter === "reciclable" ? (
              <Recycle className="h-5 w-5" />
            ) : (
              <Sprout className="h-5 w-5" />
            )}
            <span>
              {filter === "reciclable"
                ? "Pedir recolección de reciclables"
                : "Pedir recolección de orgánicos"}
            </span>
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/ayuda"
            className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border-2 border-[#063B2E] bg-white px-7 py-3 text-base font-bold text-[#063B2E] transition hover:bg-[#F2F5F2]"
          >
            <span>Ver todas las reglas y horarios</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
