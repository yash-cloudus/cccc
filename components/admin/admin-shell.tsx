"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  ListTree,
  Images,
  Newspaper,
  Megaphone,
  Info,
  Trophy,
  Settings,
  Shield,
  LogOut,
  Ellipsis,
  type LucideIcon,
} from "lucide-react";
import { ADMIN_NAV } from "@/lib/constants";
import { TooltipProvider, WithTooltip } from "@/components/ui/tooltip";
import { SidebarCollapseToggle } from "@/components/ui/sidebar-collapse-toggle";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<string, LucideIcon> = {
  dash: LayoutDashboard,
  queue: ClipboardList,
  families: Users,
  drop: ListTree,
  gallery: Images,
  news: Newspaper,
  ads: Megaphone,
  info: Info,
  results: Trophy,
  settings: Settings,
  admins: Shield,
};

/** First 4 tabs on mobile bottom bar; rest live under More. */
const MOBILE_PRIMARY_KEYS = ["dash", "queue", "families", "drop"] as const;

export function AdminShell({
  children,
  badges = {},
  communityNameEn,
  communityNameGu,
  logoText,
  logoUrl,
  primaryColor = "#A62A38",
}: {
  children: React.ReactNode;
  /** Sidebar counts keyed by ADMIN_NAV `badge` (e.g. { queue: 4, ads: 2 }). */
  badges?: Partial<Record<"queue" | "ads", number>>;
  communityNameEn: string;
  communityNameGu?: string | null;
  logoText: string;
  logoUrl?: string | null;
  adminHost?: string;
  primaryColor?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const shortLogo = (logoText || communityNameEn).slice(0, 3);
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("admin_nav_collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  function setCollapsedPersist(next: boolean) {
    setCollapsed(next);
    try {
      localStorage.setItem("admin_nav_collapsed", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function toggleCollapsed() {
    setCollapsedPersist(!collapsed);
  }

  const isActive = (href: string, key: string) => {
    if (key === "queue") {
      return pathname === "/admin/queue" || pathname.startsWith("/admin/queue/");
    }
    if (key === "dash") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const moreItems = useMemo(
    () => ADMIN_NAV.filter((n) => !(MOBILE_PRIMARY_KEYS as readonly string[]).includes(n.key)),
    [],
  );

  const moreSectionActive = moreItems.some((item) => isActive(item.href, item.key));

  async function logout() {
    setMoreOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* still redirect */
    }
    router.replace("/admin/login");
    router.refresh();
  }

  const brand = communityNameGu || communityNameEn;

  return (
    <TooltipProvider delay={120}>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-white font-[family-name:var(--font-manrope),var(--font-noto-sans-gujarati),sans-serif]">
        <div className="flex min-h-0 flex-1">
          <aside
            className={cn(
              "relative hidden shrink-0 overflow-visible transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:block",
              collapsed ? "w-[72px]" : "w-[230px]",
            )}
          >
            <nav
              className={cn(
                "admin-scroll flex h-full w-full flex-col overflow-y-auto overflow-x-hidden border-r border-[var(--line-admin)] bg-[var(--surface-admin)] py-3.5",
                collapsed ? "items-center" : "",
              )}
            >
              <div
                className={cn(
                  "mb-2 flex w-full items-center gap-2.5 transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  collapsed ? "justify-center px-0" : "px-3",
                )}
              >
                <WithTooltip
                  label={collapsed ? "Open sidebar" : brand}
                  side="right"
                  disabled={!collapsed}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed) setCollapsedPersist(false);
                    }}
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] font-[family-name:var(--font-noto-sans-gujarati)] text-[13px] font-bold text-white transition-transform duration-300 hover:scale-[1.03]",
                      collapsed && "cursor-pointer ring-offset-2 hover:ring-2 hover:ring-[var(--line-input)]",
                    )}
                    style={{ background: primaryColor }}
                    aria-label={collapsed ? "Open sidebar" : brand}
                  >
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      shortLogo
                    )}
                  </button>
                </WithTooltip>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[14px] font-extrabold text-[var(--ink)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    collapsed ? "max-w-0 translate-x-[-6px] opacity-0" : "max-w-[160px] translate-x-0 opacity-100",
                  )}
                >
                  {brand}
                </span>
              </div>

              <div
                className={cn(
                  "flex w-full flex-1 flex-col gap-1 transition-[padding] duration-300",
                  collapsed ? "items-center px-0" : "px-2",
                )}
              >
                {ADMIN_NAV.map((item) => {
                  const active = isActive(item.href, item.key);
                  const Icon = NAV_ICONS[item.key] || LayoutDashboard;
                  const count = item.badge ? (badges[item.badge] ?? 0) : 0;
                  const badge = count > 0 ? String(count) : null;
                  return (
                    <WithTooltip key={item.key} label={item.label} side="right" disabled={!collapsed}>
                      <Link
                        href={item.href}
                        className={cn(
                          "relative flex items-center rounded-[10px] text-[13.5px] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          collapsed ? "size-10 justify-center p-0" : "h-10 w-full gap-2.5 px-2.5",
                          active
                            ? "bg-[var(--brand-tint)] font-bold text-[var(--brand)]"
                            : "font-semibold text-[var(--ink-mid)] hover:bg-[var(--brand-tint)]/50",
                        )}
                      >
                        <Icon className="size-[18px] shrink-0" strokeWidth={2.1} />
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            collapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100",
                          )}
                        >
                          {item.label}
                        </span>
                        {badge && (
                          <span
                            className={cn(
                              "rounded-[11px] border border-[#E9CE7A] bg-[#FEF0CE] px-2 py-px text-[10.5px] font-extrabold text-[#8A6D1E] transition-opacity duration-300",
                              collapsed
                                ? "absolute right-1.5 top-1.5 size-1.5 border-0 p-0 opacity-100"
                                : "opacity-100",
                            )}
                          >
                            {collapsed ? null : badge}
                          </span>
                        )}
                      </Link>
                    </WithTooltip>
                  );
                })}
              </div>

              <div
                className={cn(
                  "mt-auto w-full border-t border-[var(--line-admin)] pt-2 transition-[padding] duration-300",
                  collapsed ? "flex justify-center px-0" : "px-2",
                )}
              >
                <WithTooltip label="Logout" side="right" disabled={!collapsed}>
                  <button
                    type="button"
                    onClick={logout}
                    className={cn(
                      "flex cursor-pointer items-center rounded-[10px] text-[13.5px] font-bold text-[var(--danger)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--brand-tint)]",
                      collapsed ? "size-10 justify-center p-0" : "h-10 w-full gap-2.5 px-2.5",
                    )}
                  >
                    <LogOut className="size-[18px] shrink-0" strokeWidth={2.2} />
                    <span
                      className={cn(
                        "truncate transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        collapsed ? "max-w-0 opacity-0" : "max-w-[100px] opacity-100",
                      )}
                    >
                      Logout
                    </span>
                  </button>
                </WithTooltip>
              </div>
            </nav>

            <SidebarCollapseToggle collapsed={collapsed} onToggle={toggleCollapsed} theme="light" />
          </aside>

          <div className="admin-scroll min-w-0 flex-1 overflow-y-auto bg-white px-8 py-7 max-md:px-[15px] max-md:pb-24 max-md:pt-[18px]">
            {children}
          </div>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-[var(--line-admin)] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-4px_20px_rgba(30,25,40,.08)] backdrop-blur md:hidden">
          {MOBILE_PRIMARY_KEYS.map((key) => {
            const item = ADMIN_NAV.find((n) => n.key === key);
            if (!item) return null;
            const Icon = NAV_ICONS[key] || LayoutDashboard;
            const active = isActive(item.href, item.key);
            const badge = item.badge ? (badges[item.badge] ?? 0) > 0 : false;
            return (
              <Link
                key={key}
                href={item.href}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-bold",
                  active ? "text-[var(--brand)]" : "text-[#8A8378]",
                )}
              >
                <Icon className="size-5" strokeWidth={2.1} />
                <span className="max-w-full truncate">{item.label.split(" ")[0]}</span>
                {badge && <span className="absolute right-2 top-1.5 size-1.5 rounded-full bg-[var(--gold)]" />}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-bold",
              moreOpen || moreSectionActive ? "text-[var(--brand)]" : "text-[#8A8378]",
            )}
          >
            <Ellipsis className="size-5" strokeWidth={2.2} />
            <span>More</span>
          </button>
        </nav>

        {moreOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close more menu"
              className="absolute inset-0 bg-black/35"
              onClick={() => setMoreOpen(false)}
            />
            <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-[var(--line-admin)] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(30,25,40,.18)]">
              <div className="flex items-center justify-between border-b border-[#F0EAE0] px-4 py-3">
                <p className="text-[14px] font-extrabold text-[var(--ink)]">More</p>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="cursor-pointer rounded-lg px-2 py-1 text-[12px] font-bold text-[#8A8378]"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
                {moreItems.map((item) => {
                  const Icon = NAV_ICONS[item.key] || LayoutDashboard;
                  const active = isActive(item.href, item.key);
                  const count = item.badge ? (badges[item.badge] ?? 0) : 0;
                  const badge = count > 0 ? String(count) : null;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-[14px]",
                        active
                          ? "bg-[var(--brand-tint)] font-bold text-[var(--brand)]"
                          : "font-semibold text-[var(--ink)] hover:bg-[var(--surface-admin)]",
                      )}
                    >
                      <Icon className="size-5 shrink-0" strokeWidth={2.1} />
                      <span className="min-w-0 flex-1">{item.label}</span>
                      {badge && (
                        <span className="rounded-[11px] border border-[#E9CE7A] bg-[#FEF0CE] px-2 py-px text-[10.5px] font-extrabold text-[#8A6D1E]">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={logout}
                  className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-bold text-[var(--danger)] hover:bg-[var(--brand-tint)]"
                >
                  <LogOut className="size-5 shrink-0" strokeWidth={2.2} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
