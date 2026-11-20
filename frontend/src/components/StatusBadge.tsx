import {
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  Leaf,
  Recycle,
  UserCheck,
  XCircle,
} from "lucide-react";
import { ComponentType } from "react";

import type { EstadoSolicitud } from "@/lib/types";

const ESTADO_CONFIG: Record<
  EstadoSolicitud,
  {
    label: string;
    className: string;
    Icon: ComponentType<{ className?: string }>;
  }
> = {
  recibida: {
    label: "Recibida (Pendiente)",
    className: "border-[#F6C400] bg-[#FEF6C7] text-[#063B2E]",
    Icon: Clock,
  },
  en_revision: {
    label: "En revisión",
    className: "border-[#F28C00] bg-[#FFF4E5] text-[#202522]",
    Icon: Eye,
  },
  asignada: {
    label: "En recolección (Asignada)",
    className: "border-[#0A9B70] bg-[#EAF8F3] text-[#063B2E]",
    Icon: UserCheck,
  },
  programada: {
    label: "Programada",
    className: "border-[#0A9B70] bg-[#0A9B70] text-white",
    Icon: CalendarClock,
  },
  recolectada: {
    label: "Completada (Recolectada)",
    className: "border-[#168A2E] bg-[#168A2E] text-white",
    Icon: CheckCircle2,
  },
  cancelada: {
    label: "Cancelada",
    className: "border-rose-300 bg-rose-50 text-rose-900",
    Icon: XCircle,
  },
};

export function EstadoBadge({ estado }: { estado: EstadoSolicitud }) {
  const cfg = ESTADO_CONFIG[estado] ?? {
    label: estado,
    className: "border-stone-300 bg-stone-100 text-[#202522]",
    Icon: Clock,
  };
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{cfg.label}</span>
    </span>
  );
}

export function FlujoBadge({
  flujo,
}: {
  flujo: "organico" | "reciclable" | "no_aprovechable";
}) {
  if (flujo === "organico") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#65A90A] bg-[#E1EFE4] px-3 py-1 text-xs font-bold text-[#063B2E]">
        <Leaf className="h-3.5 w-3.5 shrink-0 text-[#168A2E]" />
        <span>Orgánico · Huerta</span>
      </span>
    );
  }
  if (flujo === "reciclable") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0A9B70] bg-[#CEF0E5] px-3 py-1 text-xs font-bold text-[#063B2E]">
        <Recycle className="h-3.5 w-3.5 shrink-0 text-[#0A9B70]" />
        <span>Reciclable · Recicladores</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-stone-200 px-3 py-1 text-xs font-bold text-[#202522]">
      <Ban className="h-3.5 w-3.5 shrink-0" />
      <span>No aprovechable</span>
    </span>
  );
}
