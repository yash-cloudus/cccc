"use client";

/**
 * On-screen Gujarati keyboard.
 *
 * Complements the phonetic input (type "savaliya " → સાવલિયા): this is for
 * letters that are awkward to reach phonetically, and for anyone without a
 * Gujarati layout installed. Keys insert at the caret, never at the end.
 */

import { useEffect, useRef, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { MicButton } from "@/components/ui/mic-button";
import { cn } from "@/lib/utils";

const ROWS: { label: string; keys: string[] }[] = [
  {
    label: "સ્વર",
    keys: ["અ", "આ", "ઇ", "ઈ", "ઉ", "ઊ", "ઋ", "એ", "ઐ", "ઓ", "ઔ", "અં", "અઃ"],
  },
  {
    label: "માત્રા",
    keys: ["ા", "િ", "ી", "ુ", "ૂ", "ૃ", "ે", "ૈ", "ો", "ૌ", "ં", "ઃ", "્"],
  },
  {
    label: "વ્યંજન",
    keys: [
      "ક", "ખ", "ગ", "ઘ", "ઙ",
      "ચ", "છ", "જ", "ઝ", "ઞ",
      "ટ", "ઠ", "ડ", "ઢ", "ણ",
      "ત", "થ", "દ", "ધ", "ન",
      "પ", "ફ", "બ", "ભ", "મ",
      "ય", "ર", "લ", "વ", "શ",
      "ષ", "સ", "હ", "ળ", "ક્ષ", "જ્ઞ", "ત્ર",
    ],
  },
  { label: "અંક", keys: ["૦", "૧", "૨", "૩", "૪", "૫", "૬", "૭", "૮", "૯"] },
];

/** Insert `ch` over [start,end), returning the new text and caret position. */
export function insertAt(
  value: string,
  ch: string,
  start: number,
  end: number,
): { text: string; caret: number } {
  const s = Math.max(0, Math.min(start, value.length));
  const e = Math.max(s, Math.min(end, value.length));
  return { text: value.slice(0, s) + ch + value.slice(e), caret: s + ch.length };
}

/**
 * Backspace: delete the selection, or one character before a collapsed caret.
 * A collapsed caret at 0 has nothing to delete.
 */
export function deleteBackwards(
  value: string,
  start: number,
  end: number,
): { text: string; caret: number } {
  const s = Math.max(0, Math.min(start, value.length));
  const e = Math.max(s, Math.min(end, value.length));
  if (s === e && s === 0) return { text: value, caret: 0 };
  const from = s === e ? s - 1 : s;
  return { text: value.slice(0, from) + value.slice(e), caret: from };
}

/**
 * Text input with a Gujarati keyboard button at its trailing edge.
 * Drop-in for a plain text input — same `value` / `onChange` contract.
 */
export function GujaratiInput({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  inputClassName,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Caret is captured on every interaction so a key lands where the user was.
  const caret = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function rememberCaret() {
    const el = inputRef.current;
    if (!el) return;
    caret.current = {
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
  }

  /** Apply a pure edit, then restore focus and caret in the real input. */
  function applyEdit({ text, caret: pos }: { text: string; caret: number }) {
    onChange(text);
    caret.current = { start: pos, end: pos };
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  const insert = (ch: string) =>
    applyEdit(insertAt(value, ch, caret.current.start, caret.current.end));

  const backspace = () =>
    applyEdit(deleteBackwards(value, caret.current.start, caret.current.end));

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          rememberCaret();
          onChange(e.target.value);
        }}
        onBlur={onBlur}
        onKeyUp={rememberCaret}
        onClick={rememberCaret}
        onSelect={rememberCaret}
        className={cn("pr-[76px]", inputClassName)}
      />

      {/* Dictation sits beside the keyboard — same field, two ways to type. */}
      <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
        <MicButton value={value} onChange={onChange} lang="gu-IN" />
        <button
          type="button"
          aria-label="ગુજરાતી કીબોર્ડ"
          title="ગુજરાતી કીબોર્ડ"
          aria-expanded={open}
          onMouseDown={(e) => e.preventDefault()} // keep caret in the input
          onClick={() => {
            rememberCaret();
            setOpen((o) => !o);
          }}
          className={cn(
            "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition",
            open
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--faint)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]",
          )}
        >
          <Keyboard className="size-[18px]" strokeWidth={1.9} />
        </button>
      </div>

      {open && (
        <div
          className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 rounded-[14px] border border-[var(--line-admin)] bg-white p-3 shadow-[0_18px_40px_-18px_rgba(60,30,20,.45)]"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wide text-[var(--brand)] uppercase">
              ગુજરાતી કીબોર્ડ
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="બંધ કરો"
              className="flex size-6 cursor-pointer items-center justify-center rounded-md text-[var(--faint)] hover:bg-[var(--surface-admin)]"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="max-h-[46vh] overflow-y-auto pr-0.5">
            {ROWS.map((row) => (
              <div key={row.label} className="mb-2.5 last:mb-0">
                <div className="mb-1 text-[10.5px] font-bold text-[var(--faint)]">{row.label}</div>
                <div className="flex flex-wrap gap-1">
                  {row.keys.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => insert(k)}
                      className="min-w-[34px] cursor-pointer rounded-[9px] border border-[var(--line-admin)] bg-[var(--field)] px-2 py-1.5 font-[family-name:var(--font-noto-sans-gujarati)] text-[15px] leading-none text-[var(--ink)] hover:border-[var(--brand)] hover:bg-[var(--brand-tint)]"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2.5 flex gap-1.5 border-t border-[var(--line-soft)] pt-2.5">
            <button
              type="button"
              onClick={() => insert(" ")}
              className="flex-1 cursor-pointer rounded-[9px] border border-[var(--line-admin)] bg-[var(--field)] py-1.5 text-[12px] font-bold text-[var(--ink-dim)] hover:border-[var(--brand)]"
            >
              સ્પેસ
            </button>
            <button
              type="button"
              onClick={backspace}
              className="cursor-pointer rounded-[9px] border border-[var(--line-admin)] bg-[var(--field)] px-4 py-1.5 text-[12px] font-bold text-[var(--danger)] hover:border-[var(--danger)]"
            >
              ⌫
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
