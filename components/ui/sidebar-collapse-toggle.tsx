"use client";

import { ChevronsLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { WithTooltip } from "@/components/ui/tooltip";

/**
 * Collapse/expand toggle shared by the community admin shell and the
 * platform shell so both stay pixel-identical. Sits half-in/half-out of the
 * sidebar's border, centered on the logo row (nav's 14px padding-top + half
 * of the 40px logo = 34px from the top, on both shells).
 */
export function SidebarCollapseToggle({
  collapsed,
  onToggle,
  theme = "light",
  openLabel = "Open sidebar",
  closeLabel = "Close sidebar",
}: {
  collapsed: boolean;
  onToggle: () => void;
  theme?: "light" | "dark";
  /** Community admin passes translated labels; the platform shell keeps English. */
  openLabel?: string;
  closeLabel?: string;
}) {
  const label = collapsed ? openLabel : closeLabel;
  return (
    <WithTooltip label={label} side="right">
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        className={cn(
          "absolute -right-3 top-[34px] z-30 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 shadow-[0_3px_10px_rgba(20,16,10,.2)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 active:scale-95",
          theme === "dark"
            ? "border-white/20 bg-[var(--platform-ink-deep)] text-white hover:border-white/55 hover:bg-[var(--platform)]"
            : "border-[var(--line-admin)] bg-white text-[var(--ink-mid)] hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]",
        )}
      >
        <ChevronsLeft
          className={cn(
            "size-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            collapsed && "rotate-180",
          )}
          strokeWidth={2.5}
        />
      </button>
    </WithTooltip>
  );
}
