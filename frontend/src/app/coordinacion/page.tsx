"use client";

import {
  Leaf,
  Loader2,
  Lock,
  Recycle,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import BackButton from "@/components/BackButton";
import CoordinatorConsole from "@/components/CoordinatorConsole";
import { useAuth } from "@/context/AuthContext";

export default function CoordinacionPage() {
  const { user, loading, isCoordinatorOrAdmin, demoLogin } = useAuth();
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleQuickCoordinatorAccess = async (email: string) => {
    setBusyRole(email);
    setErrMsg(null);
    try {
      await demoLogin(email);
    } catch (err) {
      setErrMsg(
        err instanceof Error
          ? err.message
          : "No pudimos abrir la cuenta de coordinación."
      );
    } finally {
      setBusyRole(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#168A2E]" />
      </div>
    );
  }

  if (!user || !isCoordinatorOrAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <BackButton
          href={user ? "/mi-cuenta" : "/"}
          label={user ? "Volver a Mi Cuenta" : "Volver al inicio"}
        />
        <div className="eco-card mt-5 border-2 border-[#063B2E] p-7 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#063B2E] text-[#F6C400]">
            {user ? (
              <ShieldAlert className="h-7 w-7" />
            ) : (
              <Lock className="h-7 w-7" />
            )}
          </span>
          <h1 className="mt-4 text-2xl font-bold text-[#063B2E]">
            Consola Operativa de Coordinación (/coordinacion)
          </h1>
          <p className="mt-2 text-base text-[#202522]">
            {user ? (
              <>
                Actualmente estás conectado como{" "}
                <strong>{user.nombre}</strong> (Hogar / Unidad Productiva). Para
                entrar a la bandeja operativa de coordinadores (RN-01), elige en{" "}
                <strong>1 clic</strong> qué rol de coordinación deseas abrir:
              </>
            ) : (
              <>
                Esta ruta (<code>/coordinacion</code>) es para los líderes de
                los colectivos de Villas de San Pablo. Entra en{" "}
                <strong>1 clic</strong> con cualquiera de los perfiles de
                coordinación:
              </>
            )}
          </p>

          {errMsg && (
            <p className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-900">
              {errMsg}
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              disabled={busyRole !== null}
              onClick={() =>
                void handleQuickCoordinatorAccess("coord.huerta@villas.demo")
              }
              className="eco-btn-primary flex-col py-4 text-sm"
            >
              {busyRole === "coord.huerta@villas.demo" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Leaf className="h-6 w-6 text-[#F6C400]" />
              )}
              <span>Coord. Huerteros</span>
              <span className="text-[11px] font-normal opacity-90">
                Flujo Orgánico (RN-01)
              </span>
            </button>

            <button
              type="button"
              disabled={busyRole !== null}
              onClick={() =>
                void handleQuickCoordinatorAccess("coord.reciclaje@villas.demo")
              }
              className="eco-btn-teal flex-col py-4 text-sm"
            >
              {busyRole === "coord.reciclaje@villas.demo" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Recycle className="h-6 w-6 text-[#F6C400]" />
              )}
              <span>Coord. Recicladores</span>
              <span className="text-[11px] font-normal opacity-90">
                Flujo Reciclable (RN-01)
              </span>
            </button>

            <button
              type="button"
              disabled={busyRole !== null}
              onClick={() =>
                void handleQuickCoordinatorAccess("admin@villas.demo")
              }
              className="eco-btn-amber flex-col py-4 text-sm"
            >
              {busyRole === "admin@villas.demo" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-[#063B2E]" />
              )}
              <span>Administrador</span>
              <span className="text-[11px] font-normal opacity-90">
                Supervisión Global
              </span>
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-[#D8E2DC] pt-4">
            {user && (
              <Link href="/mi-cuenta" className="eco-btn-outline text-sm">
                <span>Volver a Mi Cuenta ({user.nombre})</span>
              </Link>
            )}
            <Link
              href="/login?next=/coordinacion"
              className="text-sm font-bold text-[#063B2E] underline hover:text-[#168A2E]"
            >
              O iniciar sesión con otro correo y contraseña
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <CoordinatorConsole />;
}
