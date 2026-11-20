"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface BackButtonProps {
  href?: string;
  onClick?: () => void;
  label?: string;
}

export default function BackButton({
  href = "/",
  onClick,
  label = "Volver",
}: BackButtonProps) {
  const classes =
    "inline-flex min-h-[48px] items-center gap-2 rounded-xl border-2 border-stone-300 bg-white px-4 py-2.5 text-base font-extrabold text-stone-800 shadow-sm transition hover:border-huerta-600 hover:bg-huerta-50 hover:text-huerta-800 active:scale-[0.99]";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        <ArrowLeft className="h-5 w-5 shrink-0" />
        <span>← {label}</span>
      </button>
    );
  }

  return (
    <Link href={href} className={classes}>
      <ArrowLeft className="h-5 w-5 shrink-0" />
      <span>← {label}</span>
    </Link>
  );
}
