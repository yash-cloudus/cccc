"use client";

import { useLang } from "@/providers/lang-provider";
import { cn } from "@/lib/utils";

/** ગુજરાતી / English switch. Gujarati is the default (see LangProvider). */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={cn("flex gap-1 rounded-[13px] bg-[#F4EFE6] p-1", className)}>
      {(["gu", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-[10px] px-2.5 py-1.5 text-[12px] font-bold",
            lang === l ? "bg-white text-[var(--brand)] shadow-sm" : "text-[var(--muted)]",
          )}
        >
          {l === "gu" ? "ગુજરાતી" : "English"}
        </button>
      ))}
    </div>
  );
}
