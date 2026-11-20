"use client";

import {
  Award,
  CheckCircle2,
  Gift,
  History,
  Loader2,
  Lock,
  Sparkles,
  Sprout,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

import SpeakButton from "@/components/SpeakButton";
import { FlujoBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { formatPts, type Beneficio, type MiResumenPuntos } from "@/lib/types";

interface Props {
  data: MiResumenPuntos;
  onRefresh: () => Promise<void>;
}

export default function PointsAndBenefitsView({ data, onRefresh }: Props) {
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [notesById, setNotesById] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const handleRedeem = async (beneficio: Beneficio) => {
    setFeedback(null);
    setRedeemingId(beneficio.id);
    try {
      await apiFetch("/solicitudes/mias/canjes", {
        method: "POST",
        body: JSON.stringify({
          beneficio_id: beneficio.id,
          observaciones: notesById[beneficio.id]?.trim() || null,
        }),
      });
      setNotesById((prev) => ({ ...prev, [beneficio.id]: "" }));
      setFeedback({
        type: "ok",
        text: `¡Listo! Registramos tu solicitud de beneficio "${beneficio.nombre}" (-${formatPts(
          beneficio.puntos_requeridos
        )} puntos). El coordinador te avisará para entregarlo.`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: "err",
        text:
          err instanceof Error
            ? err.message
            : "No se pudo registrar el canje del beneficio.",
      });
    } finally {
      setRedeemingId(null);
    }
  };

  const progreso = data.progreso_nivel;

  return (
    <div className="space-y-6">
      {/* Progreso por niveles */}
      <div className="rounded-3xl border-2 border-huerta-200 bg-gradient-to-br from-huerta-50 via-white to-sol-50/70 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-huerta-600 px-3.5 py-1 text-xs font-extrabold text-white">
              <Sprout className="h-4 w-4" />
              <span>Nivel actual: {progreso.nivel_actual}</span>
            </span>
            <h2 className="mt-2.5 text-2xl font-black text-stone-900 sm:text-3xl">
              Tienes {formatPts(data.puntos_disponibles)} puntos disponibles
            </h2>
            <p className="mt-1 text-sm font-semibold text-stone-700">
              Total ganado: <strong>{formatPts(data.puntos_ganados)} pts</strong>{" "}
              · Canjeado: <strong>{formatPts(data.puntos_canjeados)} pts</strong>{" "}
              · Peso entregado: <strong>{data.total_kg.toFixed(2)} kg</strong>
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="rounded-2xl border-2 border-sol-400/60 bg-sol-50 px-4 py-3 text-left sm:text-right">
              <p className="text-xs font-extrabold uppercase tracking-wider text-sol-700">
                ¿Cómo se suman los puntos?
              </p>
              <p className="mt-0.5 text-base font-black text-stone-900">
                1 kilo (kg) = 1.0 punto · 1 libra = 0.5 puntos
              </p>
            </div>
            <SpeakButton
              label="Escuchar mis puntos"
              text={`Tienes ${formatPts(
                data.puntos_disponibles
              )} puntos disponibles. Tu nivel actual es ${
                progreso.nivel_actual
              }. Recuerda que cada kilo entregado suma un punto y cada libra suma medio punto.`}
            />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-extrabold text-stone-800">
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-huerta-600" />
              <span>
                {progreso.siguiente_beneficio_id
                  ? `Próximo beneficio: ${progreso.siguiente_nivel_nombre}`
                  : "¡Alcanzaste el nivel más alto!"}
              </span>
            </span>
            <span className="text-huerta-800">
              {progreso.porcentaje_avance.toFixed(0)}%
              {progreso.siguiente_beneficio_id &&
                ` · Te faltan ${formatPts(progreso.puntos_faltantes)} puntos`}
            </span>
          </div>
          <div className="mt-2 h-5 w-full overflow-hidden rounded-full bg-stone-200/90">
            <div
              className="h-full rounded-full bg-gradient-to-r from-huerta-500 via-huerta-600 to-sol-500 transition-all duration-500"
              style={{
                width: `${Math.min(Math.max(progreso.porcentaje_avance, 5), 100)}%`,
              }}
            />
          </div>
          <div className="mt-2.5 flex flex-wrap justify-between gap-2 text-xs font-extrabold text-stone-600">
            {data.beneficios.map((b) => (
              <span
                key={b.id}
                className={
                  b.desbloqueado ? "text-huerta-800" : "text-stone-500"
                }
              >
                {b.nombre.split("–")[0].trim()} ({formatPts(b.puntos_requeridos)}{" "}
                pts)
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Mandatory RN-06 Institutional Note */}
      <div className="rounded-2xl border-2 border-sol-400/50 bg-sol-50 px-4 py-3.5 text-sm font-bold text-stone-800">
        <strong>Nota importante (RN-06):</strong>{" "}
        {data.nota_institucional ||
          "Cálculo de puntos y beneficios referenciales y parametrizables; valores sujetos a validación oficial de la Fundación Santo Domingo."}
      </div>

      {feedback && (
        <div
          className={`rounded-2xl border-2 px-4 py-3.5 text-base font-bold ${
            feedback.type === "ok"
              ? "border-huerta-300 bg-huerta-50 text-huerta-900"
              : "border-rose-300 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Catálogo de Beneficios (Usuarios) */}
      <div>
        <div className="flex items-center gap-2">
          <Gift className="h-6 w-6 text-huerta-600" />
          <h3 className="text-xl font-black text-stone-900">
            Beneficios que puedes reclamar con tus puntos
          </h3>
        </div>
        <p className="mt-1 text-base text-stone-700">
          Cuando tengas los puntos necesarios, toca el botón verde{" "}
          <strong>Reclamar beneficio</strong>.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {data.beneficios.map((b) => {
            const busy = redeemingId === b.id;
            return (
              <article
                key={b.id}
                className={`flex flex-col justify-between rounded-2xl border-2 p-5 transition ${
                  b.desbloqueado
                    ? "border-huerta-500 bg-white shadow-sm"
                    : "border-stone-200 bg-stone-50/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-sol-100 px-3 py-1 text-xs font-black text-sol-700">
                      <Award className="h-3.5 w-3.5" />
                      <span>{formatPts(b.puntos_requeridos)} puntos</span>
                    </span>
                    {b.desbloqueado ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-huerta-100 px-2.5 py-1 text-xs font-extrabold text-huerta-800">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>¡Listo para reclamar!</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2.5 py-1 text-xs font-bold text-stone-700">
                        <Lock className="h-3.5 w-3.5" />
                        <span>Faltan {formatPts(b.puntos_faltantes)} pts</span>
                      </span>
                    )}
                  </div>

                  <h4 className="mt-3 text-lg font-black text-stone-900">
                    {b.nombre}
                  </h4>
                  <p className="mt-1.5 text-base leading-relaxed text-stone-700">
                    {b.descripcion}
                  </p>
                </div>

                <div className="mt-4 space-y-2.5 border-t border-stone-100 pt-3">
                  {b.desbloqueado && (
                    <input
                      type="text"
                      value={notesById[b.id] || ""}
                      onChange={(e) =>
                        setNotesById((prev) => ({
                          ...prev,
                          [b.id]: e.target.value,
                        }))
                      }
                      placeholder="Nota opcional (ej: pasar el sábado)"
                      className="eco-input py-2 text-sm"
                    />
                  )}
                  <button
                    type="button"
                    disabled={!b.desbloqueado || redeemingId !== null}
                    onClick={() => handleRedeem(b)}
                    className={
                      b.desbloqueado
                        ? "eco-btn-primary w-full text-sm"
                        : "inline-flex min-h-[48px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border-2 border-stone-200 bg-stone-100 px-4 text-sm font-bold text-stone-500"
                    }
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Registrando...</span>
                      </>
                    ) : b.desbloqueado ? (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        <span>
                          Reclamar beneficio ({formatPts(b.puntos_requeridos)}{" "}
                          pts)
                        </span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" />
                        <span>
                          Te faltan {formatPts(b.puntos_faltantes)} puntos
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Canjes Registrados */}
      {data.canjes.length > 0 && (
        <div className="eco-card overflow-hidden">
          <div className="border-b border-stone-200 px-5 py-4">
            <h3 className="flex items-center gap-2 text-base font-black text-stone-900">
              <Gift className="h-5 w-5 text-sol-600" />
              <span>Beneficios que ya reclamaste ({data.canjes.length})</span>
            </h3>
          </div>
          <div className="divide-y divide-stone-100">
            {data.canjes.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-base"
              >
                <div>
                  <p className="font-extrabold text-stone-900">
                    {c.beneficio_nombre}
                  </p>
                  <p className="text-xs font-semibold text-stone-500">
                    {new Date(c.creado_en).toLocaleString("es-CO")}
                    {c.observaciones ? ` · ${c.observaciones}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-huerta-100 px-3 py-1 text-xs font-extrabold uppercase text-huerta-800">
                    {c.estado}
                  </span>
                  <p className="mt-1 text-sm font-black text-rose-700">
                    -{formatPts(c.puntos_canjeados)} pts
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movimientos de Puntos */}
      <div className="eco-card overflow-hidden">
        <div className="border-b border-stone-200 px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-black text-stone-900">
            <History className="h-5 w-5 text-huerta-600" />
            <span>
              Historial de tus puntos sumados y canjeados (
              {data.movimientos.length})
            </span>
          </h3>
        </div>
        {data.movimientos.length === 0 ? (
          <p className="p-6 text-center text-base text-stone-600">
            Aún no tienes puntos registrados. Cuando el coordinador pese tu
            primera entrega, aparecerá aquí.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs font-extrabold uppercase text-stone-600">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Pedido / Beneficio</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Peso pesado</th>
                  <th className="px-4 py-3 text-right">Puntos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.movimientos.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 text-xs font-semibold text-stone-600">
                      {new Date(m.creado_en).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-stone-900">
                      {m.codigo_solicitud || m.beneficio_nombre || "Canje"}
                    </td>
                    <td className="px-4 py-3">
                      {m.flujo ? (
                        <FlujoBadge flujo={m.flujo} />
                      ) : (
                        <span className="rounded-full bg-sol-100 px-2.5 py-1 text-xs font-extrabold text-sol-700">
                          Canje de beneficio
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-stone-800">
                      {m.peso_ingresado !== null &&
                      m.peso_ingresado !== undefined ? (
                        <>
                          {m.peso_ingresado.toFixed(2)} {m.unidad_medida}
                          {m.unidad_medida === "lb" && m.peso_kg != null && (
                            <span className="block text-[11px] text-stone-500">
                              (equivale a {m.peso_kg.toFixed(2)} kg)
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-base font-black ${
                        m.puntos >= 0 ? "text-huerta-700" : "text-rose-700"
                      }`}
                    >
                      {m.puntos >= 0
                        ? `+${formatPts(m.puntos)}`
                        : formatPts(m.puntos)}{" "}
                      pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
