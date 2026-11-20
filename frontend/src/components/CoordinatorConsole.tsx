"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  Award,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Gift,
  Inbox,
  Leaf,
  Loader2,
  MapPin,
  MessageCircle,
  Mic,
  Phone,
  Plus,
  Recycle,
  RefreshCw,
  Scale,
  Search,
  Send,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import {
  ComponentType,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import SpeakButton from "@/components/SpeakButton";
import { EstadoBadge, FlujoBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, downloadCsv } from "@/lib/api";
import {
  formatPts,
  type Beneficio,
  type EstadoSolicitud,
  type FlujoResiduo,
  type IntegranteColectivo,
  type NotificacionWhatsApp,
  type PanelRecolectoresPuntos,
  type RegistroRecoleccion,
  type ReglaPuntos,
  type ResumenOperativo,
  type SolicitudCoordinador,
  type TipoDestinatario,
  type UnidadMedida,
  type Usuario,
} from "@/lib/types";

type TabId =
  | "bandeja"
  | "puntos_equipo"
  | "historial"
  | "whatsapp"
  | "colectivo"
  | "admin";

const STATUS_FILTERS: { id: "todas" | EstadoSolicitud; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "recibida", label: "Recibidas" },
  { id: "en_revision", label: "En revisión" },
  { id: "asignada", label: "Asignadas" },
  { id: "programada", label: "Programadas" },
  { id: "recolectada", label: "Recolectadas" },
  { id: "cancelada", label: "Canceladas" },
];

const RN06_DISCLAIMER =
  "Cálculo de puntos y beneficios referenciales y parametrizables; valores sujetos a validación oficial de la Fundación Santo Domingo.";

