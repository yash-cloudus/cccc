"use client";

import { useState } from "react";
import { Search, ChevronDown, Check, Info, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { GujaratiInput } from "@/components/ui/gujarati-keyboard";
import { SpeechInput } from "@/components/ui/speech-input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAdminT } from "@/lib/i18n/admin-dictionary";
import { cn } from "@/lib/utils";
import { Select as SelectPrimitive } from "@base-ui/react/select";

/** Small icon+label action chip — action columns felt too bare as plain text links. */
export function ActionBtn({
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger" | "warn" | "success";
}) {
  const toneClass = {
    default: "border-[var(--line-admin)] text-[var(--ink-mid)] hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]",
    danger: "border-[var(--danger-tint)] text-[var(--danger)] hover:bg-[var(--danger-tint)]",
    warn: "border-[var(--gold-tint)] text-[var(--warn)] hover:bg-[var(--gold-tint)]",
    success: "border-[var(--success-tint)] text-[var(--success)] hover:bg-[var(--success-tint)]",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-2.5 py-[5px] text-[11.5px] font-bold whitespace-nowrap transition-colors",
        toneClass,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.3} />
      {label}
    </button>
  );
}

/**
 * The (i) affordance that carries a screen's explanatory note.
 *
 * These notes used to sit as grey paragraphs above or below the content, which
 * pushed the real work down the page and got skipped anyway. Tucking them
 * behind the title keeps them one gesture away — hover on desktop, tap on
 * touch (the trigger toggles the controlled state, since a tooltip alone never
 * opens on touch).
 */
export function AdminInfoTip({
  children,
  label,
  side = "bottom",
  className,
}: {
  children: React.ReactNode;
  label?: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const { t } = useAdminT();
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label ?? t("ui.moreInfo")}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--faint)] transition-colors hover:text-[var(--brand)] focus-visible:text-[var(--brand)] focus-visible:outline-none",
              className,
            )}
          />
        }
      >
        <Info className="size-[15px]" strokeWidth={2.1} />
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-[360px] text-[11.5px] leading-relaxed font-medium"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

export function AdminH2({
  children,
  className,
  info,
}: {
  children: React.ReactNode;
  className?: string;
  /** Explanatory note, shown behind an (i) button beside the heading. */
  info?: React.ReactNode;
}) {
  if (!info) {
    return (
      <h2 className={cn("mb-5 text-[22px] font-extrabold text-[var(--ink)]", className)}>
        {children}
      </h2>
    );
  }
  return (
    <div className={cn("mb-5 flex items-center gap-2", className)}>
      <h2 className="text-[22px] font-extrabold text-[var(--ink)]">{children}</h2>
      <AdminInfoTip>{info}</AdminInfoTip>
    </div>
  );
}

export function AdminH3({
  children,
  className,
  info,
}: {
  children: React.ReactNode;
  className?: string;
  info?: React.ReactNode;
}) {
  if (!info) {
    return (
      <h3 className={cn("mb-[11px] text-sm font-extrabold text-[var(--ink)]", className)}>
        {children}
      </h3>
    );
  }
  return (
    <div className={cn("mb-[11px] flex items-center gap-1.5", className)}>
      <h3 className="text-sm font-extrabold text-[var(--ink)]">{children}</h3>
      <AdminInfoTip>{info}</AdminInfoTip>
    </div>
  );
}

export function AdminHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mt-3.5 text-[11.5px] leading-relaxed text-[var(--faint)]", className)}>
      {children}
    </p>
  );
}

/**
 * Framed data table — one bordered, rounded surface with a tinted header.
 * Every admin table renders through this, so table chrome is changed here once.
 * `bordered={false}` for tables already sitting inside a bordered card.
 */
export function AdminTable({
  children,
  className,
  bordered = true,
}: {
  children: React.ReactNode;
  className?: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto",
        bordered && "rounded-[14px] border border-[var(--line-admin)] bg-white",
        className,
      )}
    >
      <table className="admin-table w-full border-collapse">{children}</table>
    </div>
  );
}

export function AdminTh({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-[var(--line-admin)] bg-[var(--surface-admin)] px-3 py-3 text-left text-[11.5px] font-extrabold tracking-wide text-[var(--ink-mid)] uppercase",
        className
      )}
    >
      {children}
    </th>
  );
}

export function AdminTd({
  children,
  className,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-b border-[var(--line-soft)] px-3 py-[11px] text-[13px] font-medium text-[var(--ink-soft)]",
        className
      )}
    >
      {children}
    </td>
  );
}

