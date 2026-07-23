"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminH2({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("mb-5 text-[22px] font-extrabold text-[#2A2620]", className)}>
      {children}
    </h2>
  );
}

export function AdminH3({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("mb-[11px] text-sm font-extrabold text-[#2A2620]", className)}>
      {children}
    </h3>
  );
}

export function AdminHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mt-3.5 text-[11.5px] leading-relaxed text-[#938C80]", className)}>
      {children}
    </p>
  );
}

export function AdminTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

export function AdminTh({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b-2 border-[#EFE8DB] px-3 py-2.5 text-left text-[11.5px] font-bold tracking-wide text-[#938C80] uppercase",
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
      className={cn("border-b border-[#F1EBDE] px-3 py-[11px] text-[13px] text-[#3C382F]", className)}
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
        highlight && "border-[#E7BFC3] bg-[#FBEDEE]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminStatLabel({ children }: { children: React.ReactNode }) {
  return <div className="mt-0.5 text-[11.5px] text-[#938C80]">{children}</div>;
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
    primary: "bg-gradient-to-br from-[#A62A38] to-[#851F2B] text-white",
    ghost: "border-[1.5px] border-[#E1DACC] bg-white text-[#57524A]",
    success: "bg-gradient-to-br from-[#25A056] to-[#128C43] text-white",
    danger: "bg-gradient-to-br from-[#B0303A] to-[#8A1F28] text-white",
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
    <span className="ml-1.5 inline-block rounded-full bg-[#E4F5E9] px-2 py-0.5 text-[10.5px] font-bold text-[#1E9E52]">
      {children}
    </span>
  );
}

export function PillWarning({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 inline-block rounded-full bg-[#FEF3E0] px-2 py-0.5 text-[10.5px] font-bold text-[#B0801E]">
      {children}
    </span>
  );
}

export function PillExpired({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-[#FCE7E7] px-2 py-0.5 text-[10.5px] font-bold text-[#B0303A]">
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: "pending" | "approved" | "rejected" }) {
  const styles = {
    pending: "bg-[#FEF3E0] text-[#B0801E]",
    approved: "bg-[#E4F5E9] text-[#1E9E52]",
    rejected: "bg-[#FCE7E7] text-[#B0303A]",
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
          ? "bg-[#A62A38] font-bold text-white"
          : "border border-[#E6E0D3] bg-white text-[#6B6357]"
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
        "flex h-[42px] items-center gap-2.5 rounded-xl border-[1.5px] border-[#E6E0D3] bg-[#FCFAF6] px-3.5",
        className
      )}
    >
      <Search className="size-[17px] shrink-0 text-[#A62A38]" strokeWidth={2.1} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-[#2A2320] outline-none"
      />
    </div>
  );
}

export function QStat({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <div className="rounded-[10px] border border-[#EAE4D8] bg-[#FBFAF7] px-3 py-[7px] text-xs text-[#6B6357]">
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
        danger ? "text-[#B0303A]" : "text-[#3D7BC4]",
        className
      )}
    >
      {children}
    </button>
  );
}

export function AdminLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[11.5px] font-bold text-[#8B8375]">{children}</div>;
}

export function AdminInput({
  value,
  onChange,
  type = "text",
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-[42px] w-full rounded-[11px] border-[1.5px] border-[#EDE4D4] bg-[#FCFAF6] px-3 text-[13.5px] text-[#2A2320] outline-none",
        className
      )}
    />
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
      className="h-[38px] w-full rounded-lg border border-[#EDE4D4] bg-[#FCFAF6] px-2 text-[12.5px] text-[#2A2320] outline-none"
    />
  );
}
