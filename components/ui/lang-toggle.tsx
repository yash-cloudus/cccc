"use client";

import { Languages } from "lucide-react";
import { useLang } from "@/providers/lang-provider";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { key: "gu" as const, label: "ગુ", title: "ગુજરાતી" },
  { key: "en" as const, label: "EN", title: "English" },
];

/** Compact ગુ / EN switch for sticky app headers (mobile-friendly). */
export function HeaderLangToggle({
  className,
  tone = "dark",
}: {
  className?: string;
  /** `dark` = burgundy header · `light` = cream / login screens */
  tone?: "dark" | "light";
}) {
  const { lang, setLang } = useLang();

  const shell =
    tone === "dark"
      ? "bg-white/12"
      : "border border-[var(--line-input)] bg-[#F4EFE6]/95 shadow-sm backdrop-blur-sm";

  const idle = tone === "dark" ? "text-white/75 hover:text-white" : "text-[var(--muted)] hover:text-[var(--ink)]";
  const active = tone === "dark" ? "bg-white text-[var(--brand)] shadow-sm" : "bg-white text-[var(--brand)] shadow-sm";

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn("flex flex-none items-center gap-0.5 rounded-[11px] p-0.5", shell, className)}
    >
      <Languages
        className={cn(
          "ml-1.5 size-3.5 shrink-0",
          tone === "dark" ? "text-white/55" : "text-[var(--faint)]",
        )}
        strokeWidth={2.2}
        aria-hidden
      />
      {OPTIONS.map(({ key, label, title }) => (
        <button
          key={key}
          type="button"
          title={title}
          aria-label={title}
          aria-pressed={lang === key}
          onClick={() => setLang(key)}
          className={cn(
            "min-w-[32px] cursor-pointer rounded-[9px] px-1.5 py-1.5 text-[11px] font-extrabold leading-none transition-colors",
            key === "gu" && "font-[family-name:var(--font-noto-sans-gujarati)]",
            lang === key ? active : idle,
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Full-width ગુજરાતી / English switch — settings & login footer. */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={cn("flex gap-1 rounded-[13px] bg-[#F4EFE6] p-1", className)}>
      {OPTIONS.map(({ key, title }) => (
        <button
          key={key}
          type="button"
          onClick={() => setLang(key)}
          className={cn(
            "flex-1 cursor-pointer whitespace-nowrap rounded-[10px] px-2.5 py-1.5 text-[12px] font-bold",
            key === "gu" && "font-[family-name:var(--font-noto-sans-gujarati)]",
            lang === key ? "bg-white text-[var(--brand)] shadow-sm" : "text-[var(--muted)]",
          )}
        >
          {key === "gu" ? "ગુજરાતી" : "English"}
        </button>
      ))}
    </div>
  );
}