export function AdminStat({
  children,
  highlight,
  className,
}: {
  children: React.ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-[#EAE4D8] bg-[#FBFAF7] p-4",
        highlight && "border-[var(--brand-line)] bg-[var(--brand-tint)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminStatLabel({ children }: { children: React.ReactNode }) {
  return <div className="mt-0.5 text-[11.5px] text-[var(--faint)]">{children}</div>;
}

export function AdminBtn({
  children,
  onClick,
  variant = "primary",
  className,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "success" | "danger";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles = {
    primary: "bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] text-white",
    ghost: "border-[1.5px] border-[var(--line-input)] bg-white text-[var(--ink-mid)]",
    success: "bg-gradient-to-br from-[var(--wa)] to-[var(--wa-dark)] text-white",
    danger: "bg-gradient-to-br from-[var(--danger)] to-[#8A1F28] text-white",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-[18px] py-[11px] text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-60",
        styles[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function PillActive({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 inline-block rounded-full bg-[var(--success-tint)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--success)]">
      {children}
    </span>
  );
}

export function PillWarning({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 inline-block rounded-full bg-[var(--ochre-tint)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--warn)]">
      {children}
    </span>
  );
}

export function PillExpired({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-[var(--danger-tint)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--danger)]">
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: "pending" | "approved" | "rejected" }) {
  const { t } = useAdminT();
  const styles = {
    pending: "bg-[var(--ochre-tint)] text-[var(--warn)]",
    approved: "bg-[var(--success-tint)] text-[var(--success)]",
    rejected: "bg-[var(--danger-tint)] text-[var(--danger)]",
  };
  const labels = {
    pending: t("ui.statusPending"),
    approved: t("ui.statusApproved"),
    rejected: t("ui.statusRejected"),
  };
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold", styles[status])}>
      {labels[status]}
    </span>
  );
}

export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-2xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
        active
          ? "bg-[var(--brand)] font-bold text-white"
          : "border border-[var(--line-admin)] bg-white text-[var(--ink-dim)]"
      )}
    >
      {label}
    </button>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-[42px] items-center gap-2.5 rounded-xl border-[1.5px] border-[var(--line-admin)] bg-[var(--field)] px-3.5",
        className
      )}
    >
      <Search className="size-[17px] shrink-0 text-[var(--brand)]" strokeWidth={2.1} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-[var(--ink)] outline-none"
      />
    </div>
  );
}

/** Circular trigger for the mobile "more filters" sheet — sits next to SearchInput, same 42px height. */
export function FilterButton({
  onClick,
  active,
  className,
}: {
  onClick: () => void;
  /** Shows a dot badge when a non-default filter is applied. */
  active?: boolean;
  className?: string;
}) {
  const { t } = useAdminT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("ui.filters")}
      className={cn(
        "relative flex size-[42px] shrink-0 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-[var(--line-admin)] bg-[var(--field)] text-[var(--brand)] transition-colors hover:border-[var(--brand)] hover:bg-white",
        className,
      )}
    >
      <SlidersHorizontal className="size-[17px]" strokeWidth={2.1} />
      {active && (
        <span className="absolute top-[3px] right-[3px] size-[7px] rounded-full bg-[var(--brand)]" />
      )}
    </button>
  );
}

export function QStat({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <div className="rounded-[10px] border border-[#EAE4D8] bg-[#FBFAF7] px-3 py-[7px] text-xs text-[var(--ink-dim)]">
      <b style={{ color }}>{count}</b> {label}
    </div>
  );
}

export function LinkAction({
  children,
  onClick,
  danger,
  tone,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  /** Extra colour options beyond the default blue / danger red. */
  tone?: "warn" | "success";
  className?: string;
}) {
  const toneClass = danger
    ? "text-[var(--danger)]"
    : tone === "warn"
      ? "text-[var(--warn)]"
      : tone === "success"
        ? "text-[var(--success)]"
        : "text-[#3D7BC4]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("cursor-pointer text-xs font-bold underline", toneClass, className)}
    >
      {children}
    </button>
  );
}

export function AdminLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[11.5px] font-bold text-[var(--muted)]">{children}</div>;
}

const ADMIN_INPUT_CLASS =
  "h-[42px] w-full rounded-[11px] border-[1.5px] border-[var(--line-field)] bg-[var(--field)] px-3 text-[13.5px] text-[var(--ink)] outline-none";

