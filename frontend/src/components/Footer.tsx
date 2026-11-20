import {
  HeartHandshake,
  HelpCircle,
  Mic,
  Shield,
  Truck,
} from "lucide-react";
import Link from "next/link";

import EcoConectaLogo from "@/components/EcoConectaLogo";

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-[#D8E2DC] bg-white">
      {/* Barra de proporción visual orientativa del Manual de Identidad Visual (Página 3) */}
      <div className="flex h-2 w-full" aria-hidden="true">
        <div className="w-[40%] bg-[#063B2E]" />
        <div className="w-[30%] bg-[#168A2E]" />
        <div className="w-[18%] bg-[#F6C400]" />
        <div className="w-[12%] bg-[#F28C00]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <EcoConectaLogo variant="card" />
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#063B2E]">
              Barranquilla, Colombia · Fundación Santo Domingo y Universidad
              Libre
            </p>
            <p className="mt-2 text-base leading-relaxed text-[#202522]">
              Plataforma comunitaria de economía circular que conecta hogares y
              unidades productivas con los colectivos de{" "}
              <strong className="text-[#168A2E]">huerteros</strong> y{" "}
              <strong className="text-[#0A9B70]">recicladores de oficio</strong>{" "}
              en Villas de San Pablo.
            </p>
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#063B2E]">
              <Shield className="h-4 w-4 text-[#168A2E]" />
              <span>Seguridad, Privacidad e Intermediación</span>
            </h3>
            <p className="mt-2 text-base leading-relaxed text-[#202522]">
              Siempre hablas únicamente con el coordinador del colectivo
              correspondiente (orgánicos o reciclables). Tu teléfono y tu
              dirección están protegidos y nunca se muestran en público.
            </p>
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#063B2E]">
              <HeartHandshake className="h-4 w-4 text-[#F28C00]" />
              <span>Acciones y canales de ayuda</span>
            </h3>
            <ul className="mt-3 space-y-2.5 text-base font-semibold text-[#202522]">
              <li>
                <Link
                  href="/solicitar"
                  className="inline-flex items-center gap-2 hover:text-[#168A2E]"
                >
                  <Truck className="h-4 w-4 text-[#168A2E]" />
                  <span>Solicitar recolección web</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/whatsapp-demo"
                  className="inline-flex items-center gap-2 hover:text-[#0A9B70]"
                >
                  <Mic className="h-4 w-4 text-[#0A9B70]" />
                  <span>🎙️ Solicitar por Audio WhatsApp (/whatsapp-demo)</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/ayuda"
                  className="inline-flex items-center gap-2 hover:text-[#168A2E]"
                >
                  <HelpCircle className="h-4 w-4 text-[#F28C00]" />
                  <span>Cómo separar, reglas y dudas (/ayuda)</span>
                </Link>
              </li>
              <li>
                <Link href="/mis-puntos" className="hover:text-[#168A2E]">
                  Mis Puntos y Beneficios
                </Link>
              </li>
              <li>
                <Link
                  href="/coordinacion"
                  className="font-bold text-[#0A9B70] hover:underline"
                >
                  Página alterna de coordinadores (/coordinacion)
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border-2 border-[#F6C400] bg-[#FEF6C7] px-4 py-3.5 text-sm font-semibold text-[#063B2E]">
          <strong>Nota institucional (RN-06):</strong> Cálculo de puntos y
          beneficios referenciales y parametrizables; valores sujetos a
          validación oficial de la Fundación Santo Domingo.
        </div>

        <p className="mt-6 text-center text-xs font-medium text-stone-600">
          MVP EcoConecta · Villas de San Pablo (Manual de Identidad Visual ·
          Alianza Fundación Santo Domingo y Universidad Libre).
        </p>
      </div>
    </footer>
  );
}
