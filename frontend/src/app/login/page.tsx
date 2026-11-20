"use client";

import {
  Building2,
  Home,
  KeyRound,
  Leaf,
  Loader2,
  Recycle,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

import BackButton from "@/components/BackButton";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { DemoAccount, Usuario } from "@/lib/types";

function roleRedirect(user: Usuario, nextPath: string | null): string {
  const isCoord =
    user.rol === "coordinador_huerteros" ||
    user.rol === "coordinador_recicladores" ||
    user.rol === "administrador";
  if (nextPath && nextPath.startsWith("/")) {
    if (nextPath.startsWith("/coordinacion") && !isCoord) {
      return "/mi-cuenta";
    }
    return nextPath;
  }
  return isCoord ? "/coordinacion" : "/mi-cuenta";
}

function demoBadgeStyle(rol: DemoAccount["rol"]) {
  switch (rol) {
    case "coordinador_huerteros":
      return {
        card: "border-huerta-300 bg-huerta-50/80 hover:border-huerta-600",
        pill: "bg-huerta-600 text-white",
        Icon: Leaf,
      };
    case "coordinador_recicladores":
      return {
        card: "border-reciclaje-300 bg-reciclaje-50/80 hover:border-reciclaje-600",
        pill: "bg-reciclaje-600 text-white",
        Icon: Recycle,
      };
    case "administrador":
      return {
        card: "border-stone-300 bg-stone-100 hover:border-stone-800",
        pill: "bg-stone-900 text-white",
        Icon: ShieldCheck,
      };
    case "unidad_productiva":
      return {
        card: "border-sol-400 bg-sol-50 hover:border-sol-600",
        pill: "bg-sol-400 text-stone-950",
        Icon: Building2,
      };
    default:
      return {
        card: "border-stone-300 bg-white hover:border-huerta-600",
        pill: "bg-huerta-100 text-huerta-800",
        Icon: Home,
      };
  }
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const { login, demoLogin, register } = useAuth();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [regNombre, setRegNombre] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRol, setRegRol] = useState<"hogar" | "unidad_productiva">("hogar");
  const [regTelefono, setRegTelefono] = useState("");
  const [regDireccion, setRegDireccion] = useState("");

  useEffect(() => {
    apiFetch<DemoAccount[]>("/auth/demo-accounts", { auth: false })
      .then(setDemoAccounts)
      .catch(() => setDemoAccounts([]));
  }, []);

  const handleDemoClick = async (demoEmail: string) => {
    setError(null);
    setBusyEmail(demoEmail);
    try {
      const user = await demoLogin(demoEmail);
      router.push(roleRedirect(user, nextPath));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No pudimos abrir la cuenta demo."
      );
    } finally {
      setBusyEmail(null);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      router.push(roleRedirect(user, nextPath));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No pudimos entrar a tu cuenta."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await register({
        nombre: regNombre,
        email: regEmail,
        password: regPassword,
        rol: regRol,
        telefono: regTelefono,
        direccion: regDireccion,
        barrio_sector: "Villas de San Pablo",
      });
      router.push(roleRedirect(user, nextPath));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear tu cuenta."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <BackButton href="/" label="Volver al inicio" />

      <div className="mt-5 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-huerta-100 px-3.5 py-1 text-xs font-extrabold text-huerta-800">
          <Sparkles className="h-4 w-4 text-sol-600" />
          <span>EcoConecta · Villas de San Pablo</span>
        </span>
        <h1 className="mt-3 text-2xl font-black text-stone-900 sm:text-3xl">
          Entra a tu cuenta o prueba la demostración en 1 toque
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-base text-stone-700">
          Los hogares y negocios entran a su portal ciudadano, y los
          coordinadores entran directamente a la página alterna{" "}
          <code className="font-extrabold text-stone-900">/coordinacion</code>.
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3.5 text-base font-bold text-rose-800">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        {/* Acceso rápido demo */}
        <div className="eco-card p-6 lg:col-span-7">
          <h2 className="text-xl font-black text-stone-900">
            Acceso rápido demo (datos 100 % ficticios)
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Toca cualquiera de las 5 cuentas para entrar de inmediato. Clave
            manual de prueba:{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 font-extrabold text-stone-900">
              EcoDemo2026!
            </code>
          </p>

          <div className="mt-4 grid gap-3">
            {demoAccounts.map((acc) => {
              const style = demoBadgeStyle(acc.rol);
              const Icon = style.Icon;
              const isLoading = busyEmail === acc.email;
              return (
                <button
                  key={acc.email}
                  type="button"
                  disabled={busyEmail !== null}
                  onClick={() => handleDemoClick(acc.email)}
                  className={`flex min-h-[76px] w-full items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition ${style.card} disabled:opacity-60`}
                >
                  <span
                    className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.pill}`}
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-base font-black text-stone-900">
                        {acc.etiqueta}
                      </span>
                      <span className="font-mono text-xs font-bold text-stone-700">
                        {acc.email}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-bold text-stone-800">
                      {acc.nombre}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">
                      {acc.descripcion}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Formulario manual Login / Registro */}
        <div className="eco-card p-6 lg:col-span-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1.5">
            <button
              type="button"
              onClick={() => setTab("login")}
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-sm font-extrabold transition ${
                tab === "login"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-700"
              }`}
            >
              <KeyRound className="h-4 w-4" />
              <span>Entrar</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("register")}
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-sm font-extrabold transition ${
                tab === "register"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-700"
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Crear cuenta</span>
            </button>
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-base font-extrabold text-stone-900">
                  Tu correo electrónico
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hogar@villas.demo"
                  className="eco-input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-base font-extrabold text-stone-900">
                  Tu contraseña
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="eco-input"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="eco-btn-primary w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-5 w-5" />
                    <span>Entrar a mi cuenta</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="mt-5 space-y-3.5">
              <div>
                <label className="mb-1.5 block text-sm font-extrabold text-stone-800">
                  ¿Te registras como hogar o negocio?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegRol("hogar")}
                    className={`min-h-[48px] rounded-xl border-2 px-3 py-2.5 text-sm font-extrabold ${
                      regRol === "hogar"
                        ? "border-huerta-600 bg-huerta-50 text-huerta-900"
                        : "border-stone-300 text-stone-700"
                    }`}
                  >
                    🏠 Hogar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRol("unidad_productiva")}
                    className={`min-h-[48px] rounded-xl border-2 px-3 py-2.5 text-sm font-extrabold ${
                      regRol === "unidad_productiva"
                        ? "border-huerta-600 bg-huerta-50 text-huerta-900"
                        : "border-stone-300 text-stone-700"
                    }`}
                  >
                    🏪 Negocio
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-extrabold text-stone-800">
                  Tu nombre o el del negocio
                </label>
                <input
                  type="text"
                  required
                  value={regNombre}
                  onChange={(e) => setRegNombre(e.target.value)}
                  placeholder="Ej: Familia Gómez / Tienda La Esquina"
                  className="eco-input py-2.5 text-base"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-extrabold text-stone-800">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="eco-input py-2.5 text-base"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-extrabold text-stone-800">
                  Número de WhatsApp o celular
                </label>
                <input
                  type="tel"
                  required
                  value={regTelefono}
                  onChange={(e) => setRegTelefono(e.target.value)}
                  placeholder="+57 300 000 0000"
                  className="eco-input py-2.5 text-base"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-extrabold text-stone-800">
                  Dirección en Villas de San Pablo
                </label>
                <input
                  type="text"
                  required
                  value={regDireccion}
                  onChange={(e) => setRegDireccion(e.target.value)}
                  placeholder="Manzana X, Casa Y, Villas de San Pablo"
                  className="eco-input py-2.5 text-base"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-extrabold text-stone-800">
                  Crea una contraseña (mínimo 6 letras o números)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="eco-input py-2.5 text-base"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="eco-btn-primary w-full"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-5 w-5" />
                    <span>Crear mi cuenta y entrar</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-huerta-600" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