/** Hides the native up/down spinner buttons on `type="number"` inputs. */
const NO_SPINNER_CLASS =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none";

export function AdminInput({
  value,
  onChange,
  type = "text",
  className,
  placeholder,
  gujarati,
  speech,
  onBlur,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
  /** Adds the on-screen Gujarati keyboard button (and its mic) at the trailing edge. */
  gujarati?: boolean;
  /** Adds an English dictation mic — ignored when `gujarati` already brings one. */
  speech?: boolean;
  onBlur?: () => void;
  /** Minimum value for `type="number"` inputs. */
  min?: number | string;
}) {
  if (gujarati) {
    return (
      <GujaratiInput
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        inputClassName={cn(
          ADMIN_INPUT_CLASS,
          "font-[family-name:var(--font-noto-sans-gujarati)]",
          className,
        )}
      />
    );
  }
  if (speech) {
    return (
      <SpeechInput
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        inputClassName={cn(ADMIN_INPUT_CLASS, className)}
      />
    );
  }
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      min={min}
      className={cn(ADMIN_INPUT_CLASS, type === "number" && NO_SPINNER_CLASS, className)}
    />
  );
}

/** Pill switch — Design-Spec §11 "Toggle switch: green when on". */
export function AdminToggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-[26px] w-[46px] shrink-0 cursor-pointer rounded-2xl transition-colors",
        on ? "bg-[var(--wa)]" : "bg-[var(--scroll-thumb)]",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left]",
          on ? "left-[23px]" : "left-[3px]",
        )}
      />
    </button>
  );
}

