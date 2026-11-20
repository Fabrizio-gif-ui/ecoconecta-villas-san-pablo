"use client";

import {
  ClipboardList,
  Gift,
  HelpCircle,
  Home,
  LogIn,
  LogOut,
  Menu,
  Mic,
  Truck,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import EcoConectaLogo from "@/components/EcoConectaLogo";
import { useAuth } from "@/context/AuthContext";
import { formatPts } from "@/lib/types";

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const isCoordRoute = pathname?.startsWith("/coordinacion");

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    router.push("/");
  };

  const firstName = user?.nombre ? user.nombre.split(" ")[0] : "Cuenta";

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[#168A2E] bg-[#063B2E] text-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Logotipo oficial con área de seguridad */}
        <Link
          href="/"
          className="shrink-0 transition hover:opacity-95"
          onClick={() => setMenuOpen(false)}
        >
          <EcoConectaLogo variant="navbar" />
        </Link>

        {/* Navegación Desktop limpia estilo ecoins.eco (sin saltos de línea ni ruido visual) */}
        <nav className="hidden items-center gap-2 lg:flex">
          <Link
            href="/"
            className={`whitespace-nowrap rounded-full px-4 py-2 text-[15px] font-semibold transition ${
              pathname === "/"
                ? "bg-white/15 text-[#F6C400]"
                : "text-white/95 hover:bg-white/10"
            }`}
          >
            Inicio
          </Link>

          <Link
            href="/ayuda"
            className={`whitespace-nowrap rounded-full px-4 py-2 text-[15px] font-semibold transition ${
              pathname === "/ayuda"
                ? "bg-white/15 text-[#F6C400]"
                : "text-white/95 hover:bg-white/10"
            }`}
          >
            Cómo funciona
          </Link>

          <Link
            href="/whatsapp-demo"
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-[15px] font-semibold transition ${
              pathname === "/whatsapp-demo"
                ? "bg-[#0A9B70] text-white"
                : "text-white/95 hover:bg-white/10"
            }`}
          >
            <Mic className="h-4 w-4 text-[#F6C400]" />
            <span>WhatsApp Voz</span>
          </Link>

          <Link
            href="/coordinacion"
            className={`whitespace-nowrap rounded-full px-4 py-2 text-[15px] font-semibold transition ${
              isCoordRoute
                ? "bg-white/15 text-[#F6C400]"
                : "text-white/95 hover:bg-white/10"
            }`}
          >
            Coordinadores
          </Link>
        </nav>

        {/* Acciones de cuenta estilo ecoins.eco (2 botones claros, grandes y en 1 sola línea) */}
        <div className="hidden items-center gap-2.5 lg:flex">
          {user ? (
            <>
              <Link
                href="/mis-puntos"
                className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full bg-[#F6C400] px-4 py-2 text-sm font-bold text-[#063B2E] transition hover:bg-[#F28C00] hover:text-white"
              >
                <Gift className="h-4 w-4 shrink-0" />
                <span>{formatPts(user.puntos_acumulados)} pts</span>
              </Link>

              <Link
                href="/mi-cuenta"
                className={`inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-4 py-2 text-sm font-bold transition ${
                  pathname === "/mi-cuenta"
                    ? "border-white bg-white text-[#063B2E]"
                    : "border-white/50 bg-transparent text-white hover:border-white hover:bg-white/10"
                }`}
              >
                <User className="h-4 w-4 shrink-0" />
                <span>{firstName}</span>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                title="Salir de mi cuenta"
                className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Salir</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-white/70 px-5 py-2 text-sm font-bold text-white transition hover:border-white hover:bg-white/10"
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span>Iniciar Sesión</span>
              </Link>
              <Link
                href="/solicitar"
                className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full bg-[#168A2E] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#65A90A] hover:text-[#063B2E]"
              >
                <Truck className="h-4 w-4 shrink-0" />
                <span>Pedir Recolección</span>
              </Link>
            </>
          )}
        </div>

        {/* Botón Menú Móvil grande y claro (tercera edad / mobile-first) */}
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border-2 border-[#F6C400] bg-[#168A2E] px-4 text-base font-bold text-white lg:hidden"
        >
          {menuOpen ? (
            <>
              <X className="h-5 w-5 text-[#F6C400]" />
              <span>Cerrar</span>
            </>
          ) : (
            <>
              <Menu className="h-5 w-5 text-[#F6C400]" />
              <span>Menú</span>
            </>
          )}
        </button>
      </div>

      {/* Menú Desplegable Móvil (botones grandes, claros, 1 acción por fila) */}
      {menuOpen && (
        <div className="border-t border-white/15 bg-[#063B2E] px-4 pb-6 pt-4 text-white lg:hidden">
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-lg font-semibold hover:bg-[#168A2E]"
            >
              <Home className="h-5 w-5 text-[#F6C400]" />
              <span>Inicio</span>
            </Link>

            <Link
              href="/solicitar"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-[#168A2E] px-5 py-3 text-lg font-bold text-white"
            >
              <Truck className="h-5 w-5" />
              <span>Pedir Recolección</span>
            </Link>

            <Link
              href="/whatsapp-demo"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-full border-2 border-[#F6C400] bg-[#0A9B70] px-5 py-3 text-lg font-bold text-white"
            >
              <Mic className="h-5 w-5 text-[#F6C400]" />
              <span>🎙️ Pedir por Nota de Voz</span>
            </Link>

            <Link
              href="/ayuda"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-lg font-semibold hover:bg-[#168A2E]"
            >
              <HelpCircle className="h-5 w-5 text-[#F6C400]" />
              <span>Cómo funciona y Reglas</span>
            </Link>

            {user && (
              <>
                <Link
                  href="/mis-puntos"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-[52px] items-center justify-between rounded-2xl bg-[#F6C400] px-4 py-3 text-lg font-bold text-[#063B2E]"
                >
                  <span className="flex items-center gap-2.5">
                    <Gift className="h-5 w-5" />
                    <span>Mis Puntos y Beneficios</span>
                  </span>
                  <span>{formatPts(user.puntos_acumulados)} pts</span>
                </Link>

                <Link
                  href="/mi-cuenta"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-white px-4 py-3 text-lg font-bold text-[#063B2E]"
                >
                  <User className="h-5 w-5 text-[#168A2E]" />
                  <span>Mi Cuenta ({user.nombre})</span>
                </Link>
              </>
            )}

            <Link
              href="/coordinacion"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-white/25 bg-white/5 px-4 py-3 text-lg font-semibold text-white"
            >
              <ClipboardList className="h-5 w-5 text-[#F6C400]" />
              <span>Consola de Coordinadores</span>
            </Link>

            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-full border-2 border-white/40 px-4 py-3 text-base font-bold text-white"
              >
                <LogOut className="h-5 w-5" />
                <span>Salir de mi cuenta</span>
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-[#F6C400] px-5 py-3 text-lg font-bold text-[#063B2E]"
              >
                <LogIn className="h-5 w-5" />
                <span>Iniciar Sesión / Crear Cuenta</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
