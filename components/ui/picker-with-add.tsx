"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { GujaratiInput } from "@/components/ui/gujarati-keyboard";
import { useFlipUp } from "@/hooks/use-flip-up";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { cn } from "@/lib/utils";

export type PickerOption = { value: string; label: string };

export type NewEntry = { nameEn: string; nameGu: string };

/**
 * Select whose "add new" happens inside the open list, not in a field below it.
 *
 * The escape hatch used to drop a separate input underneath the closed select,
 * which read as a different question rather than part of the same choice. Here
 * the option list, the English/Gujarati pair and the Add button live in one
 * popup, so adding a village or an occupation never leaves the dropdown.
 *
 * The pair is deliberate: typing English transliterates into the Gujarati box
 * (same as every other bilingual field in the app), and both names are handed
 * back, so a value stored in English keeps its Gujarati label for everyone else.
 */
export function PickerWithAdd({
  value,
  onChange,
  options,
  placeholder,
  variant = "member",
  onAddNew,
  addLabel,
  syncKey = "picker",
  className,
  t = (_gu, en) => en,
}: {
  value: string;
  onChange: (v: string) => void;
  options: PickerOption[];
  placeholder?: string;
  /** `compact` is the small in-panel size — the month / year pickers in the calendar. */
  variant?: "member" | "admin" | "compact";
  /** Omit to hide the add-new row entirely. */
  onAddNew?: (entry: NewEntry) => void | Promise<void>;
  addLabel?: string;
  /** Keeps concurrent transliterations on one screen from cancelling each other. */
  syncKey?: string;
  className?: string;
  t?: (gu: string, en: string) => string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  // The add-new form roughly doubles the popup's height.
  const up = useFlipUp(open, wrapRef, adding ? 420 : 300);
  const [en, setEn] = useState("");
  const [gu, setGu] = useState("");
  const { fromEn, guInput } = useTranslitSync();

  const isAdmin = variant === "admin";
  const isCompact = variant === "compact";
  const selected = options.find((o) => o.value === value);
  const label = selected?.label || placeholder || t("પસંદ કરો", "Select");

  // Open on the current choice, not at the top: a year list is 120 rows long
  // and scrolling to 1971 by hand is not a picker.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: "center" });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function reset() {
    setEn("");
    setGu("");
    setAdding(false);
  }

  function commit() {
    const nameEn = en.trim() || gu.trim();
    const nameGu = gu.trim() || en.trim();
    if (!nameEn) return;
    void onAddNew?.({ nameEn, nameGu });
    reset();
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-2",
          isCompact
            ? "h-7 rounded-lg border border-[var(--line-field)] bg-[var(--field)] px-2 text-[12.5px] font-bold text-[var(--ink)]"
            : isAdmin
              ? "h-[42px] rounded-[11px] border-[1.5px] border-[var(--line-field)] bg-[var(--field)] px-3 text-[13.5px] text-[var(--ink)]"
              : "samaj-fld bg-[var(--field)]",
        )}
      >
        <span className={cn("truncate text-left", !selected && "text-[var(--faint-soft)]")}>
          {label}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--brand)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            // No overflow clipping here — the Gujarati keyboard panel opens
            // out of the add-new row and must not be cut off.
            "absolute inset-x-0 z-40 rounded-[13px] border bg-white shadow-lg",
            up ? "bottom-full mb-1" : "top-full mt-1",
            isCompact && "min-w-[7rem]",
            isAdmin ? "border-[var(--line-admin)]" : "border-[var(--line-field)]",
          )}
        >
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto overscroll-contain rounded-t-[13px]"
          >
            {options.map((o, i) => (
              <button
                key={o.value || `blank-${i}`}
                type="button"
                data-selected={value === o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setAdding(false);
                }}
                className={cn(
                  "block w-full text-left",
                  isCompact ? "px-2.5 py-1.5 text-[12.5px]" : "px-3 py-2.5 text-sm",
                  i > 0 && "border-t border-[var(--line-soft)]",
                  value === o.value && "bg-[var(--brand-tint)] font-bold text-[var(--brand)]",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          {onAddNew &&
            (adding ? (
              <div className="space-y-2 border-t border-[var(--line-soft)] p-2.5">
                <input
                  autoFocus
                  value={en}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEn(v);
                    fromEn(v, setGu, `${syncKey}:en`);
                  }}
                  placeholder={t("અંગ્રેજીમાં લખો…", "Type in English…")}
                  className="h-10 w-full rounded-[10px] border border-[var(--line-field)] bg-[var(--field)] px-2.5 text-[13px] outline-none"
                />
                <GujaratiInput
                  value={gu}
                  onChange={(v) => {
                    setGu(v);
                    guInput(v, setGu, `${syncKey}:gu`);
                  }}
                  placeholder={t("ગુજરાતીમાં…", "In Gujarati…")}
                  inputClassName="h-10 w-full rounded-[10px] border border-[var(--line-field)] bg-[var(--field)] px-2.5 text-[13px] font-[family-name:var(--font-manrope),var(--font-noto-sans-gujarati),sans-serif] outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={commit}
                    disabled={!en.trim() && !gu.trim()}
                    className="h-9 flex-1 cursor-pointer rounded-[10px] bg-[var(--brand)] text-[12.5px] font-bold text-white disabled:opacity-50"
                  >
                    {t("ઉમેરો", "Add")}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="h-9 cursor-pointer rounded-[10px] border border-[var(--line-field)] bg-white px-3 text-[12.5px] font-bold text-[var(--ink-dim)]"
                  >
                    {t("રદ", "Cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-b-[13px] border-t border-[var(--line-soft)] px-3 py-2.5 text-left text-sm font-bold text-[var(--brand)]"
              >
                <Plus className="size-4" strokeWidth={2.4} />
                {addLabel || t("નવું ઉમેરો", "Add new")}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