function localDateInputDefault(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localDateTimeInputDefault(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export default function CoordinatorConsole() {
  const { user, isAdmin, coordinatorFlow } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>("bandeja");
  const [adminFlowFilter, setAdminFlowFilter] = useState<
    "todos" | FlujoResiduo
  >("todos");
  const [estadoFilter, setEstadoFilter] = useState<"todas" | EstadoSolicitud>(
    "todas"
  );
  const [searchText, setSearchText] = useState("");

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [solicitudes, setSolicitudes] = useState<SolicitudCoordinador[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [colectivo, setColectivo] = useState<IntegranteColectivo[]>([]);
  const [recolecciones, setRecolecciones] = useState<RegistroRecoleccion[]>([]);
  const [resumen, setResumen] = useState<ResumenOperativo | null>(null);
  const [whatsappLogs, setWhatsappLogs] = useState<NotificacionWhatsApp[]>([]);
  const [reglas, setReglas] = useState<ReglaPuntos[]>([]);
  const [panelRecolectores, setPanelRecolectores] =
    useState<PanelRecolectoresPuntos | null>(null);
  const [adminUsers, setAdminUsers] = useState<Usuario[]>([]);
  const [adminBeneficios, setAdminBeneficios] = useState<Beneficio[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [banner, setBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Schedule form state (RN-02)
  const [schedDate, setSchedDate] = useState(localDateInputDefault());
  const [schedTime, setSchedTime] = useState("09:00");
  const [schedEncargadoId, setSchedEncargadoId] = useState<string>("");
  const [schedEncargadoName, setSchedEncargadoName] = useState("");
  const [schedNote, setSchedNote] = useState("");

  // Mandatory Closure Form state (RN-05) with kg or lb selector
  const [closeSolicitante, setCloseSolicitante] = useState("");
  const [closePesoIngresado, setClosePesoIngresado] = useState("");
  const [closeUnidadMedida, setCloseUnidadMedida] =
    useState<UnidadMedida>("kg");
  const [closeEncargadoId, setCloseEncargadoId] = useState<string>("");
  const [closeEncargadoName, setCloseEncargadoName] = useState("");
  const [closeFechaHora, setCloseFechaHora] = useState(
    localDateTimeInputDefault()
  );
  const [closeObs, setCloseObs] = useState("");

  // Chat state
  const [chatText, setChatText] = useState("");
  const [chatAlsoWhatsapp, setChatAlsoWhatsapp] = useState(true);

  // Human reclassification state (control humano frente a errores de IA)
  const [reclasComment, setReclasComment] = useState("");

  // Collector redemption state
  const [redeemBenefitByCol, setRedeemBenefitByCol] = useState<
    Record<number, string>
  >({});
  const [redeemNoteByCol, setRedeemNoteByCol] = useState<
    Record<number, string>
  >({});

  // Add collective member form
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [newMemberZone, setNewMemberZone] = useState("Villas de San Pablo");
  const [newMemberFlow, setNewMemberFlow] = useState<FlujoResiduo>("organico");

  // Admin rules drafts (kg & lb)
  const [ruleDrafts, setRuleDrafts] = useState<
    Record<
      string,
      {
        puntos_por_kg: string;
        puntos_por_libra: string;
        descripcion: string;
      }
    >
  >({});

  // Admin benefit edit drafts
  const [benefitDrafts, setBenefitDrafts] = useState<
    Record<
      number,
      {
        nombre: string;
        descripcion: string;
        puntos_requeridos: string;
        activo: boolean;
      }
    >
  >({});

  // Admin create benefit form
  const [newBenTipo, setNewBenTipo] = useState<TipoDestinatario>("usuario");
  const [newBenNombre, setNewBenNombre] = useState("");
  const [newBenDesc, setNewBenDesc] = useState("");
  const [newBenPuntos, setNewBenPuntos] = useState("15");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (isAdmin && adminFlowFilter !== "todos") {
        qs.set("flujo", adminFlowFilter);
      }
      const periodQs = new URLSearchParams(qs);
      if (desde) periodQs.set("desde", desde);
      if (hasta) periodQs.set("hasta", hasta);

      const flowSuffix = qs.toString() ? `?${qs.toString()}` : "";
      const periodSuffix = periodQs.toString() ? `?${periodQs.toString()}` : "";

      const [sols, col, recs, res, wa, pubReglas, recPanel] = await Promise.all(
        [
          apiFetch<SolicitudCoordinador[]>(
            `/coordinacion/solicitudes${flowSuffix}`
          ),
          apiFetch<IntegranteColectivo[]>(
            `/coordinacion/colectivo${flowSuffix}`
          ),
          apiFetch<RegistroRecoleccion[]>(
            `/coordinacion/recolecciones${periodSuffix}`
          ),
          apiFetch<ResumenOperativo>(`/coordinacion/resumen${periodSuffix}`),
          apiFetch<NotificacionWhatsApp[]>(
            `/coordinacion/notificaciones-whatsapp${flowSuffix}`
          ),
          apiFetch<ReglaPuntos[]>("/public/reglas-puntos", { auth: false }),
          apiFetch<PanelRecolectoresPuntos>(
            `/coordinacion/recolectores/puntos${flowSuffix}`
          ),
        ]
      );

      setSolicitudes(sols);
      setColectivo(col);
      setRecolecciones(recs);
      setResumen(res);
      setWhatsappLogs(wa);
      setReglas(pubReglas);
      setPanelRecolectores(recPanel);

      const drafts: Record<
        string,
        {
          puntos_por_kg: string;
          puntos_por_libra: string;
          descripcion: string;
        }
      > = {};
      for (const r of pubReglas) {
        drafts[r.flujo] = {
          puntos_por_kg: String(r.puntos_por_kg),
          puntos_por_libra: String(r.puntos_por_libra),
          descripcion: r.descripcion || "",
        };
      }
      setRuleDrafts(drafts);

      if (isAdmin) {
        const [usersList, bensList] = await Promise.all([
          apiFetch<Usuario[]>("/admin/usuarios"),
          apiFetch<Beneficio[]>("/admin/beneficios"),
        ]);
        setAdminUsers(usersList);
        setAdminBeneficios(bensList);

        const bDrafts: Record<
          number,
          {
            nombre: string;
            descripcion: string;
            puntos_requeridos: string;
            activo: boolean;
          }
        > = {};
        for (const b of bensList) {
          bDrafts[b.id] = {
            nombre: b.nombre,
            descripcion: b.descripcion,
            puntos_requeridos: String(b.puntos_requeridos),
            activo: b.activo,
          };
        }
        setBenefitDrafts(bDrafts);
      }

      setSelectedId((prev) => {
        if (prev && sols.some((s) => s.id === prev)) return prev;
        return sols[0]?.id ?? null;
      });
    } catch (err) {
      setBanner({
        type: "err",
        text:
          err instanceof Error
            ? err.message
            : "Error cargando datos de coordinación.",
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, adminFlowFilter, desde, hasta]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredSolicitudes = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return solicitudes.filter((s) => {
      if (estadoFilter !== "todas" && s.estado !== estadoFilter) return false;
      if (!q) return true;
      return (
        s.codigo.toLowerCase().includes(q) ||
        s.nombre_solicitante.toLowerCase().includes(q) ||
        s.direccion.toLowerCase().includes(q)
      );
    });
  }, [solicitudes, estadoFilter, searchText]);

  const selected = useMemo(
    () =>
      solicitudes.find((s) => s.id === selectedId) ??
      filteredSolicitudes[0] ??
      null,
    [solicitudes, selectedId, filteredSolicitudes]
  );

  useEffect(() => {
    if (!selected) return;
    setSchedDate(selected.fecha_programada || localDateInputDefault());
    setSchedTime(selected.hora_programada || "09:00");
    setSchedEncargadoId(
      selected.encargado_id ? String(selected.encargado_id) : ""
    );
    setSchedEncargadoName(selected.nombre_encargado || "");
    setSchedNote("");

    setCloseSolicitante(selected.nombre_solicitante);
    setClosePesoIngresado("");
    setCloseUnidadMedida("kg");
    setCloseEncargadoId(
      selected.encargado_id ? String(selected.encargado_id) : ""
    );
    setCloseEncargadoName(selected.nombre_encargado || "");
    setCloseFechaHora(localDateTimeInputDefault());
    setCloseObs("");
  }, [selected]);

  const membersForSelected = useMemo(() => {
    if (!selected) return colectivo;
    return colectivo.filter((m) => m.flujo === selected.flujo);
  }, [colectivo, selected]);

  const closurePreview = useMemo(() => {
    if (!selected) return null;
    const raw = parseFloat(closePesoIngresado);
    if (Number.isNaN(raw) || raw <= 0) return null;
    const rule = reglas.find((r) => r.flujo === selected.flujo);
    const base = rule ? rule.puntos_base : 0;
    const perKg = rule ? rule.puntos_por_kg : 1.0;
    const perLb = rule ? rule.puntos_por_libra : 0.5;
    const equivKg =
      closeUnidadMedida === "lb"
        ? Math.round(raw * 0.5 * 100) / 100
        : Math.round(raw * 100) / 100;
    const factor = closeUnidadMedida === "lb" ? perLb : perKg;
    const pts = Math.round((base + raw * factor) * 100) / 100;
    return { equivKg, pts, factor };
  }, [selected, closePesoIngresado, closeUnidadMedida, reglas]);

  const notifyOk = (text: string) => setBanner({ type: "ok", text });
  const notifyErr = (err: unknown, fallback: string) =>
    setBanner({
      type: "err",
      text: err instanceof Error ? err.message : fallback,
    });

  const handleQuickStatus = async (
    solicitudId: number,
    estadoNuevo: "en_revision" | "cancelada"
  ) => {
    setActionBusy(true);
    setBanner(null);
    try {
      await apiFetch(`/coordinacion/solicitudes/${solicitudId}/estado`, {
        method: "PATCH",
        body: JSON.stringify({
          estado_nuevo: estadoNuevo,
          comentario:
            estadoNuevo === "en_revision"
              ? "Solicitud tomada en revisión por el coordinador."
              : "Solicitud cancelada desde /coordinacion.",
        }),
      });
      notifyOk(`Estado actualizado a "${estadoNuevo}".`);
      await loadAll();
    } catch (err) {
      notifyErr(err, "No se pudo actualizar el estado.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleReclassifyFlow = async (
    solicitudId: number,
    codigo: string,
    nuevoFlujo: FlujoResiduo
  ) => {
    setActionBusy(true);
    setBanner(null);
    try {
      await apiFetch(`/coordinacion/solicitudes/${solicitudId}/reclasificar`, {
        method: "POST",
        body: JSON.stringify({
          nuevo_flujo: nuevoFlujo,
          comentario:
            reclasComment.trim() ||
            `Flujo reclasificado manualmente por el coordinador a '${nuevoFlujo}'.`,
        }),
      });
      setReclasComment("");
      const destinoLabel =
        nuevoFlujo === "organico"
          ? "Coordinación de Huerteros (Orgánicos)"
          : "Coordinación de Recicladores (Reciclables)";
      notifyOk(
        `Control humano aplicado: el pedido ${codigo} fue movido a ${destinoLabel} y quedó trazado en historial_estados.`
      );
      await loadAll();
    } catch (err) {
      notifyErr(err, "No se pudo reclasificar el flujo de la solicitud.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setActionBusy(true);
    setBanner(null);
    try {
      await apiFetch(`/coordinacion/solicitudes/${selected.id}/programar`, {
        method: "POST",
        body: JSON.stringify({
          fecha_programada: schedDate,
          hora_programada: schedTime,
          encargado_id: schedEncargadoId ? Number(schedEncargadoId) : null,
          nombre_encargado: schedEncargadoName,
          comentario: schedNote || null,
        }),
      });
      notifyOk(
        `Solicitud ${selected.codigo} programada para ${schedDate} ${schedTime}. Notificación WhatsApp registrada.`
      );
      await loadAll();
    } catch (err) {
      notifyErr(err, "No se pudo programar la recolección.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCloseCollection = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const pesoNum = parseFloat(closePesoIngresado);
    if (Number.isNaN(pesoNum) || pesoNum <= 0) {
      setBanner({
        type: "err",
        text: "El peso ingresado es obligatorio y debe ser mayor a 0.",
      });
      return;
    }
    setActionBusy(true);
    setBanner(null);
    try {
      const updated = await apiFetch<SolicitudCoordinador>(
        `/coordinacion/solicitudes/${selected.id}/cerrar`,
        {
          method: "POST",
          body: JSON.stringify({
            nombre_solicitante_verificado: closeSolicitante,
            peso_ingresado: pesoNum,
            unidad_medida: closeUnidadMedida,
            encargado_id: closeEncargadoId ? Number(closeEncargadoId) : null,
            nombre_encargado: closeEncargadoName,
            fecha_hora_recoleccion: closeFechaHora
              ? new Date(closeFechaHora).toISOString()
              : null,
            observaciones: closeObs || null,
          }),
        }
      );
      const reg = updated.registro_recoleccion;
      notifyOk(
        `¡Recolección ${selected.codigo} cerrada en PostgreSQL! Registrado: ${
          reg?.peso_ingresado.toFixed(2) ?? pesoNum
        } ${reg?.unidad_medida ?? closeUnidadMedida} (${
          reg?.peso_kg.toFixed(2) ?? ""
        } kg). Acreditación dual: +${formatPts(
          reg?.puntos_calculados
        )} pts al solicitante y +${formatPts(
          reg?.puntos_calculados
        )} pts a ${reg?.nombre_encargado}.`
      );
      await loadAll();
    } catch (err) {
      notifyErr(err, "No se pudo registrar el cierre de recolección.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !chatText.trim()) return;
    setActionBusy(true);
    setBanner(null);
    try {
      await apiFetch(`/coordinacion/solicitudes/${selected.id}/mensajes`, {
        method: "POST",
        body: JSON.stringify({
          contenido: chatText.trim(),
          enviar_whatsapp: chatAlsoWhatsapp,
        }),
      });
      setChatText("");
      notifyOk(
        chatAlsoWhatsapp
          ? "Mensaje enviado al solicitante en plataforma y vía WhatsApp."
          : "Mensaje enviado al solicitante en plataforma."
      );
      await loadAll();
    } catch (err) {
      notifyErr(err, "No se pudo enviar el mensaje.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCollectorRedeem = async (
    integranteId: number,
    integranteNombre: string
  ) => {
    const benIdStr = redeemBenefitByCol[integranteId];
    if (!benIdStr) {
      setBanner({
        type: "err",
        text: "Selecciona un beneficio disponible antes de registrar el canje.",
      });
      return;
    }
    setActionBusy(true);
    setBanner(null);
    try {
      await apiFetch(`/coordinacion/recolectores/${integranteId}/canjes`, {
        method: "POST",
        body: JSON.stringify({
          beneficio_id: Number(benIdStr),
          observaciones: redeemNoteByCol[integranteId]?.trim() || null,
        }),
      });
      setRedeemBenefitByCol((prev) => ({ ...prev, [integranteId]: "" }));
      setRedeemNoteByCol((prev) => ({ ...prev, [integranteId]: "" }));
      notifyOk(
        `¡Canje de beneficio registrado exitosamente para ${integranteNombre}!`
      );
      await loadAll();
    } catch (err) {
      notifyErr(err, "No se pudo registrar el canje del recolector.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setActionBusy(true);
    setBanner(null);
    try {
      await apiFetch("/coordinacion/colectivo", {
        method: "POST",
        body: JSON.stringify({
          nombre: newMemberName.trim(),
          rol_interno:
            newMemberRole.trim() ||
            ((coordinatorFlow || newMemberFlow) === "organico"
              ? "Huertero comunitario"
              : "Reciclador de oficio"),
          zona_cobertura: newMemberZone.trim() || "Villas de San Pablo",
          flujo: isAdmin ? newMemberFlow : undefined,
        }),
      });
      setNewMemberName("");
      setNewMemberRole("");
      notifyOk("Integrante agregado al colectivo interno.");
      await loadAll();
    } catch (err) {
      notifyErr(err, "No se pudo agregar al integrante.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveRule = async (flujo: FlujoResiduo) => {
    const draft = ruleDrafts[flujo];
    if (!draft) return;
    setActionBusy(true);
    setBanner(null);
    try {
      await apiFetch(`/admin/reglas-puntos/${flujo}`, {
        method: "PUT",
        body: JSON.stringify({
          puntos_base: 0,
          puntos_por_kg: Number(draft.puntos_por_kg),
          puntos_por_libra: Number(draft.puntos_por_libra),
          descripcion: draft.descripcion,
          activo: true,
        }),
      });
      notifyOk(
        `Regla de puntos para '${flujo}' actualizada (${draft.puntos_por_kg} pts/kg · ${draft.puntos_por_libra} pts/lb).`
      );
      await loadAll();
    } catch (err) {
      notifyErr(err, "No se pudo actualizar la regla de puntos.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveBenefit = async (beneficioId: number) => {
    const draft = benefitDrafts[beneficioId];
    if (!draft) return;
    setActionBusy(true);
    setBanner(null);
    try {
      await apiFetch(`/admin/beneficios/${beneficioId}`, {
        method: "PUT",
        body: JSON.stringify({
          nombre: draft.nombre,
          descripcion: draft.descripcion,
          puntos_requeridos: Number(draft.puntos_requeridos),
          activo: draft.activo,
        }),
      });
      notifyOk(`Beneficio "${draft.nombre}" actualizado en el catálogo.`);
      await loadAll();
    } catch (err) {
      notifyErr(err, "No se pudo actualizar el beneficio.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateBenefit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBenNombre.trim() || !newBenDesc.trim()) return;
    setActionBusy(true);
    setBanner(null);
    try {
      await apiFetch("/admin/beneficios", {
        method: "POST",
        body: JSON.stringify({
          tipo_destinatario: newBenTipo,
          nombre: newBenNombre.trim(),
          descripcion: newBenDesc.trim(),
          puntos_requeridos: Number(newBenPuntos),
          activo: true,
        }),
      });
      setNewBenNombre("");
      setNewBenDesc("");
      setNewBenPuntos("15");
      notifyOk("Nuevo beneficio creado en el catálogo.");
      await loadAll();
    } catch (err) {
      notifyErr(err, "No se pudo crear el beneficio.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleUserFlag = async (
    targetUser: Usuario,
    field: "es_piloto" | "habilitado_solicitudes"
  ) => {
    setActionBusy(true);
    setBanner(null);
    try {
      await apiFetch(`/admin/usuarios/${targetUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: !targetUser[field] }),
      });
      notifyOk(`Permiso '${field}' actualizado para ${targetUser.nombre}.`);
      await loadAll();
    } catch (err) {
      notifyErr(err, "No se pudo actualizar el usuario.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const qs = new URLSearchParams();
      if (isAdmin && adminFlowFilter !== "todos") {
        qs.set("flujo", adminFlowFilter);
      }
      if (desde) qs.set("desde", desde);
      if (hasta) qs.set("hasta", hasta);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      await downloadCsv(
        `/coordinacion/recolecciones/exportar.csv${suffix}`,
        `ecoconecta_recolecciones_${coordinatorFlow || adminFlowFilter}.csv`
      );
    } catch (err) {
      notifyErr(err, "No se pudo descargar el CSV.");
    }
  };

  const headerTheme =
    coordinatorFlow === "organico"
      ? "from-huerta-800 to-huerta-600"
      : coordinatorFlow === "reciclable"
        ? "from-reciclaje-700 to-reciclaje-500"
        : "from-stone-900 to-stone-700";

  const tabs: {
    id: TabId;
    label: string;
    Icon: ComponentType<{ className?: string }>;
  }[] = [
    {
      id: "bandeja",
      label: `Bandeja (${solicitudes.length})`,
      Icon: Inbox,
    },
    {
      id: "puntos_equipo",
      label: `Puntos del Equipo (${panelRecolectores?.recolectores.length ?? 0})`,
      Icon: Award,
    },
    {
      id: "historial",
      label: `Historial y Reportes (${recolecciones.length})`,
      Icon: BarChart3,
    },
    {
      id: "whatsapp",
      label: `WhatsApp (${whatsappLogs.length})`,
      Icon: MessageCircle,
    },
    {
      id: "colectivo",
      label: `Mi Colectivo (${colectivo.length})`,
      Icon: Users,
    },
    ...(isAdmin
      ? [
          {
            id: "admin" as TabId,
            label: "Administración (RN-06 / RN-08)",
            Icon: Settings,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Operational Header Banner */}
      <div
        className={`rounded-3xl bg-gradient-to-r p-6 text-white shadow-md ${headerTheme}`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4 text-sol-400" />
              <span>Página Alterna Exclusiva · /coordinacion</span>
              {coordinatorFlow && (
                <span>
                  · RN-01 Flujo único:{" "}
                  {coordinatorFlow === "organico" ? "ORGÁNICO" : "RECICLABLE"}
                </span>
              )}
            </div>
            <h1 className="mt-2.5 text-2xl font-black sm:text-3xl">
              {coordinatorFlow === "organico"
                ? "Coordinación de Huerteros (Orgánicos)"
                : coordinatorFlow === "reciclable"
                  ? "Coordinación de Recicladores (Reciclables)"
                  : "Supervisión General y Administración"}
            </h1>
            <p className="mt-1 text-sm text-white/90">
              Operador activo: <strong>{user?.nombre}</strong> · Comunicación
              intermediada y acreditación dual de puntos (solicitante +
              recolector).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <select
                value={adminFlowFilter}
                onChange={(e) =>
                  setAdminFlowFilter(e.target.value as "todos" | FlujoResiduo)
                }
                className="min-h-[44px] rounded-xl border border-white/25 bg-white/15 px-3 text-sm font-extrabold text-white focus:outline-none"
              >
                <option value="todos" className="text-stone-900">
                  Flujo: Todos
                </option>
                <option value="organico" className="text-stone-900">
                  Solo Orgánico
                </option>
                <option value="reciclable" className="text-stone-900">
                  Solo Reciclable
                </option>
              </select>
            )}
            <Link
              href="/whatsapp-demo"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-400"
            >
              <Mic className="h-4 w-4" />
              <span>🎙️ Simulador Audio WhatsApp</span>
            </Link>
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white/20 px-4 text-sm font-extrabold text-white transition hover:bg-white/30"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Mini KPI Strip */}
        {resumen && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-black/20 p-3.5">
              <p className="text-xs font-semibold text-white/75">
                Solicitudes en bandeja
              </p>
              <p className="mt-0.5 text-2xl font-black">
                {resumen.total_solicitudes}
              </p>
            </div>
            <div className="rounded-2xl bg-black/20 p-3.5">
              <p className="text-xs font-semibold text-white/75">
                Pendientes / Programadas
              </p>
              <p className="mt-0.5 text-2xl font-black">
                {(resumen.por_estado.recibida || 0) +
                  (resumen.por_estado.en_revision || 0) +
                  (resumen.por_estado.asignada || 0) +
                  (resumen.por_estado.programada || 0)}
              </p>
            </div>
            <div className="rounded-2xl bg-black/20 p-3.5">
              <p className="text-xs font-semibold text-white/75">
                Kg recolectados (equiv.)
              </p>
              <p className="mt-0.5 text-2xl font-black">
                {resumen.total_kg_recolectados} kg
              </p>
            </div>
            <div className="rounded-2xl bg-black/20 p-3.5">
              <p className="text-xs font-semibold text-white/75">
                WhatsApp Cloud API
              </p>
              <p className="mt-0.5 text-sm font-extrabold uppercase text-sol-300">
                Modo {resumen.modo_whatsapp_activo}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`mt-4 flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-sm font-bold ${
            banner.type === "ok"
              ? "border-huerta-300 bg-huerta-50 text-huerta-900"
              : "border-rose-300 bg-rose-50 text-rose-800"
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        {tabs.map((t) => {
          const Icon = t.Icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex min-h-[48px] items-center gap-2 rounded-xl px-4 text-sm font-extrabold transition ${
                active
                  ? "bg-stone-900 text-white shadow-sm"
                  : "border-2 border-stone-200 bg-white text-stone-800 hover:bg-stone-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: BANDEJA OPERATIVA + PROGRAMACIÓN + FORMULARIO DE CIERRE (KG / LB) */}
      {activeTab === "bandeja" && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((sf) => (
                <button
                  key={sf.id}
                  type="button"
                  onClick={() => setEstadoFilter(sf.id)}
                  className={`min-h-[40px] rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                    estadoFilter === sf.id
                      ? "bg-stone-900 text-white"
                      : "border border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                  }`}
                >
                  {sf.label}
                </button>
              ))}
            </div>
            <div className="relative md:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar por código, nombre o dirección..."
                className="eco-input py-2 pl-9 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left list */}
            <div className="space-y-2.5 lg:col-span-5">
              {filteredSolicitudes.length === 0 ? (
                <div className="eco-card p-8 text-center text-sm text-stone-600">
                  No hay solicitudes en este filtro.
                </div>
              ) : (
                filteredSolicitudes.map((sol) => {
                  const isSel = selected?.id === sol.id;
                  return (
                    <button
                      key={sol.id}
                      type="button"
                      onClick={() => setSelectedId(sol.id)}
                      className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                        isSel
                          ? sol.flujo === "organico"
                            ? "border-huerta-600 bg-huerta-50/70 shadow-sm"
                            : "border-reciclaje-600 bg-reciclaje-50/70 shadow-sm"
                          : "border-stone-200 bg-white hover:border-stone-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-black text-stone-900">
                          {sol.codigo}
                        </span>
                        <EstadoBadge estado={sol.estado} />
                      </div>
                      {(sol.canal_origen === "whatsapp_audio" ||
                        sol.canal_origen === "whatsapp_texto" ||
                        sol.requiere_revision_humana) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {sol.canal_origen === "whatsapp_audio" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-900">
                              <Mic className="h-3 w-3 text-emerald-700" />
                              <span>🎙️ Pedido por Audio WhatsApp</span>
                            </span>
                          )}
                          {sol.canal_origen === "whatsapp_texto" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-teal-300 bg-teal-50 px-2.5 py-0.5 text-[11px] font-extrabold text-teal-900">
                              <MessageCircle className="h-3 w-3 text-teal-700" />
                              <span>💬 Pedido por WhatsApp</span>
                            </span>
                          )}
                          {sol.requiere_revision_humana && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-900">
                              <AlertTriangle className="h-3 w-3" />
                              <span>Revisar flujo</span>
                            </span>
                          )}
                        </div>
                      )}
                      <p className="mt-1.5 text-base font-black text-stone-900">
                        {sol.nombre_solicitante}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-stone-600">
                        {sol.direccion}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                        <FlujoBadge flujo={sol.flujo} />
                        {sol.registro_recoleccion ? (
                          <span className="text-xs font-extrabold text-huerta-800">
                            {sol.registro_recoleccion.peso_ingresado}{" "}
                            {sol.registro_recoleccion.unidad_medida} · +
                            {formatPts(
                              sol.registro_recoleccion.puntos_calculados
                            )}{" "}
                            pts
                          </span>
                        ) : sol.fecha_programada ? (
                          <span className="text-xs font-bold text-reciclaje-700">
                            Cita: {sol.fecha_programada} {sol.hora_programada}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-stone-500">
                            Sin programar
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Right operational detail */}
            <div className="lg:col-span-7">
              {!selected ? (
                <div className="eco-card p-8 text-center text-sm text-stone-600">
                  Selecciona una solicitud de la bandeja para gestionarla.
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Card 1: Detalles privados del solicitante (RN-07) */}
                  <div className="eco-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-lg font-black text-stone-900">
                            {selected.codigo}
                          </span>
                          <FlujoBadge flujo={selected.flujo} />
                          <EstadoBadge estado={selected.estado} />
                          {selected.es_piloto_solicitante && (
                            <span className="rounded-full bg-sol-100 px-2.5 py-0.5 text-xs font-extrabold text-sol-700">
                              Piloto
                            </span>
                          )}
                          {selected.canal_origen === "whatsapp_audio" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-100 px-3 py-0.5 text-xs font-extrabold text-emerald-950">
                              <Mic className="h-3.5 w-3.5 text-emerald-700" />
                              <span>🎙️ Pedido por Audio WhatsApp</span>
                            </span>
                          )}
                          {selected.canal_origen === "whatsapp_texto" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-teal-400 bg-teal-100 px-3 py-0.5 text-xs font-extrabold text-teal-950">
                              <MessageCircle className="h-3.5 w-3.5 text-teal-700" />
                              <span>💬 Pedido por WhatsApp</span>
                            </span>
                          )}
                          {selected.requiere_revision_humana && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-amber-100 px-3 py-0.5 text-xs font-extrabold text-amber-950">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                              <span>⚠️ Revisión humana sugerida</span>
                            </span>
                          )}
                        </div>
                        <h2 className="mt-2 text-lg font-black text-stone-900">
                          {selected.nombre_solicitante}
                        </h2>
                        <p className="text-xs font-bold uppercase text-stone-500">
                          Tipo:{" "}
                          {selected.tipo_generador === "unidad_productiva"
                            ? "Unidad Productiva"
                            : "Hogar"}
                        </p>
                      </div>

                      {selected.estado !== "recolectada" &&
                        selected.estado !== "cancelada" && (
                          <div className="flex flex-wrap gap-2">
                            {selected.estado === "recibida" && (
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() =>
                                  handleQuickStatus(selected.id, "en_revision")
                                }
                                className="min-h-[40px] rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-extrabold text-sky-800 hover:bg-sky-100"
                              >
                                Marcar En Revisión
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() =>
                                handleQuickStatus(selected.id, "cancelada")
                              }
                              className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
                            >
                              <XCircle className="h-4 w-4" />
                              <span>Cancelar</span>
                            </button>
                          </div>
                        )}
                    </div>

                    <div className="mt-4 grid gap-2.5 rounded-2xl bg-stone-50 p-4 text-sm sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-stone-800">
                        <Phone className="h-4 w-4 shrink-0 text-huerta-600" />
                        <span className="font-bold">
                          {selected.telefono_contacto}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-800">
                        <MapPin className="h-4 w-4 shrink-0 text-huerta-600" />
                        <span>{selected.direccion}</span>
                      </div>
                      <div className="text-xs text-stone-600 sm:col-span-2">
                        <strong>Preferencia horaria:</strong>{" "}
                        {selected.preferencia_horaria || "No especificada"}
                      </div>
                      {selected.observaciones && (
                        <div className="text-xs text-stone-700 sm:col-span-2">
                          <strong>Observaciones del solicitante:</strong>{" "}
                          {selected.observaciones}
                        </div>
                      )}
                    </div>

                    {/* Transcripción original del audio / mensaje de WhatsApp */}
                    {selected.transcripcion_original && (
                      <div className="mt-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 text-emerald-700" />
                            <span className="text-xs font-black uppercase tracking-wide text-emerald-900">
                              Transcripción exacta del audio / mensaje de WhatsApp
                            </span>
                            {selected.confianza_ia != null && (
                              <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-900 shadow-xs">
                                Confianza IA:{" "}
                                {Math.round(selected.confianza_ia * 100)}%
                              </span>
                            )}
                          </div>
                          <SpeakButton
                            text={`Transcripción del pedido ${selected.codigo}: ${selected.transcripcion_original}`}
                            label="🔊 Escuchar transcripción"
                          />
                        </div>
                        <p className="mt-2.5 rounded-xl bg-white p-3.5 text-sm font-medium italic leading-relaxed text-stone-900 shadow-xs">
                          “{selected.transcripcion_original}”
                        </p>
                      </div>
                    )}

                    {/* Control humano en /coordinacion frente a errores de IA: Reclasificar flujo */}
                    {selected.estado !== "recolectada" &&
                      selected.estado !== "cancelada" && (
                        <div className="mt-4 rounded-2xl border-2 border-stone-200 bg-stone-50 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-stone-800">
                                <ArrowLeftRight className="h-4 w-4 text-sol-600" />
                                <span>
                                  Control Humano · Reclasificar Flujo (RN-01 / RN-04)
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-stone-600">
                                Si el vecino o la IA clasificó mal el residuo,
                                muévelo con 1 clic al otro colectivo dejando
                                trazabilidad en{" "}
                                <code className="font-mono font-bold">
                                  historial_estados
                                </code>
                                .
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() =>
                                handleReclassifyFlow(
                                  selected.id,
                                  selected.codigo,
                                  selected.flujo === "organico"
                                    ? "reciclable"
                                    : "organico"
                                )
                              }
                              className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold text-white shadow-xs transition ${
                                selected.flujo === "organico"
                                  ? "bg-reciclaje-600 hover:bg-reciclaje-700"
                                  : "bg-huerta-600 hover:bg-huerta-700"
                              }`}
                            >
                              <ArrowLeftRight className="h-4 w-4" />
                              <span>
                                {selected.flujo === "organico"
                                  ? "Mover a Recicladores (Reciclables)"
                                  : "Mover a Huerteros (Orgánicos)"}
                              </span>
                            </button>
                          </div>
                          <div className="mt-2.5">
                            <input
                              type="text"
                              value={reclasComment}
                              onChange={(e) => setReclasComment(e.target.value)}
                              placeholder="Motivo opcional de la reclasificación (ej. el audio menciona cajas de cartón y botellas PET)..."
                              className="eco-input py-2 text-xs"
                            />
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Si ya está recolectada: comprobante con unidad + acreditación dual */}
                  {selected.registro_recoleccion ? (
                    <div className="rounded-2xl border-2 border-huerta-200 bg-huerta-50 p-5">
                      <div className="flex items-center gap-2 text-huerta-800">
                        <CheckCircle2 className="h-5 w-5" />
                        <h3 className="text-base font-black">
                          Recolección Registrada y Cerrada (Acreditación Dual)
                        </h3>
                      </div>
                      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-bold text-stone-500">
                            Solicitante verificado
                          </p>
                          <p className="font-bold text-stone-900">
                            {
                              selected.registro_recoleccion
                                .nombre_solicitante_verificado
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-500">
                            Encargado de recolectar / reciclar
                          </p>
                          <p className="font-bold text-stone-900">
                            {selected.registro_recoleccion.nombre_encargado}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-500">
                            Peso registrado / equivalente kg
                          </p>
                          <p className="text-lg font-black text-huerta-800">
                            {selected.registro_recoleccion.peso_ingresado.toFixed(
                              2
                            )}{" "}
                            {selected.registro_recoleccion.unidad_medida}
                            {selected.registro_recoleccion.unidad_medida ===
                              "lb" && (
                              <span className="ml-1.5 text-xs font-bold text-stone-600">
                                (equiv.{" "}
                                {selected.registro_recoleccion.peso_kg.toFixed(
                                  2
                                )}{" "}
                                kg)
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-500">
                            Puntos acreditados (Usuario y Recolector)
                          </p>
                          <p className="text-lg font-black text-sol-700">
                            +
                            {formatPts(
                              selected.registro_recoleccion.puntos_calculados
                            )}{" "}
                            pts c/u
                          </p>
                        </div>
                      </div>
                      {selected.registro_recoleccion.observaciones && (
                        <p className="mt-3 text-xs text-stone-700">
                          <strong>Observaciones:</strong>{" "}
                          {selected.registro_recoleccion.observaciones}
                        </p>
                      )}
                    </div>
                  ) : selected.estado !== "cancelada" ? (
                    <>
                      {/* Card 2: Panel de Programación (RN-02) */}
                      <form
                        onSubmit={handleSchedule}
                        className="eco-card space-y-4 p-5"
                      >
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-5 w-5 text-reciclaje-600" />
                          <h3 className="text-base font-black text-stone-900">
                            1. Programar Día, Hora y Encargado (RN-02 y RN-03)
                          </h3>
                        </div>
                        <p className="text-xs text-stone-600">
                          Al guardar la programación, el estado cambia a{" "}
                          <strong>programada</strong> y se envía automáticamente
                          notificación WhatsApp al usuario.
                        </p>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-bold text-stone-700">
                              Fecha programada *
                            </label>
                            <input
                              type="date"
                              required
                              value={schedDate}
                              onChange={(e) => setSchedDate(e.target.value)}
                              className="eco-input py-2.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold text-stone-700">
                              Hora programada *
                            </label>
                            <input
                              type="time"
                              required
                              value={schedTime}
                              onChange={(e) => setSchedTime(e.target.value)}
                              className="eco-input py-2.5 text-sm"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-bold text-stone-700">
                              Seleccionar del colectivo ({selected.flujo})
                            </label>
                            <select
                              value={schedEncargadoId}
                              onChange={(e) => {
                                const idStr = e.target.value;
                                setSchedEncargadoId(idStr);
                                const found = membersForSelected.find(
                                  (m) => String(m.id) === idStr
                                );
                                if (found) setSchedEncargadoName(found.nombre);
                              }}
                              className="eco-input py-2.5 text-sm"
                            >
                              <option value="">
                                — Elegir integrante o escribir nombre —
                              </option>
                              {membersForSelected.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nombre} ({m.rol_interno})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold text-stone-700">
                              Nombre del encargado asignado *
                            </label>
                            <input
                              type="text"
                              required
                              value={schedEncargadoName}
                              onChange={(e) => {
                                setSchedEncargadoName(e.target.value);
                                setSchedEncargadoId("");
                              }}
                              placeholder="Nombre del huertero o reciclador"
                              className="eco-input py-2.5 text-sm"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={actionBusy}
                          className="eco-btn-teal w-full text-sm"
                        >
                          {actionBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CalendarClock className="h-4 w-4" />
                              <span>
                                Guardar Programación y Notificar por WhatsApp
                              </span>
                            </>
                          )}
                        </button>
                      </form>

                      {/* Card 3: FORMULARIO OBLIGATORIO DE REGISTRO Y CIERRE CON KG / LB */}
                      <form
                        onSubmit={handleCloseCollection}
                        className="space-y-4 rounded-2xl border-2 border-huerta-500 bg-huerta-50/50 p-5 shadow-sm"
                      >
                        <div className="flex items-start gap-2">
                          <ClipboardCheck className="h-6 w-6 shrink-0 text-huerta-700" />
                          <div>
                            <h3 className="text-base font-black text-huerta-900">
                              2. Formulario de Registro y Cierre de Recolección
                              (RN-05)
                            </h3>
                            <p className="text-xs text-stone-600">
                              Registra el peso en <strong>kg</strong> o{" "}
                              <strong>libras (500 g)</strong>. Al guardar se
                              acreditan puntos automáticamente tanto al{" "}
                              <strong>solicitante</strong> como al{" "}
                              <strong>recolector/huertero encargado</strong>.
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-extrabold text-stone-800">
                            Nombre de la persona que pidió el servicio *
                          </label>
                          <input
                            type="text"
                            required
                            value={closeSolicitante}
                            onChange={(e) =>
                              setCloseSolicitante(e.target.value)
                            }
                            placeholder="Verificable o editable por el coordinador"
                            className="eco-input py-2.5 text-sm"
                          />
                        </div>

                        {/* Unidad de medida (kg / lb) + Peso numérico */}
                        <div className="grid gap-3 sm:grid-cols-12">
                          <div className="sm:col-span-5">
                            <label className="mb-1 block text-xs font-extrabold text-stone-800">
                              Unidad de medida *
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setCloseUnidadMedida("kg")}
                                className={`min-h-[48px] rounded-xl border-2 px-3 text-xs font-extrabold transition ${
                                  closeUnidadMedida === "kg"
                                    ? "border-huerta-600 bg-huerta-600 text-white"
                                    : "border-stone-300 bg-white text-stone-700 hover:border-huerta-400"
                                }`}
                              >
                                Kilogramos (kg)
                              </button>
                              <button
                                type="button"
                                onClick={() => setCloseUnidadMedida("lb")}
                                className={`min-h-[48px] rounded-xl border-2 px-3 text-xs font-extrabold transition ${
                                  closeUnidadMedida === "lb"
                                    ? "border-reciclaje-600 bg-reciclaje-600 text-white"
                                    : "border-stone-300 bg-white text-stone-700 hover:border-reciclaje-400"
                                }`}
                              >
                                Libras (lb)
                              </button>
                            </div>
                          </div>

                          <div className="sm:col-span-4">
                            <label className="mb-1 block text-xs font-extrabold text-stone-800">
                              Peso en{" "}
                              {closeUnidadMedida === "kg"
                                ? "kilogramos (kg)"
                                : "libras (500 g)"}{" "}
                              *
                            </label>
                            <div className="relative">
                              <Scale className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-huerta-600" />
                              <input
                                type="number"
                                required
                                min="0.1"
                                step="0.1"
                                value={closePesoIngresado}
                                onChange={(e) =>
                                  setClosePesoIngresado(e.target.value)
                                }
                                placeholder={
                                  closeUnidadMedida === "kg"
                                    ? "Ej: 4.5"
                                    : "Ej: 3"
                                }
                                className="eco-input py-2.5 pl-9 text-sm font-bold"
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-3">
                            <label className="mb-1 block text-xs font-extrabold text-stone-800">
                              Fecha / hora
                            </label>
                            <input
                              type="datetime-local"
                              value={closeFechaHora}
                              onChange={(e) =>
                                setCloseFechaHora(e.target.value)
                              }
                              className="eco-input px-2.5 py-2.5 text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-extrabold text-stone-800">
                              Seleccionar del colectivo
                            </label>
                            <select
                              value={closeEncargadoId}
                              onChange={(e) => {
                                const idStr = e.target.value;
                                setCloseEncargadoId(idStr);
                                const found = membersForSelected.find(
                                  (m) => String(m.id) === idStr
                                );
                                if (found) setCloseEncargadoName(found.nombre);
                              }}
                              className="eco-input py-2.5 text-sm"
                            >
                              <option value="">
                                — Elegir integrante del colectivo —
                              </option>
                              {membersForSelected.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nombre} ({m.rol_interno})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-extrabold text-stone-800">
                              Nombre del encargado de reciclar / recolectar *
                            </label>
                            <input
                              type="text"
                              required
                              value={closeEncargadoName}
                              onChange={(e) => {
                                setCloseEncargadoName(e.target.value);
                                setCloseEncargadoId("");
                              }}
                              placeholder="Nombre completo del encargado"
                              className="eco-input py-2.5 text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold text-stone-700">
                            Observaciones de la entrega (opcional)
                          </label>
                          <textarea
                            rows={2}
                            value={closeObs}
                            onChange={(e) => setCloseObs(e.target.value)}
                            placeholder="Ej: Material limpio, pesado en báscula comunitaria."
                            className="eco-input py-2 text-sm"
                          />
                        </div>

                        {closurePreview && (
                          <div className="rounded-xl border border-sol-400/60 bg-sol-50 px-4 py-3 text-xs">
                            <p className="flex items-center gap-1.5 font-extrabold text-stone-900">
                              <Award className="h-4 w-4 text-sol-600" />
                              <span>
                                Acreditación dual estimada: +
                                {formatPts(closurePreview.pts)} pts usuario y +
                                {formatPts(closurePreview.pts)} pts recolector
                              </span>
                            </p>
                            <p className="mt-1 text-stone-700">
                              Peso ingresado:{" "}
                              <strong>
                                {parseFloat(closePesoIngresado).toFixed(2)}{" "}
                                {closeUnidadMedida}
                              </strong>{" "}
                              · Equivalente normalizado:{" "}
                              <strong>
                                {closurePreview.equivKg.toFixed(2)} kg
                              </strong>{" "}
                              ({formatPts(closurePreview.factor)} pts/
                              {closeUnidadMedida})
                            </p>
                            <p className="mt-1 text-[11px] text-stone-600">
                              {RN06_DISCLAIMER}
                            </p>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={actionBusy}
                          className="eco-btn-primary w-full text-sm"
                        >
                          {actionBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-5 w-5" />
                              <span>
                                Registrar Recolección, Cerrar y Acreditar Puntos
                              </span>
                            </>
                          )}
                        </button>
                      </form>
                    </>
                  ) : null}

                  {/* Card 4: Comunicación Intermediada + Trazabilidad */}
                  <div className="eco-card space-y-4 p-5">
                    <h3 className="flex items-center gap-2 text-sm font-black text-stone-900">
                      <MessageCircle className="h-4 w-4 text-huerta-600" />
                      <span>Mensajería exclusiva Coordinador ↔ Solicitante</span>
                    </h3>

                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-stone-50 p-3">
                      {selected.mensajes.length === 0 ? (
                        <p className="text-xs text-stone-500">
                          Sin mensajes aún en esta solicitud.
                        </p>
                      ) : (
                        selected.mensajes.map((m) => (
                          <div
                            key={m.id}
                            className={`rounded-xl px-3 py-2 text-xs ${
                              m.remitente_id === user?.id
                                ? "ml-6 bg-stone-900 text-white"
                                : "mr-6 border border-stone-200 bg-white text-stone-800"
                            }`}
                          >
                            <p className="font-bold opacity-80">
                              {m.remitente_nombre}
                            </p>
                            <p className="mt-0.5">{m.contenido}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleSendChat} className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={chatText}
                          onChange={(e) => setChatText(e.target.value)}
                          placeholder="Escribe al solicitante para coordinar..."
                          className="eco-input py-2 text-sm"
                        />
                        <button
                          type="submit"
                          disabled={actionBusy}
                          className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl bg-stone-900 px-4 text-xs font-extrabold text-white hover:bg-stone-800"
                        >
                          <Send className="h-4 w-4" />
                          <span>Enviar</span>
                        </button>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600">
                        <input
                          type="checkbox"
                          checked={chatAlsoWhatsapp}
                          onChange={(e) =>
                            setChatAlsoWhatsapp(e.target.checked)
                          }
                          className="h-4 w-4 rounded border-stone-300 text-huerta-600"
                        />
                        <span>
                          Enviar copia automática por WhatsApp Business Cloud
                          API
                        </span>
                      </label>
                    </form>

                    {/* Trazabilidad RN-04 */}
                    <div className="border-t border-stone-100 pt-4">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-500">
                        Trazabilidad de estados (RN-04)
                      </h4>
                      <ul className="mt-2.5 space-y-2 text-xs">
                        {selected.historial_estados.map((h) => (
                          <li
                            key={h.id}
                            className="flex items-start justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2"
                          >
                            <div>
                              <span className="font-bold text-stone-900">
                                {h.estado_anterior
                                  ? `${h.estado_anterior} → ${h.estado_nuevo}`
                                  : h.estado_nuevo}
                              </span>
                              <p className="text-stone-600">{h.comentario}</p>
                              <p className="text-[11px] text-stone-400">
                                Por {h.usuario_nombre}
                              </p>
                            </div>
                            <span className="shrink-0 text-[11px] text-stone-500">
                              {new Date(h.creado_en).toLocaleString("es-CO")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PUNTOS DEL EQUIPO (HUERTEROS / RECICLADORES) */}
      {activeTab === "puntos_equipo" && (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border-2 border-sol-400/50 bg-sol-50 p-4 text-xs font-bold text-stone-800">
            <p className="text-base font-black text-stone-900">
              Puntos del Equipo (Huerteros / Recicladores)
            </p>
            <p className="mt-1 text-sm">
              Cada cierre de recolección acredita automáticamente los mismos
              puntos al recolector o huertero encargado. Registra canjes cuando
              el integrante alcance el nivel requerido.
            </p>
            <p className="mt-1.5 text-xs text-stone-700">
              <strong>Nota institucional (RN-06):</strong>{" "}
              {panelRecolectores?.nota_institucional || RN06_DISCLAIMER}
            </p>
          </div>

          {panelRecolectores &&
            panelRecolectores.catalogo_beneficios.length > 0 && (
              <div className="grid gap-3 md:grid-cols-3">
                {panelRecolectores.catalogo_beneficios.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                  >
                    <span className="inline-flex items-center gap-1 rounded-full bg-sol-100 px-2.5 py-0.5 text-xs font-black text-sol-700">
                      <Gift className="h-3.5 w-3.5" />
                      <span>{formatPts(b.puntos_requeridos)} pts</span>
                    </span>
                    <h3 className="mt-2 text-sm font-black text-stone-900">
                      {b.nombre}
                    </h3>
                    <p className="mt-1 text-xs text-stone-600">
                      {b.descripcion}
                    </p>
                  </div>
                ))}
              </div>
            )}

          <div className="space-y-4">
            {!panelRecolectores ||
            panelRecolectores.recolectores.length === 0 ? (
              <div className="eco-card p-8 text-center text-sm text-stone-500">
                No hay integrantes registrados en este flujo.
              </div>
            ) : (
              panelRecolectores.recolectores.map((rec) => {
                const prog = rec.progreso_nivel;
                const unlockedBenefits = rec.beneficios.filter(
                  (b) => b.desbloqueado
                );
                return (
                  <article key={rec.integrante_id} className="eco-card p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-stone-900">
                            {rec.nombre}
                          </h3>
                          <FlujoBadge flujo={rec.flujo} />
                          <span className="rounded-full bg-huerta-100 px-2.5 py-0.5 text-xs font-extrabold text-huerta-800">
                            Nivel: {prog.nivel_actual}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-stone-600">
                          {rec.rol_interno} · Zona:{" "}
                          {rec.zona_cobertura || "Villas de San Pablo"} ·{" "}
                          <strong>{rec.recolecciones_realizadas}</strong>{" "}
                          recolecciones ·{" "}
                          <strong>
                            {rec.total_kg_recolectados.toFixed(2)} kg
                          </strong>
                        </p>
                      </div>

                      <div className="rounded-2xl bg-sol-50 px-4 py-2.5 text-left sm:text-right">
                        <p className="text-[11px] font-extrabold uppercase text-sol-700">
                          Saldo disponible
                        </p>
                        <p className="text-2xl font-black text-stone-900">
                          {formatPts(rec.puntos_disponibles)} pts
                        </p>
                        <p className="text-[11px] text-stone-500">
                          Ganados: {formatPts(rec.puntos_ganados)} · Canjeados:{" "}
                          {formatPts(rec.puntos_canjeados)}
                        </p>
                      </div>
                    </div>

                    {/* Barra de progreso hacia el siguiente nivel */}
                    <div className="mt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold text-stone-700">
                        <span className="inline-flex items-center gap-1.5">
                          <TrendingUp className="h-4 w-4 text-huerta-600" />
                          <span>
                            {prog.siguiente_beneficio_id
                              ? `Siguiente nivel: ${prog.siguiente_nivel_nombre}`
                              : "¡Nivel máximo alcanzado!"}
                          </span>
                        </span>
                        <span className="text-huerta-800">
                          {prog.porcentaje_avance.toFixed(0)}%
                          {prog.siguiente_beneficio_id &&
                            ` · Faltan ${formatPts(prog.puntos_faltantes)} pts`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-3.5 w-full overflow-hidden rounded-full bg-stone-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-huerta-500 via-reciclaje-500 to-sol-500 transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              Math.max(prog.porcentaje_avance, 4),
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Control para registrar canje de beneficio */}
                    <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <p className="text-xs font-extrabold text-stone-800">
                        Registrar canje de beneficio para {rec.nombre}
                      </p>
                      <div className="mt-2.5 grid gap-2.5 md:grid-cols-12">
                        <select
                          value={redeemBenefitByCol[rec.integrante_id] || ""}
                          onChange={(e) =>
                            setRedeemBenefitByCol((prev) => ({
                              ...prev,
                              [rec.integrante_id]: e.target.value,
                            }))
                          }
                          className="eco-input py-2 text-xs md:col-span-5"
                        >
                          <option value="">
                            {unlockedBenefits.length > 0
                              ? "— Seleccionar beneficio desbloqueado —"
                              : "— Aún sin saldo suficiente para canje —"}
                          </option>
                          {rec.beneficios.map((b) => (
                            <option
                              key={b.id}
                              value={b.id}
                              disabled={!b.desbloqueado}
                            >
                              {b.nombre} ({formatPts(b.puntos_requeridos)} pts)
                              {b.desbloqueado
                                ? " — DISPONIBLE"
                                : ` — Faltan ${formatPts(b.puntos_faltantes)} pts`}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={redeemNoteByCol[rec.integrante_id] || ""}
                          onChange={(e) =>
                            setRedeemNoteByCol((prev) => ({
                              ...prev,
                              [rec.integrante_id]: e.target.value,
                            }))
                          }
                          placeholder="Observación de entrega (opcional)"
                          className="eco-input py-2 text-xs md:col-span-4"
                        />
                        <button
                          type="button"
                          disabled={
                            actionBusy || unlockedBenefits.length === 0
                          }
                          onClick={() =>
                            handleCollectorRedeem(rec.integrante_id, rec.nombre)
                          }
                          className="eco-btn-primary py-2 text-xs md:col-span-3"
                        >
                          <Gift className="h-4 w-4" />
                          <span>Registrar canje</span>
                        </button>
                      </div>

                      {rec.canjes_recientes.length > 0 && (
                        <div className="mt-3 border-t border-stone-200 pt-2.5">
                          <p className="text-[11px] font-bold uppercase text-stone-500">
                            Canjes recientes:
                          </p>
                          <ul className="mt-1 space-y-1 text-xs text-stone-700">
                            {rec.canjes_recientes.map((c) => (
                              <li
                                key={c.id}
                                className="flex flex-wrap items-center justify-between gap-2"
                              >
                                <span>
                                  <strong>{c.beneficio_nombre}</strong> (
                                  {new Date(c.creado_en).toLocaleDateString(
                                    "es-CO"
                                  )}
                                  )
                                  {c.observaciones
                                    ? ` · ${c.observaciones}`
                                    : ""}
                                </span>
                                <span className="font-bold text-rose-700">
                                  -{formatPts(c.puntos_canjeados)} pts
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORIAL Y REPORTES */}
      {activeTab === "historial" && (
        <div className="mt-6 space-y-5">
          <div className="eco-card flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-stone-600">
                  Desde
                </label>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="eco-input py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-stone-600">
                  Hasta
                </label>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="eco-input py-2 text-sm"
                />
              </div>
              {(desde || hasta) && (
                <button
                  type="button"
                  onClick={() => {
                    setDesde("");
                    setHasta("");
                  }}
                  className="min-h-[44px] self-end rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold text-stone-700"
                >
                  Limpiar fechas
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="eco-btn-primary text-sm"
            >
              <Download className="h-4 w-4" />
              <span>Exportar CSV</span>
            </button>
          </div>

          {resumen && (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Object.entries(resumen.por_estado).map(([st, count]) => (
                <div key={st} className="eco-card p-3.5 text-center">
                  <EstadoBadge estado={st as EstadoSolicitud} />
                  <p className="mt-2 text-2xl font-black text-stone-900">
                    {count}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="eco-card overflow-hidden">
            <div className="border-b border-stone-200 px-5 py-4">
              <h3 className="text-base font-black text-stone-900">
                Historial de Recolecciones Registradas en PostgreSQL
              </h3>
              <p className="text-xs text-stone-500">
                Total periodo:{" "}
                <strong>{resumen?.total_kg_recolectados ?? 0} kg</strong> ·
                Puntos generados (acreditados a usuario y recolector):{" "}
                <strong>
                  {formatPts(resumen?.total_puntos_otorgados ?? 0)} pts c/u
                </strong>
              </p>
            </div>
            {recolecciones.length === 0 ? (
              <p className="p-8 text-center text-sm text-stone-500">
                No hay recolecciones cerradas en el periodo seleccionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Solicitante Verificado</th>
                      <th className="px-4 py-3">Flujo</th>
                      <th className="px-4 py-3">Peso Ingresado</th>
                      <th className="px-4 py-3">Equiv. (kg)</th>
                      <th className="px-4 py-3">Encargado</th>
                      <th className="px-4 py-3 text-right">Puntos (c/u)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {recolecciones.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-mono font-bold">
                          {r.codigo_solicitud}
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-600">
                          {new Date(r.fecha_hora_recoleccion).toLocaleString(
                            "es-CO"
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-stone-900">
                          {r.nombre_solicitante_verificado}
                        </td>
                        <td className="px-4 py-3">
                          <FlujoBadge flujo={r.flujo} />
                        </td>
                        <td className="px-4 py-3 font-bold text-stone-800">
                          {r.peso_ingresado.toFixed(2)} {r.unidad_medida}
                        </td>
                        <td className="px-4 py-3 font-extrabold text-huerta-700">
                          {r.peso_kg.toFixed(2)} kg
                        </td>
                        <td className="px-4 py-3 text-stone-700">
                          {r.nombre_encargado}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-sol-700">
                          +{formatPts(r.puntos_calculados)} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: VISOR WHATSAPP CLOUD API / SIMULACIÓN */}
      {activeTab === "whatsapp" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-huerta-200 bg-huerta-50 p-4 text-sm text-huerta-900">
            <p className="font-extrabold">
              Visor de Notificaciones WhatsApp Business Cloud API (Meta)
            </p>
            <p className="mt-1 text-xs">
              Estado actual:{" "}
              <strong className="uppercase">
                Modo {resumen?.modo_whatsapp_activo || "simulado"}
              </strong>
              . Cuando existen <code>WHATSAPP_ACCESS_TOKEN</code> y{" "}
              <code>WHATSAPP_PHONE_NUMBER_ID</code> en <code>.env</code>, los
              mensajes se envían por Meta Graph API; de lo contrario se simulan
              y persisten aquí para verificación de la demo.
            </p>
          </div>

          <div className="space-y-3">
            {whatsappLogs.length === 0 ? (
              <div className="eco-card p-8 text-center text-sm text-stone-500">
                Aún no hay notificaciones registradas para este flujo.
              </div>
            ) : (
              whatsappLogs.map((n) => (
                <article key={n.id} className="eco-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-huerta-100 px-2.5 py-0.5 text-xs font-bold uppercase text-huerta-800">
                        {n.tipo_evento.replace(/_/g, " ")}
                      </span>
                      {n.codigo_solicitud && (
                        <span className="font-mono text-xs font-bold text-stone-800">
                          {n.codigo_solicitud}
                        </span>
                      )}
                      <FlujoBadge flujo={n.flujo} />
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                        n.estado_envio === "enviado"
                          ? "bg-huerta-600 text-white"
                          : n.estado_envio === "error"
                            ? "bg-rose-600 text-white"
                            : "bg-sol-100 text-sol-700"
                      }`}
                    >
                      {n.modo} · {n.estado_envio}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-stone-600">
                    <strong>Para:</strong> {n.destinatario_nombre} (
                    {n.destinatario_telefono}) ·{" "}
                    {new Date(n.creado_en).toLocaleString("es-CO")}
                  </p>
                  <div className="mt-2 rounded-xl bg-stone-50 p-3 text-sm text-stone-800">
                    {n.mensaje}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: MI COLECTIVO (INTERNO) */}
      {activeTab === "colectivo" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-700">
              <strong>Listado interno del colectivo:</strong> Este equipo solo
              es gestionado por su coordinador en <code>/coordinacion</code> y
              sus datos de contacto jamás se exponen a los usuarios
              solicitantes.
            </div>
            {colectivo.map((m) => (
              <div
                key={m.id}
                className="eco-card flex items-center justify-between gap-3 p-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      m.flujo === "organico"
                        ? "bg-huerta-100 text-huerta-700"
                        : "bg-reciclaje-100 text-reciclaje-700"
                    }`}
                  >
                    {m.flujo === "organico" ? (
                      <Leaf className="h-5 w-5" />
                    ) : (
                      <Recycle className="h-5 w-5" />
                    )}
                  </span>
                  <div>
                    <p className="font-extrabold text-stone-900">{m.nombre}</p>
                    <p className="text-xs text-stone-600">
                      {m.rol_interno} · Zona: {m.zona_cobertura || "General"}
                    </p>
                  </div>
                </div>
                <FlujoBadge flujo={m.flujo} />
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddMember}
            className="eco-card h-fit space-y-4 p-5 lg:col-span-5"
          >
            <h3 className="flex items-center gap-2 text-base font-black text-stone-900">
              <Plus className="h-5 w-5 text-huerta-600" />
              <span>Registrar integrante del colectivo</span>
            </h3>
            {isAdmin && (
              <div>
                <label className="mb-1 block text-xs font-bold text-stone-700">
                  Flujo del colectivo
                </label>
                <select
                  value={newMemberFlow}
                  onChange={(e) =>
                    setNewMemberFlow(e.target.value as FlujoResiduo)
                  }
                  className="eco-input py-2.5 text-sm"
                >
                  <option value="organico">Orgánico (Huerteros)</option>
                  <option value="reciclable">Reciclable (Recicladores)</option>
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-bold text-stone-700">
                Nombre completo *
              </label>
              <input
                type="text"
                required
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Ej: Pedro José Villa"
                className="eco-input py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-stone-700">
                Rol interno
              </label>
              <input
                type="text"
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                placeholder="Ej: Huertero comunitario / Reciclador de oficio"
                className="eco-input py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-stone-700">
                Zona de cobertura
              </label>
              <input
                type="text"
                value={newMemberZone}
                onChange={(e) => setNewMemberZone(e.target.value)}
                className="eco-input py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={actionBusy}
              className="eco-btn-primary w-full text-sm"
            >
              <span>Guardar integrante</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 6: ADMINISTRACIÓN (RN-06 REGLAS KG/LB + CATÁLOGO BENEFICIOS + RN-08 PILOTO) */}
      {activeTab === "admin" && isAdmin && (
        <div className="mt-6 space-y-6">
          <div className="eco-card p-5 sm:p-6">
            <h3 className="text-lg font-black text-stone-900">
              Parametrización de Puntos por Peso — kg y lb (RN-06)
            </h3>
            <p className="mt-1 rounded-xl border border-sol-400/50 bg-sol-50 px-3.5 py-2 text-xs font-bold text-stone-800">
              {RN06_DISCLAIMER}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {(["organico", "reciclable"] as const).map((flujo) => {
                const draft = ruleDrafts[flujo] || {
                  puntos_por_kg: "1.0",
                  puntos_por_libra: "0.5",
                  descripcion: "",
                };
                return (
                  <div
                    key={flujo}
                    className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4"
                  >
                    <FlujoBadge flujo={flujo} />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-stone-700">
                          Puntos por Kilogramo (1 kg)
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={draft.puntos_por_kg}
                          onChange={(e) =>
                            setRuleDrafts((prev) => ({
                              ...prev,
                              [flujo]: {
                                ...draft,
                                puntos_por_kg: e.target.value,
                              },
                            }))
                          }
                          className="eco-input py-2 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-stone-700">
                          Puntos por Libra (500 g)
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={draft.puntos_por_libra}
                          onChange={(e) =>
                            setRuleDrafts((prev) => ({
                              ...prev,
                              [flujo]: {
                                ...draft,
                                puntos_por_libra: e.target.value,
                              },
                            }))
                          }
                          className="eco-input py-2 text-sm font-bold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-stone-700">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={draft.descripcion}
                        onChange={(e) =>
                          setRuleDrafts((prev) => ({
                            ...prev,
                            [flujo]: { ...draft, descripcion: e.target.value },
                          }))
                        }
                        className="eco-input py-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleSaveRule(flujo)}
                      className="eco-btn-primary w-full text-sm"
                    >
                      <span>Guardar regla {flujo}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Catálogo editable de Beneficios */}
          <div className="eco-card space-y-5 p-5 sm:p-6">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black text-stone-900">
                <Gift className="h-5 w-5 text-sol-600" />
                <span>
                  Catálogo de Beneficios y Niveles (Usuarios y Recolectores)
                </span>
              </h3>
              <p className="mt-1 text-xs text-stone-600">
                Edita nombres, descripciones, puntos requeridos o estado activo
                de cada nivel. {RN06_DISCLAIMER}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {adminBeneficios.map((b) => {
                const draft = benefitDrafts[b.id] || {
                  nombre: b.nombre,
                  descripcion: b.descripcion,
                  puntos_requeridos: String(b.puntos_requeridos),
                  activo: b.activo,
                };
                return (
                  <div
                    key={b.id}
                    className="space-y-2.5 rounded-2xl border border-stone-200 bg-stone-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                          b.tipo_destinatario === "usuario"
                            ? "bg-huerta-100 text-huerta-800"
                            : "bg-reciclaje-100 text-reciclaje-700"
                        }`}
                      >
                        {b.tipo_destinatario}
                      </span>
                      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700">
                        <input
                          type="checkbox"
                          checked={draft.activo}
                          onChange={(e) =>
                            setBenefitDrafts((prev) => ({
                              ...prev,
                              [b.id]: { ...draft, activo: e.target.checked },
                            }))
                          }
                          className="h-4 w-4 rounded border-stone-300 text-huerta-600"
                        />
                        <span>Activo</span>
                      </label>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-stone-700">
                        Nombre / Nivel
                      </label>
                      <input
                        type="text"
                        value={draft.nombre}
                        onChange={(e) =>
                          setBenefitDrafts((prev) => ({
                            ...prev,
                            [b.id]: { ...draft, nombre: e.target.value },
                          }))
                        }
                        className="eco-input py-2 text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-stone-700">
                        Descripción
                      </label>
                      <textarea
                        rows={2}
                        value={draft.descripcion}
                        onChange={(e) =>
                          setBenefitDrafts((prev) => ({
                            ...prev,
                            [b.id]: { ...draft, descripcion: e.target.value },
                          }))
                        }
                        className="eco-input py-2 text-xs"
                      />
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-bold text-stone-700">
                          Puntos requeridos
                        </label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={draft.puntos_requeridos}
                          onChange={(e) =>
                            setBenefitDrafts((prev) => ({
                              ...prev,
                              [b.id]: {
                                ...draft,
                                puntos_requeridos: e.target.value,
                              },
                            }))
                          }
                          className="eco-input py-2 text-sm font-bold"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleSaveBenefit(b.id)}
                        className="eco-btn-primary py-2 text-xs"
                      >
                        <span>Guardar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={handleCreateBenefit}
              className="rounded-2xl border border-dashed border-stone-300 bg-white p-4"
            >
              <h4 className="flex items-center gap-1.5 text-sm font-extrabold text-stone-900">
                <Plus className="h-4 w-4 text-huerta-600" />
                <span>Agregar nuevo beneficio al catálogo</span>
              </h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-12">
                <select
                  value={newBenTipo}
                  onChange={(e) =>
                    setNewBenTipo(e.target.value as TipoDestinatario)
                  }
                  className="eco-input py-2 text-xs sm:col-span-3"
                >
                  <option value="usuario">Destinatario: Usuario</option>
                  <option value="recolector">Destinatario: Recolector</option>
                </select>
                <input
                  type="text"
                  required
                  value={newBenNombre}
                  onChange={(e) => setNewBenNombre(e.target.value)}
                  placeholder="Nombre del nivel y beneficio"
                  className="eco-input py-2 text-xs sm:col-span-4"
                />
                <input
                  type="number"
                  required
                  min="0.5"
                  step="0.5"
                  value={newBenPuntos}
                  onChange={(e) => setNewBenPuntos(e.target.value)}
                  placeholder="Puntos"
                  className="eco-input py-2 text-xs font-bold sm:col-span-2"
                />
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="eco-btn-amber py-2 text-xs sm:col-span-3"
                >
                  <span>Crear beneficio</span>
                </button>
                <input
                  type="text"
                  required
                  value={newBenDesc}
                  onChange={(e) => setNewBenDesc(e.target.value)}
                  placeholder="Descripción del beneficio referencial..."
                  className="eco-input py-2 text-xs sm:col-span-12"
                />
              </div>
            </form>
          </div>

          {/* RN-08: Control de Piloto */}
          <div className="eco-card overflow-hidden">
            <div className="border-b border-stone-200 px-5 py-4">
              <h3 className="flex items-center gap-2 text-lg font-black text-stone-900">
                <UserCheck className="h-5 w-5 text-huerta-600" />
                <span>Control del Piloto Villas de San Pablo (RN-08)</span>
              </h3>
              <p className="text-xs text-stone-600">
                Activa o desactiva las banderas <code>es_piloto</code> y{" "}
                <code>habilitado_solicitudes</code> para hogares y unidades
                productivas.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Saldo Puntos</th>
                    <th className="px-4 py-3">Es Piloto</th>
                    <th className="px-4 py-3">Habilitado Solicitudes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {adminUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-stone-900">{u.nombre}</p>
                        <p className="text-xs text-stone-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{u.rol}</td>
                      <td className="px-4 py-3 font-bold">
                        {formatPts(u.puntos_acumulados)} pts
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => handleToggleUserFlag(u, "es_piloto")}
                          className={`min-h-[38px] rounded-full px-3 py-1 text-xs font-extrabold ${
                            u.es_piloto
                              ? "bg-sol-100 text-sol-700"
                              : "bg-stone-100 text-stone-500"
                          }`}
                        >
                          {u.es_piloto ? "Sí · Piloto" : "No"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() =>
                            handleToggleUserFlag(u, "habilitado_solicitudes")
                          }
                          className={`min-h-[38px] rounded-full px-3 py-1 text-xs font-extrabold ${
                            u.habilitado_solicitudes
                              ? "bg-huerta-100 text-huerta-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {u.habilitado_solicitudes
                            ? "Habilitado"
                            : "Bloqueado"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
