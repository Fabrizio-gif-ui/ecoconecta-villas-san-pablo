"use client";

import {
  Award,
  CalendarClock,
  CheckCircle2,
  Gift,
  HelpCircle,
  Loader2,
  MessageSquare,
  PlusCircle,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import BackButton from "@/components/BackButton";
import PointsAndBenefitsView from "@/components/PointsAndBenefitsView";
import { EstadoBadge, FlujoBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  formatPts,
  type MiResumenPuntos,
  type SolicitudCiudadano,
} from "@/lib/types";

export default function MiCuentaPage() {
  const { user, loading, isCoordinatorOrAdmin, refreshUser } = useAuth();
  const router = useRouter();

  const [solicitudes, setSolicitudes] = useState<SolicitudCiudadano[]>([]);
  const [puntos, setPuntos] = useState<MiResumenPuntos | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"solicitudes" | "puntos">("solicitudes");
  const [openChatId, setOpenChatId] = useState<number | null>(null);
  const [draftMsg, setDraftMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const loadData = useCallback(async (syncUser = false) => {
    setFetching(true);
    setError(null);
    try {
      const [sols, pts] = await Promise.all([
        apiFetch<SolicitudCiudadano[]>("/solicitudes/mias"),
        apiFetch<MiResumenPuntos>("/solicitudes/mias/puntos"),
      ]);
      setSolicitudes(sols);
      setPuntos(pts);
      if (syncUser) {
        await refreshUser();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos cargar los datos de tu cuenta en este momento."
      );
    } finally {
      setFetching(false);
    }
  }, [refreshUser]);

  const userId = user?.id;

  useEffect(() => {
    if (!loading) {
      if (!userId) {
        router.replace("/login?next=/mi-cuenta");
      } else {
        void loadData(false);
      }
    }
  }, [loading, userId, router, loadData]);

  const handleSendMessage = async (e: FormEvent, solicitudId: number) => {
    e.preventDefault();
    if (!draftMsg.trim()) return;
    setSendingMsg(true);
    try {
      await apiFetch(`/solicitudes/${solicitudId}/mensajes`, {
        method: "POST",
        body: JSON.stringify({ contenido: draftMsg.trim() }),
      });
      setDraftMsg("");
      await loadData();
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-huerta-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton href="/" label="Volver al inicio" />
        <Link
          href="/ayuda"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-stone-300 bg-white px-3.5 py-2 text-sm font-extrabold text-stone-800 hover:bg-stone-100"
        >
          <HelpCircle className="h-4 w-4 text-sol-600" />
          <span>Ver reglas y ayuda</span>
        </Link>
      </div>

      {/* Header */}
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black text-stone-900 sm:text-3xl">
              Hola, {user.nombre}
            </h1>
            {user.es_piloto && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sol-100 px-3 py-1 text-xs font-extrabold text-sol-700">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Piloto Villas de San Pablo</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-base text-stone-700">
            Revisa tus pedidos de recolección, la hora acordada con el
            coordinador y tus puntos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isCoordinatorOrAdmin && (
            <Link href="/coordinacion" className="eco-btn-amber text-sm">
              <span>Ir a /coordinacion</span>
            </Link>
          )}
          {!isCoordinatorOrAdmin && (
            <>
              <Link href="/mis-puntos" className="eco-btn-amber text-sm">
                <Gift className="h-5 w-5" />
                <span>Mis Puntos y Beneficios</span>
              </Link>
              <Link href="/solicitar" className="eco-btn-primary text-sm">
                <PlusCircle className="h-5 w-5" />
                <span>Pedir Recolección</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-sol-400/60 bg-sol-50 p-5">
          <div className="flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wider text-sol-700">
            <span className="flex items-center gap-1.5">
              <Award className="h-4 w-4" />
              <span>Mis puntos disponibles</span>
            </span>
            {puntos && (
              <span className="rounded-full bg-huerta-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                {puntos.progreso_nivel.nivel_actual}
              </span>
            )}
          </div>
          <p className="mt-2 text-3xl font-black text-stone-900">
            {formatPts(puntos?.puntos_disponibles ?? user.puntos_acumulados)}{" "}
            pts
          </p>
        </div>

        <div className="rounded-2xl border-2 border-huerta-200 bg-huerta-50/70 p-5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-huerta-800">
            <Scale className="h-4 w-4" />
            <span>Peso entregado</span>
          </div>
          <p className="mt-2 text-3xl font-black text-huerta-900">
            {puntos ? `${puntos.total_kg.toFixed(2)} kg` : "0.00 kg"}
          </p>
        </div>

        <div className="eco-card p-5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-stone-600">
            <CheckCircle2 className="h-4 w-4 text-huerta-600" />
            <span>Entregas completadas</span>
          </div>
          <p className="mt-2 text-3xl font-black text-stone-900">
            {puntos?.recolecciones_completadas ?? 0}
          </p>
        </div>
      </div>

      {/* Mandatory RN-06 disclaimer */}
      <p className="mt-3 rounded-xl border-2 border-sol-400/50 bg-white px-4 py-3 text-sm font-bold text-stone-700">
        <strong>Nota (RN-06):</strong>{" "}
        {puntos?.nota_institucional ||
          "Cálculo de puntos y beneficios referenciales y parametrizables; valores sujetos a validación oficial de la Fundación Santo Domingo."}
      </p>

      {/* Tabs */}
      <div className="mt-7 flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        <button
          type="button"
          onClick={() => setTab("solicitudes")}
          className={`min-h-[48px] rounded-xl px-4 text-base font-extrabold transition ${
            tab === "solicitudes"
              ? "bg-stone-900 text-white"
              : "border-2 border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
          }`}
        >
          Mis Pedidos de Recolección ({solicitudes.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("puntos")}
          className={`inline-flex min-h-[48px] items-center gap-2 rounded-xl px-4 text-base font-extrabold transition ${
            tab === "puntos"
              ? "bg-stone-900 text-white"
              : "border-2 border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
          }`}
        >
          <Gift className="h-5 w-5" />
          <span>Mis Puntos y Beneficios</span>
        </button>
      </div>

      {fetching ? (
        <div className="flex flex-col items-center justify-center gap-3 py-14">
          <Loader2 className="h-7 w-7 animate-spin text-[#168A2E]" />
          <p className="text-sm font-semibold text-[#063B2E]">
            Cargando tus pedidos y puntos...
          </p>
        </div>
      ) : error ? (
        <div className="eco-card mt-5 border-2 border-rose-300 bg-rose-50 p-6 text-center">
          <p className="text-base font-bold text-rose-900">{error}</p>
          <button
            type="button"
            onClick={() => void loadData(true)}
            className="eco-btn-primary mt-4"
          >
            <span>Reintentar ahora</span>
          </button>
        </div>
      ) : tab === "solicitudes" ? (
        <div className="mt-5 space-y-4">
          {solicitudes.length === 0 ? (
            <div className="eco-card p-8 text-center">
              <p className="text-lg font-extrabold text-stone-900">
                Aún no has pedido ninguna recolección.
              </p>
              <p className="mt-1 text-base text-stone-600">
                Separa tus orgánicos o reciclables y haz tu primer pedido en 1
                minuto.
              </p>
              <Link href="/solicitar" className="eco-btn-primary mt-4">
                <span>Pedir mi primera recolección</span>
              </Link>
            </div>
          ) : (
            solicitudes.map((sol) => {
              const chatOpen = openChatId === sol.id;
              return (
                <article key={sol.id} className="eco-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-black text-stone-900">
                          {sol.codigo}
                        </span>
                        <FlujoBadge flujo={sol.flujo} />
                        <EstadoBadge estado={sol.estado} />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-stone-600">
                        Pedido el{" "}
                        {new Date(sol.creado_en).toLocaleString("es-CO")} ·{" "}
                        {sol.direccion}
                      </p>
                    </div>

                    {sol.estado === "recolectada" && (
                      <div className="rounded-xl bg-huerta-50 px-4 py-2.5 text-right">
                        <p className="text-xs font-extrabold text-huerta-800">
                          {sol.peso_ingresado != null && sol.unidad_medida
                            ? `${sol.peso_ingresado.toFixed(2)} ${sol.unidad_medida}`
                            : `${sol.peso_kg_registrado?.toFixed(2) ?? "0.00"} kg`}
                          {sol.unidad_medida === "lb" &&
                            sol.peso_kg_registrado != null &&
                            ` (${sol.peso_kg_registrado.toFixed(2)} kg)`}
                        </p>
                        <p className="text-base font-black text-sol-700">
                          +{formatPts(sol.puntos_otorgados)} pts ganados
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Coordinador intermediario y cita */}
                  <div className="mt-4 grid gap-3 rounded-xl bg-stone-50 p-4 text-base sm:grid-cols-2">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-huerta-600" />
                      <div>
                        <p className="text-xs font-extrabold uppercase text-stone-500">
                          Coordinador que te atiende
                        </p>
                        <p className="font-black text-stone-900">
                          {sol.coordinador_nombre || sol.coordinador_rol_label}
                        </p>
                        <p className="text-xs font-semibold text-stone-600">
                          {sol.coordinador_rol_label}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-reciclaje-600" />
                      <div>
                        <p className="text-xs font-extrabold uppercase text-stone-500">
                          Día y hora acordados
                        </p>
                        {sol.fecha_programada ? (
                          <p className="font-black text-reciclaje-700">
                            {sol.fecha_programada} a las {sol.hora_programada}
                          </p>
                        ) : (
                          <p className="text-sm font-semibold text-stone-700">
                            El coordinador te confirmará pronto (Tu horario:{" "}
                            {sol.preferencia_horaria || "Por acordar"})
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {sol.observaciones && (
                    <p className="mt-3 text-sm text-stone-700">
                      <strong>Lo que indicaste:</strong> {sol.observaciones}
                    </p>
                  )}

                  {/* Toggle chat con coordinador */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
                    <span className="text-xs font-semibold text-stone-500">
                      Seguimiento: {sol.historial_estados.length} actualización(es)
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenChatId(chatOpen ? null : sol.id)}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-stone-300 bg-white px-4 text-sm font-extrabold text-stone-800 hover:bg-stone-50"
                    >
                      <MessageSquare className="h-4 w-4 text-huerta-600" />
                      <span>
                        {chatOpen
                          ? "Cerrar conversación"
                          : `Hablar con el coordinador (${sol.mensajes.length})`}
                      </span>
                    </button>
                  </div>

                  {chatOpen && (
                    <div className="mt-4 rounded-2xl border-2 border-stone-200 bg-stone-50 p-4">
                      <p className="text-sm font-extrabold text-stone-700">
                        Conversación directa con{" "}
                        {sol.coordinador_nombre || "tu coordinador"}:
                      </p>
                      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                        {sol.mensajes.length === 0 ? (
                          <p className="text-sm text-stone-600">
                            Aún no hay mensajes. Escríbele aquí si necesitas
                            avisar algo sobre tu entrega.
                          </p>
                        ) : (
                          sol.mensajes.map((m) => {
                            const mine = m.remitente_id === user.id;
                            return (
                              <div
                                key={m.id}
                                className={`rounded-xl px-3.5 py-2.5 text-sm ${
                                  mine
                                    ? "ml-6 bg-huerta-600 text-white"
                                    : "mr-6 border border-stone-200 bg-white text-stone-800"
                                }`}
                              >
                                <p className="font-extrabold opacity-90">
                                  {m.remitente_nombre}
                                </p>
                                <p className="mt-0.5 leading-relaxed">
                                  {m.contenido}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {sol.estado !== "recolectada" &&
                        sol.estado !== "cancelada" && (
                          <form
                            onSubmit={(e) => handleSendMessage(e, sol.id)}
                            className="mt-3 flex gap-2"
                          >
                            <input
                              type="text"
                              value={draftMsg}
                              onChange={(e) => setDraftMsg(e.target.value)}
                              placeholder="Escribe tu mensaje al coordinador..."
                              className="eco-input py-2 text-base"
                            />
                            <button
                              type="submit"
                              disabled={sendingMsg}
                              className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-huerta-600 px-4 text-sm font-extrabold text-white hover:bg-huerta-700 disabled:opacity-60"
                            >
                              <Send className="h-4 w-4" />
                              <span>Enviar</span>
                            </button>
                          </form>
                        )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      ) : puntos ? (
        <div className="mt-5">
          <PointsAndBenefitsView
            data={puntos}
            onRefresh={() => loadData(true)}
          />
        </div>
      ) : null}
    </div>
  );
}
