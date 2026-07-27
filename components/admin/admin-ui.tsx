"use client";

import { Search } from "lucide-react";
import { GujaratiInput } from "@/components/ui/gujarati-keyboard";
import { cn } from "@/lib/utils";

export function AdminH2({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("mb-5 text-[22px] font-extrabold text-[var(--ink)]", className)}>
      {children}
    </h2>
  );
}

export function AdminH3({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("mb-[11px] text-sm font-extrabold text-[var(--ink)]", className)}>
      {children}
    </h3>
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
  const styles = {
    pending: "bg-[var(--ochre-tint)] text-[var(--warn)]",
    approved: "bg-[var(--success-tint)] text-[var(--success)]",
    rejected: "bg-[var(--danger-tint)] text-[var(--danger)]",
  };
  const labels = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
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
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer text-xs font-bold underline",
        danger ? "text-[var(--danger)]" : "text-[#3D7BC4]",
        className
      )}
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

export function AdminInput({
  value,
  onChange,
  type = "text",
  className,
  placeholder,
  gujarati,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
  /** Adds the on-screen Gujarati keyboard button at the trailing edge. */
  gujarati?: boolean;
  onBlur?: () => void;
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
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={cn(ADMIN_INPUT_CLASS, className)}
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

/** Native select with the admin field styling (Design-Spec §11 NativeSelect). */
export function AdminSelect({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-[42px] cursor-pointer rounded-[11px] border-[1.5px] border-[var(--line-field)] bg-[var(--field)] px-3 text-[13.5px] text-[var(--ink)] outline-none",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
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
