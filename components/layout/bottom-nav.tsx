"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Home, Menu, Newspaper, Users } from "lucide-react";
import { useLang } from "@/providers/lang-provider";
import { cn } from "@/lib/utils";

const items = [
  { key: "home", href: "/dashboard", icon: Home, labelKey: "home" as const },
  { key: "dir", href: "/directory", icon: Users, labelKey: "directory" as const },
  { key: "biz", href: "/business", icon: Building2, labelKey: "business" as const },
  { key: "news", href: "/news", icon: Newspaper, labelKey: "news" as const },
  { key: "menu", href: "/menu", icon: Menu, labelKey: "menu" as const },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLang();

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[var(--app-max-w)] -translate-x-1/2 border-t border-[var(--line)] bg-white px-1.5 pt-2 shadow-[0_-8px_24px_-14px_rgba(36,30,27,.22)]"
      style={{ paddingBottom: "calc(0.875rem + env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            className="flex flex-1 flex-col items-center gap-0.5"
          >
            <span
              className={cn(
                "mb-0.5 flex h-[30px] w-[54px] items-center justify-center rounded-[15px]",
                active ? "bg-[var(--brand-tint)] text-[var(--brand)]" : "text-[var(--faint-soft)]",
              )}
            >
              <Icon className="h-[23px] w-[23px]" strokeWidth={1.9} />
            </span>
            <span
              className={cn(
                "text-[11px] font-bold",
                active ? "text-[var(--brand)]" : "text-[var(--faint-soft)]",
              )}
            >
              {t(item.labelKey)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
