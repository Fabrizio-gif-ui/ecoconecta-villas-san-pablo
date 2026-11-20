"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCheck,
  Leaf,
  Loader2,
  MessageCircle,
  Mic,
  Recycle,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Store,
  Home,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

import SpeakButton from "@/components/SpeakButton";
import { FlujoBadge } from "@/components/StatusBadge";
import type { SimulacionWhatsAppResponse } from "@/lib/types";

interface FictionalPersona {
  id: string;
  nombre: string;
  telefono: string;
  direccion: string;
  tipo_generador: "hogar" | "unidad_productiva";
  usuario_email: string;
  etiqueta: string;
  ejemploAudioOrganico: string;
  ejemploAudioReciclable: string;
}

const PERSONAS: FictionalPersona[] = [
  {
    id: "esquina_verde",
    nombre: "Tienda La Esquina Verde (Doña Rosa)",
    telefono: "+57 300 555 0199",
    direccion: "Manzana 15, Local 2, Villas de San Pablo",
    tipo_generador: "unidad_productiva",
    usuario_email: "piloto@villas.demo",
    etiqueta: "Unidad Productiva · Tienda de barrio",
    ejemploAudioOrganico:
      "Hola vecinos de EcoConecta, les habla Doña Rosa de la Tienda La Esquina Verde en la Manzana 15 Local 2 de Villas de San Pablo. Tengo dos baldes llenos de cáscaras de plátano, yuca, papaya y restos de verdura para la huerta comunitaria, pueden pasar mañana por la mañana.",
    ejemploAudioReciclable:
      "Hola EcoConecta, habla Doña Rosa de la Tienda La Esquina Verde en Manzana 15 Local 2. Tengo varias cajas de cartón desarmadas y bolsas con botellas plásticas PET limpias y latas para los recicladores hoy en la tarde.",
  },
  {
    id: "familia_martinez",
    nombre: "Familia Martínez",
    telefono: "+57 301 444 0288",
    direccion: "Manzana 9, Casa 12, Etapa 1, Villas de San Pablo",
    tipo_generador: "hogar",
    usuario_email: "hogar@villas.demo",
    etiqueta: "Hogar · Etapa 1",
    ejemploAudioOrganico:
      "Buenos días, habla Jorge de la Familia Martínez en la Manzana 9 Casa 12 de Villas de San Pablo. Guardamos en el balde con tapa cáscaras de huevo, borra de café y cáscaras de fruta para que pasen los huerteros por la mañana.",
    ejemploAudioReciclable:
      "Buenas tardes amigos de EcoConecta, somos la Familia Martínez en la Manzana 9 Casa 12 de Villas de San Pablo. Tenemos tres sacos con botellas plásticas PET, cartón limpio, cuadernos usados y latas de aluminio para que pasen en la tarde.",
  },
  {
    id: "comedor_sabor",
    nombre: "Comedor Comunitario Sabor Caribeño",
    telefono: "+57 300 000 0101",
    direccion: "Manzana 14, Casa 8, Sector Las Palmas, Villas de San Pablo",
    tipo_generador: "unidad_productiva",
    usuario_email: "piloto@villas.demo",
    etiqueta: "Unidad Productiva Piloto · Comedor",
    ejemploAudioOrganico:
      "Hola Marta, hablamos del Comedor Comunitario Sabor Caribeño en la Manzana 14 Casa 8. Tenemos tres pimpinas con restos de comida cruda, cáscaras de plátano, papa y verduras listas para el abono de la huerta mañana a las 8 de la mañana.",
    ejemploAudioReciclable:
      "Hola Carlos, del Comedor Comunitario Sabor Caribeño en Manzana 14 Casa 8. Reunimos cajas grandes de cartón, envases plásticos y frascos de vidrio limpios para recolección en la tarde.",
  },
];

interface ChatBubble {
  id: string;
  sender: "user" | "bot";
  kind: "audio" | "text";
  text: string;
  audioUrl?: string;
  timestamp: string;
  response?: SimulacionWhatsAppResponse;
}

