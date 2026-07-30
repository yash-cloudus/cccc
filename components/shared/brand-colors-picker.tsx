"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PRIMARY_COLORS, SECONDARY_COLORS } from "@/lib/constants";
import { normalizeHex } from "@/lib/color-picker";
import { cn } from "@/lib/utils";
import { ColorPickerPanel } from "./color-picker-panel";

type BrandColorsPickerProps = {
  primary: string;
  secondary: string;
  onPrimaryChange: (hex: string) => void;
  onSecondaryChange: (hex: string) => void;
  primaryPresets?: readonly string[];
  secondaryPresets?: readonly string[];
  variant?: "platform" | "admin";
  /** Show a compact live preview strip (buttons + accents). */
  showPreview?: boolean;
  className?: string;
};

function SwatchRow({
  label,
  value,
  presets,
  onChange,
  variant,
  expanded,
  onToggleExpand,
  inputId,
}: {
  label: string;
  value: string;
  presets: readonly string[];
  onChange: (hex: string) => void;
  variant: "platform" | "admin";
  expanded: boolean;
  onToggleExpand: () => void;
  inputId: string;
}) {
  const safe = normalizeHex(value) ?? presets[0] ?? "#A62A38";
  const selectedRing =
    variant === "platform"
      ? "border-[#22252B] shadow-[0_0_0_2px_#fff_inset]"
      : "border-[var(--brand)] shadow-[0_0_0_2px_#fff_inset]";

  const labelClass =
    variant === "platform"
      ? "text-xs font-bold text-[var(--platform-muted)]"
      : "text-[12.5px] font-bold text-[var(--ink-mid)]";

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className={labelClass}>{label}</div>
        <button
          type="button"
          onClick={onToggleExpand}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors",
            variant === "platform"
              ? "border-[var(--line-input)] text-[var(--platform-muted)] hover:border-[var(--platform)]/40 hover:text-[var(--platform)]"
              : "border-[var(--line-admin)] text-[var(--faint)] hover:border-[var(--brand-border)] hover:text-[var(--brand)]",
          )}
          aria-expanded={expanded}
          aria-controls={inputId}
        >
          Custom
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      </div>

      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {presets.map((c) => {
          const active = safe.toUpperCase() === c.toUpperCase();
          return (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`${label} ${c}`}
              aria-pressed={active}
              onClick={() => onChange(c)}
              className={cn(
                "size-8 cursor-pointer rounded-[9px] border-[3px] transition-transform hover:scale-105 active:scale-95",
                active ? selectedRing : "border-black/8",
              )}
              style={{ background: c }}
            />
          );
        })}
        {/* Custom swatch when color is not in presets */}
        {!presets.some((c) => c.toUpperCase() === safe.toUpperCase()) && (
          <button
            type="button"
            title={safe}
            aria-label={`${label} custom ${safe}`}
            aria-pressed
            onClick={onToggleExpand}
            className={cn("size-8 cursor-pointer rounded-[9px] border-[3px]", selectedRing)}
            style={{ background: safe }}
          />
        )}
      </div>

      {expanded && (
        <div id={inputId}>
          <ColorPickerPanel value={safe} onChange={onChange} variant={variant} />
        </div>
      )}
    </div>
  );
}

export function BrandColorsPicker({
  primary,
  secondary,
  onPrimaryChange,
  onSecondaryChange,
  primaryPresets = PRIMARY_COLORS,
  secondaryPresets = SECONDARY_COLORS,
  variant = "admin",
  showPreview = true,
  className,
}: BrandColorsPickerProps) {
  const baseId = useId();
  const [expandPrimary, setExpandPrimary] = useState(false);
  const [expandSecondary, setExpandSecondary] = useState(false);

  const p = normalizeHex(primary) ?? primaryPresets[0];
  const s = normalizeHex(secondary) ?? secondaryPresets[0];

  const helpText =
    variant === "platform"
      ? "These colors theme the member app, community admin panel, and login screens."
      : "Updates the member app and this admin panel. Save to apply everywhere.";

  const helpClass =
    variant === "platform"
      ? "text-[12px] font-medium text-[var(--platform-muted)]"
      : "text-[12px] text-[var(--faint)]";

  return (
    <div className={className}>
      <p className={cn("mb-3 leading-relaxed", helpClass)}>{helpText}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3.5">
        <SwatchRow
          label="Primary"
          value={p}
          presets={primaryPresets}
          onChange={onPrimaryChange}
          variant={variant}
          expanded={expandPrimary}
          onToggleExpand={() => setExpandPrimary((v) => !v)}
          inputId={`${baseId}-primary-picker`}
        />
        <SwatchRow
          label="Secondary (gold / accent)"
          value={s}
          presets={secondaryPresets}
          onChange={onSecondaryChange}
          variant={variant}
          expanded={expandSecondary}
          onToggleExpand={() => setExpandSecondary((v) => !v)}
          inputId={`${baseId}-secondary-picker`}
        />
      </div>

      {showPreview && (
        <div
          className={cn(
            "mt-4 overflow-hidden rounded-xl border",
            variant === "platform" ? "border-[var(--line-input)]" : "border-[var(--line-admin)]",
          )}
        >
          <div
            className="flex items-center gap-3 px-3.5 py-3"
            style={{
              background: `linear-gradient(135deg, ${p} 0%, ${s} 100%)`,
            }}
          >
            <span className="flex size-10 items-center justify-center rounded-xl border-2 bg-white/15 text-sm font-extrabold text-white backdrop-blur-sm">
              A
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-extrabold text-white">Brand preview</div>
              <div className="text-[11px] font-semibold text-white/80">Buttons, headers & accents</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 bg-white px-3.5 py-3">
            <span
              className="inline-flex h-9 flex-1 min-w-[100px] items-center justify-center rounded-lg text-[12px] font-extrabold text-white"
              style={{ background: p }}
            >
              Primary button
            </span>
            <span
              className="inline-flex h-9 flex-1 min-w-[100px] items-center justify-center rounded-lg border-[1.5px] bg-white text-[12px] font-extrabold"
              style={{ borderColor: p, color: p }}
            >
              Outline
            </span>
            <span
              className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-[12px] font-extrabold text-[#2A2620]"
              style={{ background: s }}
            >
              Accent
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
