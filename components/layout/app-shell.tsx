"use client";

import { cn } from "@/lib/utils";

/**
 * Member-site shell.
 *
 * This is a real website, not a device mockup — no phone bezel, no notch.
 * (The black frame in the prototype comes from Preview.dc.html, which is a
 * device *simulator*; shipping it on the live site would be wrong.)
 *
 * Mobile renders full-bleed. Tablet/desktop centre the same screens in a
 * max-width column — Design-Spec §23: the layout reflows, the navigation and
 * flow never change.
 */
export function AppShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-[var(--app-max-w)] flex-col bg-[var(--surface)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
