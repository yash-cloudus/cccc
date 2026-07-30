"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { HeaderLangToggle } from "@/components/ui/lang-toggle";
import { cn } from "@/lib/utils";

export function BackHeader({
  title,
  subtitle,
  onBack,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <header
      className={cn(
        "samaj-header sticky top-0 z-30 flex-none overflow-hidden px-[18px] pb-[18px] pt-12 text-white",
        className,
      )}
    >
      <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
      <div className="relative z-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack ?? (() => router.back())}
          className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-white/14"
          aria-label="back"
        >
          <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold leading-tight">
            {title}
          </div>
          {subtitle && (
            <div className="mt-0.5 text-xs font-medium text-white/72">{subtitle}</div>
          )}
        </div>
        <div className="flex flex-none items-center gap-2">
          <HeaderLangToggle />
          {right}
        </div>
      </div>
    </header>
  );
}
