"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { PickerWithAdd } from "@/components/ui/picker-with-add";
import { useFlipUp } from "@/hooks/use-flip-up";
import { formatDateDMY, outOfDateRange, parseISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The one date picker for the whole app — member screens and admin alike.
 *
 * `<input type="date">` was used everywhere before, and it renders in the
 * *browser's* locale: an en-US Windows shows 02/12/1989, which a Gujarati
 * member reads as 2 December. Same string, two different dates, no way to
 * override it — hence a real picker. It always shows dd/MM/yyyy, and it always
 * hands back / takes ISO `yyyy-MM-dd`, the shape every form state and API in
 * this app already uses, so call sites only swap the tag.
 *
 * Month and year are dropdowns, not just arrows: a birth date in 1962 is three
 * clicks away instead of eight hundred.
 */

/** ISO `yyyy-MM-dd` — what every date column and API in the app stores. */
const ISO = "yyyy-MM-dd";

export function todayISO() {
  return format(new Date(), ISO);
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
// Short names: on a 320px phone the header holds two arrows, a month and a year.
const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), "MMM"));

export function DateField({
  value,
  onChange,
  variant = "member",
  min,
  max,
  dob,
  placeholder,
  className,
  t = (_gu, en) => en,
}: {
  /** ISO `yyyy-MM-dd`, or "" for empty. */
  value: string;
  onChange: (v: string) => void;
  variant?: "member" | "admin";
  /** ISO bounds — days outside them cannot be picked. */
  min?: string;
  max?: string;
  /** Birth date: nothing after today can be picked, and the view opens on today. */
  dob?: boolean;
  placeholder?: string;
  className?: string;
  t?: (gu: string, en: string) => string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const up = useFlipUp(open, wrapRef, 370);

  const isAdmin = variant === "admin";
  const selected = parseISODate(value);
  // A birth date can never be in the future.
  const upper = dob ? todayISO() : max;
  const lo = parseISODate(min);
  const hi = parseISODate(upper);

  const [view, setView] = useState(() => startOfMonth(selected ?? hi ?? new Date()));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(view)),
        end: endOfWeek(endOfMonth(view)),
      }),
    [view],
  );

  const years = useMemo(() => {
    const first = lo ? lo.getFullYear() : 1900;
    const last = hi ? hi.getFullYear() : new Date().getFullYear() + 10;
    const list = Array.from({ length: Math.max(1, last - first + 1) }, (_, i) => first + i);
    // An already-saved date can sit outside the bounds; without its year in the
    // list the select renders blank.
    const y = view.getFullYear();
    return list.includes(y) ? list : [...list, y].sort((a, b) => a - b);
  }, [lo, hi, view]);

  const blocked = (d: Date) => outOfDateRange(d, min, upper);
  // Midnight, not "now" — against a max of today, `now` reads as out of range.
  const today = startOfDay(new Date());

  function toggle() {
    // Reopening lands on the month being edited, not wherever it was left.
    if (!open) setView(startOfMonth(selected ?? hi ?? new Date()));
    setOpen(!open);
  }

  function pick(d: Date) {
    onChange(format(d, ISO));
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-2",
          isAdmin
            ? "h-[42px] rounded-[11px] border-[1.5px] border-[var(--line-field)] bg-[var(--field)] px-3 text-[13.5px] text-[var(--ink)]"
            : "samaj-fld bg-[var(--field)]",
        )}
      >
        <span className={cn("truncate text-left", !selected && "text-[var(--faint-soft)]")}>
          {selected ? formatDateDMY(selected) : placeholder || "dd/mm/yyyy"}
        </span>
        <CalendarDays className="size-4 shrink-0 text-[var(--brand)]" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-40 w-[286px] max-w-[calc(100vw-2rem)] rounded-[13px] border bg-white p-2.5 shadow-lg",
            up ? "bottom-full mb-1" : "top-full mt-1",
            isAdmin ? "border-[var(--line-admin)]" : "border-[var(--line-field)]",
          )}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setView(addMonths(view, -1))}
              className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg border border-[var(--line-field)] text-[var(--ink-dim)]"
            >
              <ChevronLeft className="size-4" />
            </button>

            <PickerWithAdd
              variant="compact"
              className="min-w-0 flex-1"
              value={String(view.getMonth())}
              onChange={(v) => setView(new Date(view.getFullYear(), Number(v), 1))}
              options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
            />

            <PickerWithAdd
              variant="compact"
              className="w-[74px] shrink-0"
              value={String(view.getFullYear())}
              onChange={(v) => setView(new Date(Number(v), view.getMonth(), 1))}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />

            <button
              type="button"
              aria-label="Next month"
              onClick={() => setView(addMonths(view, 1))}
              className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg border border-[var(--line-field)] text-[var(--ink-dim)]"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[10.5px] font-bold text-[var(--faint)]">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const off = !isSameMonth(d, view);
              const no = blocked(d);
              const on = selected && isSameDay(d, selected);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={no}
                  onClick={() => pick(d)}
                  className={cn(
                    "h-9 rounded-lg text-[12.5px] font-semibold",
                    no
                      ? "cursor-not-allowed text-[var(--faint-soft)] opacity-40"
                      : "cursor-pointer hover:bg-[var(--brand-tint)]",
                    off && !no && "text-[var(--faint)]",
                    !off && !no && "text-[var(--ink)]",
                    !on && isSameDay(d, today) && "ring-1 ring-[var(--brand)] ring-inset",
                    on && "bg-[var(--brand)] text-white hover:bg-[var(--brand)]",
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 flex items-center justify-between border-t border-[var(--line-soft)] pt-1.5">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="cursor-pointer px-1 text-[12px] font-bold text-[var(--ink-dim)]"
            >
              {t("સાફ કરો", "Clear")}
            </button>
            {!blocked(today) && (
              <button
                type="button"
                onClick={() => pick(today)}
                className="cursor-pointer px-1 text-[12px] font-bold text-[var(--brand)]"
              >
                {t("આજે", "Today")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