function nowTimeLabel(): string {
  const d = new Date();
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createSyntheticWavBlob(durationSeconds = 2): Blob {
  const sampleRate = 8000;
  const numSamples = sampleRate * durationSeconds;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.sin(Math.PI * (i / numSamples));
    const sample =
      Math.sin(2 * Math.PI * 260 * t) * 0.25 * envelope +
      Math.sin(2 * Math.PI * 390 * t) * 0.15 * envelope;
    view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export default function WhatsAppDemoPage() {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(
    PERSONAS[0].id
  );
  const persona =
    PERSONAS.find((p) => p.id === selectedPersonaId) ?? PERSONAS[0];

  const [messages, setMessages] = useState<ChatBubble[]>([
    {
      id: "welcome-bot",
      sender: "bot",
      kind: "text",
      text: "¡Hola vecino(a) de Villas de San Pablo! 👋 Soy el asistente de WhatsApp de EcoConecta. Puedes enviarme una NOTA DE VOZ 🎙️ o un mensaje de texto contándome qué residuos tienes listos (orgánicos para la huerta o reciclables) y en qué horario prefieres que pasemos.",
      timestamp: nowTimeLabel(),
    },
  ]);

  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live microphone MediaRecorder state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveSpeechTranscript, setLiveSpeechTranscript] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [voiceCaptionText, setVoiceCaptionText] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isRecording, recordedBlob]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const startMicrophoneRecording = async () => {
    setErrorMsg(null);
    setLiveSpeechTranscript("");
    setRecordedBlob(null);
    setRecordedAudioUrl(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setErrorMsg(
        "Tu navegador no permite acceso directo al micrófono en esta pestaña. Puedes usar los botones de 'Nota de voz de prueba en 1 toque' debajo del chat."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedAudioUrl(url);
      };

      // Optional parallel Web Speech recognition in es-CO for instant local fallback without API key
      const win = window as unknown as {
        SpeechRecognition?: new () => {
          lang: string;
          continuous: boolean;
          interimResults: boolean;
          onresult: (e: {
            results: ArrayLike<ArrayLike<{ transcript: string }>>;
          }) => void;
          start: () => void;
          stop: () => void;
        };
        webkitSpeechRecognition?: new () => {
          lang: string;
          continuous: boolean;
          interimResults: boolean;
          onresult: (e: {
            results: ArrayLike<ArrayLike<{ transcript: string }>>;
          }) => void;
          start: () => void;
          stop: () => void;
        };
      };
      const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const recognition = new SpeechRec();
          recognition.lang = "es-CO";
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (event) => {
            let full = "";
            for (let i = 0; i < event.results.length; i++) {
              full += event.results[i][0].transcript + " ";
            }
            const cleaned = full.trim();
            if (cleaned) {
              setLiveSpeechTranscript(cleaned);
              setVoiceCaptionText(cleaned);
            }
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // SpeechRecognition optional
        }
      }

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setErrorMsg(
        "No pudimos acceder al micrófono (verifica el permiso del navegador o usa una nota de voz de demostración con 1 toque abajo)."
      );
    }
  };

  const stopMicrophoneRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setVoiceCaptionText((prev) =>
      prev.trim() ? prev : persona.ejemploAudioOrganico
    );
  };

  const discardRecordedVoice = () => {
    setRecordedBlob(null);
    setRecordedAudioUrl(null);
    setLiveSpeechTranscript("");
    setVoiceCaptionText("");
  };

  const submitToWebhookSimulator = async (opts: {
    audioBlob?: Blob | null;
    audioPreviewUrl?: string | null;
    texto?: string;
    labelForBubble?: string;
  }) => {
    setSending(true);
    setErrorMsg(null);

    const isAudio = Boolean(opts.audioBlob);
    const displayUserBubble: ChatBubble = {
      id: `user-${Date.now()}`,
      sender: "user",
      kind: isAudio ? "audio" : "text",
      text:
        opts.labelForBubble ||
        opts.texto ||
        "🎙️ Nota de voz enviada a EcoConecta",
      audioUrl: opts.audioPreviewUrl || undefined,
      timestamp: nowTimeLabel(),
    };
    setMessages((prev) => [...prev, displayUserBubble]);

    try {
      const formData = new FormData();
      formData.append("remitente_nombre", persona.nombre);
      formData.append("remitente_telefono", persona.telefono);
      formData.append("direccion_referencia", persona.direccion);
      formData.append("tipo_generador", persona.tipo_generador);
      formData.append("usuario_email", persona.usuario_email);

      if (opts.texto && opts.texto.trim()) {
        formData.append("texto", opts.texto.trim());
      }
      if (opts.audioBlob) {
        const ext = opts.audioBlob.type.includes("wav")
          ? "wav"
          : opts.audioBlob.type.includes("ogg")
            ? "ogg"
            : "webm";
        formData.append(
          "archivo_audio",
          opts.audioBlob,
          `nota_voz_ecoconecta.${ext}`
        );
      }

      const res = await fetch("/api/webhooks/whatsapp/simular", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(
          errBody?.detail ||
            "No pudimos procesar el mensaje de WhatsApp en este momento."
        );
      }

      const data = (await res.json()) as SimulacionWhatsAppResponse;
      const botBubble: ChatBubble = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        kind: "text",
        text: data.respuesta_bot,
        timestamp: nowTimeLabel(),
        response: data,
      };
      setMessages((prev) => [...prev, botBubble]);
      discardRecordedVoice();
      setInputText("");
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Ocurrió un problema al enviar el mensaje al simulador."
      );
    } finally {
      setSending(false);
    }
  };

  const handleSendTextForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;
    await submitToWebhookSimulator({
      texto: inputText.trim(),
    });
  };

  const handleSendRecordedVoiceNote = async () => {
    if (!recordedBlob || sending) return;
    await submitToWebhookSimulator({
      audioBlob: recordedBlob,
      audioPreviewUrl: recordedAudioUrl,
      texto: voiceCaptionText.trim() || persona.ejemploAudioOrganico,
      labelForBubble:
        voiceCaptionText.trim() ||
        "🎙️ Nota de voz grabada desde micrófono del navegador",
    });
  };

  const handleQuickPresetAudio = async (
    kind: "organico" | "reciclable" | "ambiguo"
  ) => {
    if (sending) return;
    const wavBlob = createSyntheticWavBlob(2);
    const wavUrl = URL.createObjectURL(wavBlob);

    let transcript = persona.ejemploAudioOrganico;
    if (kind === "reciclable") {
      transcript = persona.ejemploAudioReciclable;
    } else if (kind === "ambiguo") {
      transcript = `Hola EcoConecta, les hablo desde ${persona.direccion}. Tengo unas bolsas con cáscaras de plátano y comida pero también cajas de cartón y botellas plásticas mezcladas, ayúdenme a revisar quién pasa.`;
    }

    await submitToWebhookSimulator({
      audioBlob: wavBlob,
      audioPreviewUrl: wavUrl,
      texto: transcript,
      labelForBubble: transcript,
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Back navigation */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-stone-300 bg-white px-4 py-2 text-sm font-extrabold text-stone-800 hover:bg-stone-100"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>← Volver al inicio</span>
        </Link>

        <Link
          href="/coordinacion"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-extrabold text-white shadow-xs hover:bg-stone-800"
        >
          <ShieldCheck className="h-4 w-4 text-sol-400" />
          <span>Abrir Bandeja /coordinacion</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Header explanation banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 p-6 text-white shadow-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-emerald-100">
              <Mic className="h-3.5 w-3.5" />
              <span>
                Módulo WhatsApp Business Cloud API + OpenAI (Audio y Texto)
              </span>
            </span>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">
              Simulador de Solicitud por WhatsApp con Nota de Voz en Vivo
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-emerald-50">
              Prueba cómo un hogar o tienda de{" "}
              <strong>Villas de San Pablo</strong> pide recolección enviando una{" "}
              <strong>nota de voz (audio)</strong> o texto por WhatsApp. El
              sistema transcribe el audio, extrae el flujo (
              <strong>Orgánico</strong> o <strong>Reciclable</strong>) sin
              enviar el teléfono al modelo de IA y enruta el pedido directo a{" "}
              <code className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-xs">
                /coordinacion
              </code>
              .
            </p>
          </div>

          <SpeakButton
            text="Simulador de WhatsApp de EcoConecta Villas de San Pablo. Elige un vecino o tienda, graba una nota de voz con tu micrófono o toca un audio de ejemplo, y mira cómo se crea automáticamente el pedido para los huerteros o recicladores."
            label="🔊 Escuchar cómo usar"
            className="border-white/30 bg-white/15 text-white hover:bg-white/25"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Left Column: Step 1 (Persona Selector) + Quick Audio Triggers + Privacy / Architecture Info */}
        <div className="space-y-5 lg:col-span-5">
          {/* 1. Selector de Usuario Ficticio */}
          <div className="eco-card p-5">
            <h2 className="text-base font-black text-stone-900">
              1. Elige quién envía el WhatsApp
            </h2>
            <p className="mt-1 text-xs text-stone-600">
              Selecciona una familia o negocio ficticio del piloto en Villas de
              San Pablo:
            </p>

            <div className="mt-3.5 space-y-2.5">
              {PERSONAS.map((p) => {
                const active = p.id === persona.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPersonaId(p.id)}
                    className={`w-full rounded-2xl border-2 p-3.5 text-left transition ${
                      active
                        ? "border-emerald-600 bg-emerald-50/80 shadow-xs"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase text-emerald-800">
                        {p.tipo_generador === "unidad_productiva" ? (
                          <Store className="h-3.5 w-3.5" />
                        ) : (
                          <Home className="h-3.5 w-3.5" />
                        )}
                        <span>{p.etiqueta}</span>
                      </span>
                      {active && (
                        <span className="rounded-full bg-emerald-700 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-base font-black text-stone-900">
                      {p.nombre}
                    </p>
                    <p className="text-xs font-semibold text-stone-600">
                      📱 {p.telefono} · 📍 {p.direccion}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Botones rápidos de Nota de Voz para probar con 1 toque */}
          <div className="eco-card p-5">
            <div className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-emerald-700" />
              <h2 className="text-base font-black text-stone-900">
                2. Notas de voz listas (Prueba en 1 toque)
              </h2>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              Si estás evaluando en un computador sin micrófono o quieres probar
              de inmediato, envía una nota de voz pregrabada de{" "}
              <strong>{persona.nombre}</strong>:
            </p>

            <div className="mt-3.5 space-y-2.5">
              <button
                type="button"
                disabled={sending}
                onClick={() => void handleQuickPresetAudio("organico")}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border-2 border-huerta-500 bg-huerta-50 px-4 py-3 text-left text-sm font-extrabold text-huerta-950 transition hover:bg-huerta-100 disabled:opacity-50"
              >
                <span className="flex items-center gap-2.5">
                  <Leaf className="h-5 w-5 shrink-0 text-huerta-700" />
                  <span>
                    🎙️ Enviar Audio Orgánico (Cáscaras y restos → Huerta)
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-huerta-700" />
              </button>

              <button
                type="button"
                disabled={sending}
                onClick={() => void handleQuickPresetAudio("reciclable")}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border-2 border-reciclaje-500 bg-reciclaje-50 px-4 py-3 text-left text-sm font-extrabold text-reciclaje-950 transition hover:bg-reciclaje-100 disabled:opacity-50"
              >
                <span className="flex items-center gap-2.5">
                  <Recycle className="h-5 w-5 shrink-0 text-reciclaje-700" />
                  <span>
                    🎙️ Enviar Audio Reciclable (Cartón, PET y latas →
                    Recicladores)
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-reciclaje-700" />
              </button>

              <button
                type="button"
                disabled={sending}
                onClick={() => void handleQuickPresetAudio("ambiguo")}
                className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-2.5 text-left text-xs font-extrabold text-amber-950 transition hover:bg-amber-100 disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>
                    🎙️ Enviar Audio Mezclado (Activa alerta de Revisión Humana
                    en /coordinacion)
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-amber-700" />
              </button>
            </div>
          </div>

          {/* 3. Tarjeta de Privacidad y Arquitectura IA */}
          <div className="rounded-2xl border-2 border-stone-200 bg-stone-50 p-4 text-xs text-stone-700 space-y-2">
            <div className="flex items-center gap-2 font-black text-stone-900">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              <span>Privacidad y Resiliencia Operativa (RN-01, RN-04, RN-07)</span>
            </div>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <strong>Privacidad por diseño:</strong> El backend sanitiza la
                transcripción y jamás envía el número de teléfono del vecino al
                modelo de lenguaje.
              </li>
              <li>
                <strong>OpenAI + Fallback determinístico:</strong> Usa{" "}
                <code>whisper-1</code> / <code>gpt-4o-mini</code> (Structured
                Outputs) cuando <code>OPENAI_API_KEY</code> está configurada, y
                cambia automáticamente al parser determinístico de palabras
                clave en demos locales sin llave.
              </li>
              <li>
                <strong>Control humano en /coordinacion:</strong> El coordinador
                ve la transcripción exacta y cuenta con el botón{" "}
                <em>“Mover a Recicladores / Mover a Huerteros”</em> para
                corregir cualquier clasificación errónea.
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Mobile WhatsApp Chat Simulator */}
        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-3xl border-2 border-stone-300 bg-[#efeae2] shadow-lg">
            {/* WhatsApp Top Bar */}
            <div className="flex items-center justify-between bg-[#075e54] px-4 py-3.5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-lg font-black text-white shadow-inner">
                  EC
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black">
                      EcoConecta – Villas de San Pablo
                    </h2>
                    <span className="rounded-full bg-emerald-400/25 px-2 py-0.5 text-[10px] font-extrabold text-emerald-100">
                      Cuenta Oficial
                    </span>
                  </div>
                  <p className="text-xs text-emerald-100">
                    Hablando como: <strong>{persona.nombre}</strong> (
                    {persona.telefono})
                  </p>
                </div>
              </div>
              <MessageCircle className="h-6 w-6 text-emerald-200" />
            </div>

            {/* Chat Messages Stream */}
            <div className="max-h-[540px] min-h-[380px] space-y-3.5 overflow-y-auto p-4">
              {messages.map((m) => {
                const isUser = m.sender === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-xs ${
                        isUser
                          ? "rounded-tr-none bg-[#d9fdd3] text-stone-900"
                          : "rounded-tl-none bg-white text-stone-900"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[11px] font-extrabold text-stone-500">
                        <span>
                          {isUser
                            ? `${persona.nombre} (${
                                m.kind === "audio"
                                  ? "🎙️ Nota de voz"
                                  : "💬 Texto"
                              })`
                            : "🤖 Bot EcoConecta WhatsApp"}
                        </span>
                        <span>{m.timestamp}</span>
                      </div>

                      {m.audioUrl && (
                        <div className="mt-2 rounded-xl bg-emerald-900/10 p-2">
                          <audio
                            controls
                            src={m.audioUrl}
                            className="h-9 w-full"
                          />
                        </div>
                      )}

                      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-stone-900">
                        {m.text}
                      </p>

                      {isUser && (
                        <div className="mt-1 flex justify-end">
                          <CheckCheck className="h-4 w-4 text-sky-600" />
                        </div>
                      )}

                      {/* Structured AI Extraction & Direct Link to /coordinacion */}
                      {m.response && (
                        <div className="mt-3 space-y-2.5 rounded-2xl border border-emerald-300 bg-emerald-50/80 p-3.5 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-sm font-black text-stone-900">
                              Código: {m.response.codigo_solicitud}
                            </span>
                            <FlujoBadge flujo={m.response.extraccion.flujo} />
                          </div>

                          <div className="grid gap-1.5 text-stone-700 sm:grid-cols-2">
                            <div>
                              <strong>Canal guardado:</strong>{" "}
                              {m.response.canal_origen === "whatsapp_audio"
                                ? "🎙️ Audio WhatsApp"
                                : "💬 Texto WhatsApp"}
                            </div>
                            <div>
                              <strong>Motor IA:</strong>{" "}
                              {m.response.modo_ia} (
                              {Math.round(m.response.extraccion.confianza_ia * 100)}
                              %)
                            </div>
                            <div className="sm:col-span-2">
                              <strong>Transcripción guardada en BD:</strong> “
                              {m.response.transcripcion}”
                            </div>
                            <div>
                              <strong>Dirección:</strong>{" "}
                              {m.response.direccion ||
                                m.response.extraccion.direccion ||
                                persona.direccion}
                            </div>
                            <div>
                              <strong>Atiende:</strong>{" "}
                              {m.response.coordinador_asignado}
                            </div>
                          </div>

                          {m.response.extraccion.requiere_revision_humana && (
                            <div className="flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1.5 font-bold text-amber-900">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span>
                                Marcado para revisión humana del coordinador en
                                /coordinacion.
                              </span>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <SpeakButton
                              text={m.response.respuesta_bot.replace(/\*/g, "")}
                              label="🔊 Escuchar respuesta"
                            />
                            <Link
                              href="/coordinacion"
                              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-stone-800"
                            >
                              <Bot className="h-4 w-4 text-sol-400" />
                              <span>
                                Ver en bandeja de /coordinacion (
                                {m.response.extraccion.flujo === "organico"
                                  ? "Huerteros"
                                  : "Recicladores"}
                                )
                              </span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {sending && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-extrabold text-stone-700 shadow-xs">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                    <span>
                      Transcribiendo audio, extrayendo flujo y guardando en
                      PostgreSQL...
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="mx-4 mb-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-900">
                {errorMsg}
              </div>
            )}

            {/* Recording / Recorded Voice Note Drawer */}
            {(isRecording || recordedBlob) && (
              <div className="mx-4 mb-3 rounded-2xl border-2 border-emerald-500 bg-white p-4 shadow-md">
                {isRecording ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="h-3.5 w-3.5 animate-ping rounded-full bg-rose-600" />
                        <span className="text-sm font-black text-rose-700">
                          🎙️ Grabando nota de voz en vivo... 00:
                          {String(recordSeconds).padStart(2, "0")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={stopMicrophoneRecording}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-rose-700"
                      >
                        <Square className="h-4 w-4" />
                        <span>Detener grabación</span>
                      </button>
                    </div>
                    <p className="text-xs text-stone-600">
                      Habla claro diciendo tu nombre, qué residuos tienes
                      (cáscaras/comida para la huerta o cartón/botellas para
                      reciclar) y a qué hora pueden pasar.
                    </p>
                    {liveSpeechTranscript && (
                      <p className="rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold italic text-emerald-950">
                        Detectado en micrófono: “{liveSpeechTranscript}”
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-black text-emerald-900">
                        🎙️ Nota de voz lista para enviar a WhatsApp EcoConecta
                      </span>
                      <button
                        type="button"
                        onClick={discardRecordedVoice}
                        className="text-xs font-extrabold text-rose-700 underline"
                      >
                        Descartar audio
                      </button>
                    </div>

                    {recordedAudioUrl && (
                      <audio
                        controls
                        src={recordedAudioUrl}
                        className="h-10 w-full"
                      />
                    )}

                    <div>
                      <label className="mb-1 block text-xs font-extrabold text-stone-700">
                        Contenido de tu nota de voz (detectado o editable para
                        modo demo sin API Key):
                      </label>
                      <textarea
                        rows={2}
                        value={voiceCaptionText}
                        onChange={(e) => setVoiceCaptionText(e.target.value)}
                        className="eco-input text-xs"
                        placeholder="Escribe o confirma lo que dijiste en la nota de voz..."
                      />
                    </div>

                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void handleSendRecordedVoiceNote()}
                      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-800"
                    >
                      <Send className="h-4 w-4" />
                      <span>
                        Enviar Nota de Voz (.webm) y Crear Solicitud
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Bottom WhatsApp Input Bar */}
            <div className="border-t border-stone-300 bg-[#f0f2f5] p-3">
              <form
                onSubmit={handleSendTextForm}
                className="flex flex-col gap-2.5 sm:flex-row sm:items-center"
              >
                <button
                  type="button"
                  disabled={sending || isRecording}
                  onClick={() => void startMicrophoneRecording()}
                  className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-xs transition hover:bg-emerald-800 disabled:opacity-50"
                >
                  <Mic className="h-5 w-5" />
                  <span>🎙️ Grabar Audio</span>
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="O escribe un mensaje de WhatsApp aquí (ej. Tengo cáscaras de plátano para la huerta mañana)..."
                  className="min-h-[48px] flex-1 rounded-2xl border border-stone-300 bg-white px-4 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={sending || !inputText.trim()}
                  className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-[#075e54] px-5 py-2.5 text-sm font-extrabold text-white shadow-xs transition hover:bg-[#064e46] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>Enviar</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
