"use client";

import { Mic } from "lucide-react";
import { MicButton } from "@/components/ui/mic-button";
import type { SpeechLang } from "@/hooks/use-speech-input";
import { cn } from "@/lib/utils";

/**
 * Plain text input with a dictation button — the English-side counterpart of
 * `GujaratiInput` (which carries its own mic next to the Gujarati keyboard).
 *
 * Drop-in for `<input>`: same `value` / `onChange` contract, so a field gains
 * voice input by swapping the tag and nothing else.
 */
export function SpeechInput({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  inputClassName,
  lang = "en-IN",
  inputMode,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  lang?: SpeechLang;
  inputMode?: "text" | "numeric" | "tel" | "email";
  autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        inputMode={inputMode}
        autoFocus={autoFocus}
        className={cn("pr-11", inputClassName)}
      />
      <MicButton
        value={value}
        onChange={onChange}
        lang={lang}
        className="absolute top-1/2 right-1.5 -translate-y-1/2"
      />
    </div>
  );
}

/** Multi-line variant for description / body fields. */
export function SpeechTextarea({
  value,
  onChange,
  placeholder,
  className,
  textareaClassName,
  lang = "en-IN",
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
  lang?: SpeechLang;
  rows?: number;
}) {
  return (
    <div className={cn("relative", className)}>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={cn("pr-11", textareaClassName)}
      />
      <MicButton
        value={value}
        onChange={onChange}
        lang={lang}
        className="absolute top-2 right-1.5"
      />
    </div>
  );
}

/** Re-exported so callers can show the same icon in their own chrome. */
export { Mic as MicIcon };
