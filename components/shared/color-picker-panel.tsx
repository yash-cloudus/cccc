"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pipette } from "lucide-react";
import { cn } from "@/lib/utils";
import { clamp, hexToHsv, hsvToHex, isValidHex, normalizeHex } from "@/lib/color-picker";

type ColorPickerPanelProps = {
  value: string;
  onChange: (hex: string) => void;
  /** Visual theme — platform (Main Admin) or admin (Community Admin). */
  variant?: "platform" | "admin";
  className?: string;
};

export function ColorPickerPanel({
  value,
  onChange,
  variant = "admin",
  className,
}: ColorPickerPanelProps) {
  const safe = normalizeHex(value) ?? "#A62A38";
  const [hsv, setHsv] = useState(() => hexToHsv(safe));
  const [hexDraft, setHexDraft] = useState(safe);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"sv" | "hue" | null>(null);

  useEffect(() => {
    const next = normalizeHex(value);
    if (!next) return;
    setHsv(hexToHsv(next));
    setHexDraft(next);
  }, [value]);

  const emit = useCallback(
    (h: number, s: number, v: number) => {
      const hex = hsvToHex(h, s, v);
      setHsv({ h, s, v });
      setHexDraft(hex);
      onChange(hex);
    },
    [onChange],
  );

  /** Saturation (x) × Value/brightness (y) — matches the white/black overlay gradient. */
  const pickFromSv = useCallback(
    (clientX: number, clientY: number) => {
      const el = svRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);
      emit(hsv.h, x * 100, (1 - y) * 100);
    },
    [emit, hsv.h],
  );

  const pickFromHue = useCallback(
    (clientX: number) => {
      const el = hueRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      emit(x * 360, hsv.s, hsv.v);
    },
    [emit, hsv.s, hsv.v],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (dragging.current === "sv") pickFromSv(e.clientX, e.clientY);
      if (dragging.current === "hue") pickFromHue(e.clientX);
    }
    function onUp() {
      dragging.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [pickFromHue, pickFromSv]);

  const hueColor = hsvToHex(hsv.h, 100, 100);
  const svX = hsv.s / 100;
  const svY = 1 - hsv.v / 100;
  const hueX = hsv.h / 360;

  const ring =
    variant === "platform"
      ? "focus-within:border-[var(--platform)] focus-within:ring-[var(--platform)]/20"
      : "focus-within:border-[var(--brand)] focus-within:ring-[var(--brand)]/20";

  return (
    <div className={cn("rounded-xl border border-[var(--line-input)] bg-white p-3 shadow-sm", className)}>
      <div
        ref={svRef}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        className="relative h-[120px] cursor-crosshair touch-none rounded-[10px] outline-none"
        style={{ background: hsvToHex(hsv.h, 100, 100) }}
        onPointerDown={(e) => {
          dragging.current = "sv";
          pickFromSv(e.clientX, e.clientY);
        }}
        onKeyDown={(e) => {
          let { h, s, v } = hsv;
          const step = e.shiftKey ? 10 : 2;
          if (e.key === "ArrowLeft") s = clamp(s - step, 0, 100);
          else if (e.key === "ArrowRight") s = clamp(s + step, 0, 100);
          else if (e.key === "ArrowUp") v = clamp(v + step, 0, 100);
          else if (e.key === "ArrowDown") v = clamp(v - step, 0, 100);
          else return;
          e.preventDefault();
          emit(h, s, v);
        }}
      >
        <div className="absolute inset-0 rounded-[10px] bg-gradient-to-r from-white to-transparent" />
        <div className="absolute inset-0 rounded-[10px] bg-gradient-to-t from-black to-transparent" />
        <span
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.25)]"
          style={{ left: `${svX * 100}%`, top: `${svY * 100}%`, background: safe }}
        />
      </div>

      <div
        ref={hueRef}
        role="slider"
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        tabIndex={0}
        className="relative mt-3 h-3.5 cursor-ew-resize touch-none rounded-full outline-none"
        style={{
          background:
            "linear-gradient(90deg,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)",
        }}
        onPointerDown={(e) => {
          dragging.current = "hue";
          pickFromHue(e.clientX);
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 15 : 5;
          if (e.key === "ArrowLeft") emit(hsv.h - step, hsv.s, hsv.v);
          else if (e.key === "ArrowRight") emit(hsv.h + step, hsv.s, hsv.v);
          else return;
          e.preventDefault();
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.2)]"
          style={{ left: `${hueX * 100}%`, background: hueColor }}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className="size-9 shrink-0 rounded-[10px] border border-black/10 shadow-inner"
          style={{ background: safe }}
          aria-hidden
        />
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center overflow-hidden rounded-[10px] border-[1.5px] border-[var(--line-input)] bg-[var(--field)] focus-within:ring-2",
            ring,
          )}
        >
          <span className="pl-2.5 text-[12px] font-bold text-[var(--faint)]">#</span>
          <input
            value={hexDraft.replace(/^#/, "")}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
              setHexDraft(`#${v}`);
              const normalized = normalizeHex(v);
              if (normalized) {
                setHsv(hexToHsv(normalized));
                onChange(normalized);
              }
            }}
            onBlur={() => {
              const normalized = normalizeHex(hexDraft);
              if (normalized) {
                setHexDraft(normalized);
                onChange(normalized);
              } else {
                setHexDraft(safe);
              }
            }}
            className="min-w-0 flex-1 border-none bg-transparent py-2 pr-2 font-mono text-[13px] font-semibold uppercase text-[var(--ink)] outline-none"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={6}
            aria-label="Hex color code"
          />
        </div>
        <label
          className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-[var(--line-input)] bg-white text-[var(--faint)] hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
          title="System color picker"
        >
          <Pipette className="size-4" strokeWidth={2} />
          <input
            type="color"
            value={safe}
            onChange={(e) => {
              const next = normalizeHex(e.target.value);
              if (next) {
                setHsv(hexToHsv(next));
                setHexDraft(next);
                onChange(next);
              }
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Open system color picker"
          />
        </label>
      </div>

      {!isValidHex(hexDraft) && hexDraft.length > 1 && (
        <p className="mt-2 text-[11px] font-semibold text-[var(--danger)]">Enter a valid 6-digit hex code</p>
      )}
    </div>
  );
}
