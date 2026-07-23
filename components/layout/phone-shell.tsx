"use client";

import { cn } from "@/lib/utils";

export function PhoneShell({
  children,
  className,
  framed = true,
}: {
  children: React.ReactNode;
  className?: string;
  framed?: boolean;
}) {
  if (!framed) {
    return (
      <div className={cn("mx-auto min-h-dvh w-full max-w-lg bg-[var(--samaj-bg)]", className)}>
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-3.5 md:p-6">
      <div
        className={cn(
          "device relative w-full max-w-[390px] overflow-hidden rounded-[52px] bg-[#1C1512] p-3 shadow-[0_40px_90px_-30px_rgba(60,30,20,.55),0_0_0_1px_rgba(0,0,0,.2)] md:max-w-[900px] md:rounded-[44px]",
          "h-[min(844px,94dvh)] md:h-[min(94vh,1180px)]",
          className,
        )}
      >
        <div className="absolute left-1/2 top-[26px] z-40 h-8 w-[118px] -translate-x-1/2 rounded-[20px] bg-[#1C1512]" />
        <div className="relative flex h-full flex-col overflow-hidden rounded-[42px] bg-[var(--samaj-bg)] md:rounded-[34px]">
          {children}
        </div>
      </div>
    </div>
  );
}
