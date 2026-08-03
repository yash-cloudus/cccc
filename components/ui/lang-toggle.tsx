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

/**
 * ગુ / EN switch for the admin sidebar footer. Collapses to a single square
 * button that flips the language, so it stays usable at the 72px rail width.
 */
export function SidebarLangToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { lang, setLang } = useLang();

  if (collapsed) {
    const next = lang === "gu" ? "en" : "gu";
    return (
      <button
        type="button"
        onClick={() => setLang(next)}
        title={next === "gu" ? "ગુજરાતી" : "English"}
        aria-label={next === "gu" ? "Switch to Gujarati" : "Switch to English"}
        className={cn(
          "flex size-10 cursor-pointer items-center justify-center rounded-[10px] text-[11px] font-extrabold",
          "text-[var(--ink-mid)] transition-colors hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]",
          lang === "gu" && "font-[family-name:var(--font-noto-sans-gujarati)]",
        )}
      >
        {lang === "gu" ? "ગુ" : "EN"}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex w-full items-center gap-1 rounded-[10px] bg-[var(--brand-tint)]/60 p-1"
    >
      {/* Force HMR rebuild to fix hydration mismatch */}
      {OPTIONS.map(({ key, title }) => (
        <button
          key={key}
          type="button"
          title={title}
          aria-label={title}
          aria-pressed={lang === key}
          onClick={() => setLang(key)}
          className={cn(
            "flex h-8 flex-1 cursor-pointer items-center justify-center rounded-[8px] border text-[13px] font-bold leading-none transition-all",
            key === "gu" && "font-[family-name:var(--font-noto-sans-gujarati)]",
            lang === key
              ? "border-[var(--brand)]/30 bg-white text-[var(--brand)] shadow-sm"
              : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]",
          )}
        >
          {title}
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
