"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

interface SpeakButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export default function SpeakButton({
  text,
  label = "Escuchar",
  className = "",
}: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const synth = window.speechSynthesis;

    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const spanishVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith("es-co")) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("es-419")) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("es-mx")) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("es"));

    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }
    utterance.lang = spanishVoice?.lang || "es-CO";
    utterance.rate = 0.96;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    synth.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={handleToggleSpeak}
      aria-label={speaking ? "Detener lectura en voz alta" : `${label} en voz alta`}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 px-3.5 py-2 text-sm font-extrabold transition ${
        speaking
          ? "border-sol-600 bg-sol-400 text-stone-950 shadow-sm"
          : "border-huerta-200 bg-huerta-50 text-huerta-800 hover:border-huerta-500 hover:bg-huerta-100"
      } ${className}`}
    >
      {speaking ? (
        <>
          <Square className="h-4 w-4 shrink-0 fill-current" />
          <span>⏹ Detener</span>
        </>
      ) : (
        <>
          <Volume2 className="h-4 w-4 shrink-0" />
          <span>🔊 {label}</span>
        </>
      )}
    </button>
  );
}