/** Custom styled dropdown — replaces the native select for a polished admin UI. */
export function AdminSelect({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  /** `dot` marks an option with a small live/status indicator in the open list (e.g. the currently open drive). */
  options: { value: string; label: string; dot?: boolean }[];
  className?: string;
  ariaLabel?: string;
}) {
  const selected = options.find((o) => o.value === value);

  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          // Match AdminInput exactly: h-[42px], same border, radius, bg, font
          "flex h-[42px] w-full cursor-pointer items-center justify-between gap-2 rounded-[11px] border-[1.5px] border-[var(--line-field)] bg-[var(--field)] px-3 text-[13.5px] text-[var(--ink)] outline-none",
          "transition-colors hover:border-[var(--line-strong)] hover:bg-white",
          "focus-visible:border-[var(--brand)] focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--brand-rgb)/0.12)]",
          "data-[popup-open]:border-[var(--brand)] data-[popup-open]:bg-white",
          "select-none",
          className,
        )}
      >
        <SelectPrimitive.Value
          placeholder="—"
          className={cn("flex-1 truncate text-left", selected && "font-semibold")}
        >
          {selected?.label ?? "—"}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon render={<span />}>
          <ChevronDown
            className="size-[15px] shrink-0 text-[var(--faint)] transition-transform duration-200 [[data-popup-open]_&]:rotate-180"
            strokeWidth={2.2}
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          sideOffset={4}
          alignItemWithTrigger={false}
          className="isolate z-[9999]"
        >
          <SelectPrimitive.Popup
            className={cn(
              // Sizing — match trigger width, cap height so it scrolls
              "max-h-[240px] w-(--anchor-width) min-w-[120px] overflow-y-auto",
              // Surface
              "rounded-[13px] border border-[var(--line-admin)] bg-white shadow-[0_8px_24px_-4px_rgba(42,35,32,0.14)]",
              // Animations
              "origin-(--transform-origin)",
              "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
              "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
              "transition-[opacity,transform] duration-150 ease-out",
            )}
          >
            <SelectPrimitive.ScrollUpArrow className="sticky top-0 z-10 flex w-full cursor-default justify-center bg-white/90 py-1 text-[var(--faint)]">
              <ChevronDown className="size-3.5 rotate-180" strokeWidth={2.5} />
            </SelectPrimitive.ScrollUpArrow>

            <SelectPrimitive.List className="p-1">
              {options.map((o) => (
                <SelectPrimitive.Item
                  key={o.value}
                  value={o.value}
                  className={cn(
                    "group relative flex cursor-pointer select-none items-center gap-2 rounded-[9px] py-[7px] pr-8 pl-2.5",
                    "text-[13px] font-medium text-[var(--ink)]",
                    "outline-none",
                    "transition-colors",
                    "hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]",
                    "data-[highlighted]:bg-[var(--brand-tint)] data-[highlighted]:text-[var(--brand)]",
                    "data-[selected]:bg-[var(--brand-tint)] data-[selected]:font-semibold data-[selected]:text-[var(--brand)]",
                  )}
                >
                  <SelectPrimitive.ItemText className="flex-1 truncate">
                    {o.label}
                  </SelectPrimitive.ItemText>
                  {o.dot && (
                    <span
                      className="inline-block size-[7px] shrink-0 rounded-full bg-[var(--success)]"
                      title="Live"
                    />
                  )}
                  <SelectPrimitive.ItemIndicator
                    render={
                      <span className="pointer-events-none absolute right-2.5 flex size-4 items-center justify-center opacity-0 group-data-[selected]:opacity-100" />
                    }
                  >
                    <Check className="size-[13px] text-[var(--brand)]" strokeWidth={2.8} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>

            <SelectPrimitive.ScrollDownArrow className="sticky bottom-0 z-10 flex w-full cursor-default justify-center bg-white/90 py-1 text-[var(--faint)]">
              <ChevronDown className="size-3.5" strokeWidth={2.5} />
            </SelectPrimitive.ScrollDownArrow>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/** Same dropdown as `AdminSelect`, but each option carries a colour swatch —
 * used for the album Accent colour picker so users can see the colour, not
 * just its name, both on the trigger and in the option list. */
export function AdminColorSelect({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  /** `value` doubles as the swatch colour (accent colours are stored as hex). */
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel?: string;
}) {
  const selected = options.find((o) => o.value === value);

  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-[42px] w-full cursor-pointer items-center justify-between gap-2 rounded-[11px] border-[1.5px] border-[var(--line-field)] bg-[var(--field)] px-3 text-[13.5px] text-[var(--ink)] outline-none",
          "transition-colors hover:border-[var(--line-strong)] hover:bg-white",
          "focus-visible:border-[var(--brand)] focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--brand-rgb)/0.12)]",
          "data-[popup-open]:border-[var(--brand)] data-[popup-open]:bg-white",
          "select-none",
          className,
        )}
      >
        <span className="flex flex-1 items-center gap-2 truncate text-left">
          <span
            className="size-[15px] shrink-0 rounded-full border border-black/10"
            style={{ background: selected?.value }}
          />
          <SelectPrimitive.Value placeholder="—" className="flex-1 truncate text-left">
            {selected?.label ?? "—"}
          </SelectPrimitive.Value>
        </span>
        <SelectPrimitive.Icon render={<span />}>
          <ChevronDown
            className="size-[15px] shrink-0 text-[var(--faint)] transition-transform duration-200 [[data-popup-open]_&]:rotate-180"
            strokeWidth={2.2}
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={4} alignItemWithTrigger={false} className="isolate z-[9999]">
          <SelectPrimitive.Popup
            className={cn(
              "max-h-[240px] w-(--anchor-width) min-w-[120px] overflow-y-auto",
              "rounded-[13px] border border-[var(--line-admin)] bg-white shadow-[0_8px_24px_-4px_rgba(42,35,32,0.14)]",
              "origin-(--transform-origin)",
              "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
              "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
              "transition-[opacity,transform] duration-150 ease-out",
            )}
          >
            <SelectPrimitive.List className="p-1">
              {options.map((o) => (
                <SelectPrimitive.Item
                  key={o.value}
                  value={o.value}
                  className={cn(
                    "group relative flex cursor-pointer select-none items-center gap-2 rounded-[9px] py-[7px] pr-8 pl-2.5",
                    "text-[13px] font-medium text-[var(--ink)]",
                    "outline-none",
                    "transition-colors",
                    "hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]",
                    "data-[highlighted]:bg-[var(--brand-tint)] data-[highlighted]:text-[var(--brand)]",
                    "data-[selected]:font-semibold data-[selected]:text-[var(--brand)]",
                  )}
                >
                  <span
                    className="size-[14px] shrink-0 rounded-full border border-black/10"
                    style={{ background: o.value }}
                  />
                  <SelectPrimitive.ItemText className="flex-1 truncate">{o.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator
                    render={
                      <span className="pointer-events-none absolute right-2.5 flex size-4 items-center justify-center opacity-0 group-data-[selected]:opacity-100" />
                    }
                  >
                    <Check className="size-[13px] text-[var(--brand)]" strokeWidth={2.8} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function AdminCellInput({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[38px] w-full rounded-lg border border-[var(--line-field)] bg-[var(--field)] px-2 text-[12.5px] text-[var(--ink)] outline-none"
    />
  );
}
