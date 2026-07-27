"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchHeader({
  title,
  placeholder,
  value,
  onChange,
  icon,
}: {
  title: string;
  placeholder: string;
  value?: string;
  onChange?: (v: string) => void;
  icon?: React.ReactNode;
}) {
  return (
    <header className="samaj-header sticky top-0 z-30 flex-none overflow-hidden px-5 pb-[18px] pt-12 text-white">
      <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
      <div className="relative z-2 flex items-center gap-3">
        <div className="flex-1 font-[family-name:var(--font-noto-serif-gujarati)] text-[22px] font-bold">
          {title}
        </div>
        {icon && (
          <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-white/12">
            {icon}
          </div>
        )}
      </div>
      <div className="relative z-2 mt-4 flex h-12 items-center gap-2.5 rounded-[15px] bg-white px-3.5 shadow-[0_8px_20px_-10px_rgba(0,0,0,.35)]">
        <Search className="h-[19px] w-[19px] flex-none text-[var(--brand)]" strokeWidth={2.1} />
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "min-w-0 flex-1 border-none bg-transparent text-sm font-medium text-[var(--ink)] outline-none",
            "placeholder:text-[var(--faint-soft)]",
          )}
        />
      </div>
    </header>
  );
}
