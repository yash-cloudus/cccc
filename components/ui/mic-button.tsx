"use client";

import { useEffect, useRef } from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { useSpeechInput, type SpeechLang } from "@/hooks/use-speech-input";
import { cn } from "@/lib/utils";

/**
 * Dictation button for a text field.
 *
 * Renders nothing where the browser has no Web Speech API (Firefox) — a mic
 * that cannot listen is worse than no mic.
 *
 * Speech is appended to whatever is already in the field: interim results
 * replace each other against the value captured when recording started, so
 * the text updates live as the user speaks without duplicating itself.
 */
export function MicButton({
  value,
  onChange,
  lang,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  lang: SpeechLang;
  className?: string;
}) {
  const baseRef = useRef("");
  const valueRef = useRef(value);
  valueRef.current = value;

  const { listening, supported, error, start } = useSpeechInput({
    lang,
    onText: (transcript) => {
      const base = baseRef.current;
      onChange(base ? `${base.replace(/\s+$/, "")} ${transcript}` : transcript);
    },
  });

  useEffect(() => {
    if (!error) return;
    toast.error(
      error === "not-allowed" || error === "service-not-allowed"
        ? lang === "gu-IN"
          ? "માઈક્રોફોનની પરવાનગી આપો"
          : "Allow microphone access"
        : lang === "gu-IN"
          ? "અવાજ ઓળખાયો નહીં — ફરી પ્રયાસ કરો"
          : "Could not hear that — try again",
    );
  }, [error, lang]);

  if (!supported) return null;

  const label = lang === "gu-IN" ? "બોલીને લખો" : "Speak to type";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={listening}
      onMouseDown={(e) => e.preventDefault()} // keep the caret in the input
      onClick={() => {
        // Snapshot before listening so interim results overwrite cleanly.
        if (!listening) baseRef.current = valueRef.current;
        start();
      }}
      className={cn(
        "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition",
        listening
          ? "animate-pulse bg-[var(--danger)] text-white"
          : "text-[var(--faint)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]",
        className,
      )}
    >
      <Mic className="size-[18px]" strokeWidth={2} />
    </button>
  );
}
