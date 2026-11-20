"use client";

import { AlertTriangle, Award, Loader2, PlusCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import BackButton from "@/components/BackButton";
import PointsAndBenefitsView from "@/components/PointsAndBenefitsView";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { MiResumenPuntos } from "@/lib/types";

export default function MisPuntosPage() {
  const { user, loading, isCoordinatorOrAdmin, refreshUser } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MiResumenPuntos | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (syncUser = false) => {
    setFetching(true);
    setError(null);
    try {
      const res = await apiFetch<MiResumenPuntos>("/solicitudes/mias/puntos");
      setData(res);
      if (syncUser) {
        await refreshUser();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos cargar tus puntos y beneficios en este momento."
      );
    } finally {
      setFetching(false);
    }
  }, [refreshUser]);

  const userId = user?.id;

  useEffect(() => {
    if (!loading) {
      if (!userId) {
        router.replace("/login?next=/mis-puntos");
      } else {
        void loadData(false);
      }
    }
  }, [loading, userId, router, loadData]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#168A2E]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton href="/mi-cuenta" label="Volver a Mi Cuenta" />
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/mi-cuenta" className="eco-btn-outline text-sm">
            <span>Ver Mis Pedidos</span>
          </Link>
          {!isCoordinatorOrAdmin && (
            <Link href="/solicitar" className="eco-btn-primary text-sm">
              <PlusCircle className="h-5 w-5" />
              <span>Solicitar Recolección</span>
            </Link>
          )}
        </div>
      </div>

      <div className="mt-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#063B2E] sm:text-3xl">
          <Award className="h-7 w-7 text-[#F28C00]" />
          <span>Mis Puntos y Beneficios</span>
        </h1>
        <p className="mt-1 text-base text-[#202522]">
          Mira tu avance de nivel, reclama beneficios y consulta cada entrega
          acreditada en <strong>{user.nombre}</strong>.
        </p>
      </div>

      <div className="mt-6">
        {fetching ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14">
            <Loader2 className="h-7 w-7 animate-spin text-[#168A2E]" />
            <p className="text-sm font-semibold text-[#063B2E]">
              Cargando tus puntos y catálogo de beneficios...
            </p>
          </div>
        ) : error ? (
          <div className="eco-card border-2 border-rose-300 bg-rose-50 p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-700" />
            <p className="mt-2 text-base font-bold text-rose-900">{error}</p>
            <button
              type="button"
              onClick={() => void loadData(true)}
              className="eco-btn-primary mt-4"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reintentar ahora</span>
            </button>
          </div>
        ) : data ? (
          <PointsAndBenefitsView
            data={data}
            onRefresh={() => loadData(true)}
          />
        ) : null}
      </div>
    </div>
  );
}
