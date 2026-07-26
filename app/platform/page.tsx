"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, ImagePlus, LayoutGrid, Loader2, LogOut, Plus, Settings, ChevronLeft, X } from "lucide-react";
import { PRIMARY_COLORS, SECONDARY_COLORS, ROOT_DOMAIN } from "@/lib/constants";
import {
  communityAdminHostLabel,
  communityAdminUrl,
  communitySiteHostLabel,
  communityUrl,
  defaultAdminUsername,
  normalizeSlug,
  plural,
} from "@/lib/platform";
import { downloadCredentialsPdf } from "@/lib/credentials-pdf";
import { tintPrimary } from "@/lib/platform-types";
import { cn } from "@/lib/utils";
import { TooltipProvider, WithTooltip } from "@/components/ui/tooltip";

type ApiCommunity = {
  id: string;
  slug: string;
  nameEn: string;
  nameGu: string | null;
  logoText: string | null;
  logoUrl: string | null;
  type: "PARIVAR" | "GAM";
  status: "LIVE" | "DRAFT" | "SUSPENDED";
  primaryColor: string;
  secondaryColor: string;
  groupingLabel: string | null;
  _count?: {
    families: number;
    users: number;
    surnameGroups: number;
    villageAreas: number;
  };
  owner?: {
    id: string;
    username: string | null;
    mobile: string;
    name: string;
  } | null;
};

type View = "apps" | "create" | "settings";
type UIType = "parivar" | "gam";

type Form = {
  nameEn: string;
  nameGu: string;
  logoText: string;
  logoUrl: string;
  type: UIType;
  primary: string;
  secondary: string;
  subdomain: string;
  status: "LIVE" | "DRAFT";
  adminName: string;
  adminPhone: string;
  adminUsername: string;
  adminPassword: string;
  _subTouched?: boolean;
  _userTouched?: boolean;
};

const blankForm = (): Form => ({
  nameEn: "",
  nameGu: "",
  logoText: "",
  logoUrl: "",
  type: "parivar",
  primary: "#A62A38",
  secondary: "#E8A33D",
  subdomain: "",
  status: "LIVE",
  adminName: "",
  adminPhone: "",
  adminUsername: "",
  adminPassword: "admin",
});

export default function PlatformPage() {
  const [view, setView] = useState<View>("apps");
  const [apps, setApps] = useState<ApiCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [f, setF] = useState<Form>(blankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<{
    username: string;
    password: string;
    slug: string;
    name: string;
    ownerName: string;
    ownerPhone: string;
  } | null>(null);
  const [nameSyncing, setNameSyncing] = useState<"en2gu" | "gu2en" | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const translitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translitToken = useRef(0);
  const logoFileRef = useRef<HTMLInputElement | null>(null);

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("platform_nav_collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("platform_nav_collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function openSidebar() {
    setCollapsed(false);
    try {
      localStorage.setItem("platform_nav_collapsed", "0");
    } catch {
      /* ignore */
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/communities", { cache: "no-store" });
      const json = await res.json();
      if (json.success) setApps(json.data.communities);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const liveCount = apps.filter((a) => a.status === "LIVE").length;
  const isGam = f.type === "gam";
  const logoInitial = f.logoText || (f.nameGu || f.nameEn || "").trim().charAt(0) || "?";
  const sub = normalizeSlug(f.subdomain) || "your_app";
  const editing = editingId !== null;

  const previewBg = useMemo(
    () => `radial-gradient(120% 70% at 50% 0%, ${tintPrimary(f.primary)} 0%, #FBF8F2 55%)`,
    [f.primary],
  );

  function setField<K extends keyof Form>(key: K, value: Form[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  /** Bidirectional name sync: EN↔GU via /api/i18n/transliterate (debounced). */
  function scheduleNameSync(direction: "en2gu" | "gu2en", text: string) {
    if (translitTimer.current) clearTimeout(translitTimer.current);
    const token = ++translitToken.current;
    translitTimer.current = setTimeout(async () => {
      const trimmed = text.trim();
      if (!trimmed) {
        if (token !== translitToken.current) return;
        setF((prev) =>
          direction === "en2gu" ? { ...prev, nameGu: "" } : { ...prev, nameEn: "" },
        );
        setNameSyncing(null);
        return;
      }
      setNameSyncing(direction);
      try {
        const res = await fetch("/api/i18n/transliterate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, direction }),
        });
        const json = await res.json();
        if (token !== translitToken.current) return;
        if (!json.success || typeof json.data?.result !== "string") return;
        const result = json.data.result as string;
        setF((prev) => {
          if (direction === "en2gu") return { ...prev, nameGu: result };
          const nextSub = prev._subTouched ? prev.subdomain : normalizeSlug(result);
          const slug = normalizeSlug(nextSub) || normalizeSlug(result);
          return {
            ...prev,
            nameEn: result,
            subdomain: nextSub,
            adminUsername: prev._userTouched ? prev.adminUsername : (slug ? defaultAdminUsername(slug) : prev.adminUsername),
          };
        });
      } catch {
        /* keep last value; local fallback is server-side */
      } finally {
        if (token === translitToken.current) setNameSyncing(null);
      }
    }, 350);
  }

  function onNameEnChange(v: string) {
    setF((prev) => {
      const nextSub = prev._subTouched ? prev.subdomain : normalizeSlug(v);
      const slug = normalizeSlug(nextSub) || normalizeSlug(v);
      return {
        ...prev,
        nameEn: v,
        subdomain: nextSub,
        adminUsername: prev._userTouched ? prev.adminUsername : (slug ? defaultAdminUsername(slug) : ""),
      };
    });
    scheduleNameSync("en2gu", v);
  }

  function onNameGuChange(v: string) {
    setF((prev) => ({ ...prev, nameGu: v }));
    scheduleNameSync("gu2en", v);
  }

  async function uploadLogo(file: File) {
    const okType = /^(image\/(png|jpeg|webp|svg\+xml))$/.test(file.type);
    if (!okType) {
      setError("Logo must be PNG, JPG, WEBP, or SVG.");
      return;
    }
    if (file.size > 5_242_880) {
      setError("Logo file is too large (max 5 MB).");
      return;
    }
    setLogoUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "logos");
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!json.success || !json.data?.url) {
        setError(json.error || "Logo upload failed.");
        return;
      }
      setField("logoUrl", json.data.url as string);
    } catch {
      setError("Logo upload failed. Please try again.");
    } finally {
      setLogoUploading(false);
      if (logoFileRef.current) logoFileRef.current.value = "";
    }
  }

  function startCreate() {
    setEditingId(null);
    setF(blankForm());
    setError(null);
    setNameSyncing(null);
    setView("create");
  }

  function editApp(id: string) {
    const a = apps.find((x) => x.id === id);
    if (!a) return;
    setEditingId(id);
    setError(null);
    setF({
      ...blankForm(),
      nameEn: a.nameEn,
      nameGu: a.nameGu || "",
      logoText: a.logoText || "",
      logoUrl: a.logoUrl || "",
      type: a.type === "GAM" ? "gam" : "parivar",
      primary: a.primaryColor,
      secondary: a.secondaryColor,
      subdomain: a.slug,
      status: a.status === "DRAFT" ? "DRAFT" : "LIVE",
      adminName: a.owner?.name || "",
      adminPhone: a.owner?.mobile || "",
      adminUsername: a.owner?.username || defaultAdminUsername(a.slug),
      adminPassword: "", // blank for security — only sent if changed
      _subTouched: true,
      _userTouched: true,
    });
    setView("create");
  }

  async function saveApp() {
    setError(null);
    if (!f.nameEn.trim()) return setError("App name (English) is required.");
    const slug = normalizeSlug(f.subdomain || f.nameEn);
    if (!slug) return setError("A valid subdomain is required.");

    setSaving(true);
    try {
      if (editing) {
        const username = f.adminUsername.trim().toLowerCase();
        if (username.length < 3) return setError("Admin username must be at least 3 characters.");
        if (f.adminPhone && !/^[6-9]\d{9}$/.test(f.adminPhone))
          return setError("Enter owner’s mobile (10 digits, starting with 6–9).");
        if (f.adminPassword && f.adminPassword.length < 4)
          return setError("New password must be at least 4 characters.");

        const res = await fetch(`/api/platform/communities/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nameEn: f.nameEn.trim(),
            nameGu: f.nameGu.trim() || null,
            logoText: f.logoText || null,
            logoUrl: f.logoUrl.trim() || null,
            type: f.type.toUpperCase(),
            primaryColor: f.primary,
            secondaryColor: f.secondary,
            status: f.status,
            adminName: f.adminName,
            ...(f.adminPhone ? { adminPhone: f.adminPhone } : {}),
            adminUsername: username,
            ...(f.adminPassword.trim() ? { adminPassword: f.adminPassword.trim() } : {}),
          }),
        });
        const json = await res.json();
        if (!json.success) return setError(json.error || "Failed to save.");
        await load();
        setView("apps");
        setEditingId(null);
      } else {
        const username = (f.adminUsername || defaultAdminUsername(slug)).trim().toLowerCase();
        if (username.length < 3) return setError("Admin username must be at least 3 characters.");
        const password = (f.adminPassword || "admin").trim();
        if (password.length < 4) return setError("Admin password must be at least 4 characters.");
        if (!/^[6-9]\d{9}$/.test(f.adminPhone))
          return setError("Enter owner’s mobile (10 digits, starting with 6–9).");

        const createBody = {
          nameEn: f.nameEn.trim(),
          nameGu: f.nameGu.trim(),
          logoText: f.logoText,
          logoUrl: f.logoUrl.trim() || null,
          type: f.type.toUpperCase(),
          primaryColor: f.primary,
          secondaryColor: f.secondary,
          slug,
          adminName: f.adminName,
          adminPhone: f.adminPhone,
          adminUsername: username,
          adminPassword: password,
          status: f.status,
        };

        const res = await fetch("/api/platform/communities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createBody),
        });
        const json = await res.json();
        if (!json.success) {
          if (res.status === 401 || /unauthor/i.test(String(json.error || ""))) {
            // Try refresh once (access JWT may have expired while form was open).
            try {
              const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
              if (refreshed.ok) {
                const retry = await fetch("/api/platform/communities", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(createBody),
                });
                const retryJson = await retry.json();
                if (retryJson.success) {
                  await load();
                  setView("apps");
                  setCreds({
                    username: retryJson.data.credentials.username,
                    password: retryJson.data.credentials.password,
                    slug: retryJson.data.community.slug,
                    name: retryJson.data.community.nameEn,
                    ownerName: f.adminName.trim(),
                    ownerPhone: f.adminPhone,
                  });
                  return;
                }
              }
            } catch {
              /* fall through to re-login */
            }
            setError("Session expired. Sign in again as Main Admin, then create the app.");
            setTimeout(() => {
              window.location.href = "/login";
            }, 1200);
            return;
          }
          return setError(json.error || "Failed to create app.");
        }
        await load();
        setView("apps");
        setCreds({
          username: json.data.credentials.username,
          password: json.data.credentials.password,
          slug: json.data.community.slug,
          name: json.data.community.nameEn,
          ownerName: f.adminName.trim(),
          ownerPhone: f.adminPhone,
        });
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function openApp(slug: string) {
    try {
      const res = await fetch("/api/platform/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, target: "app" }),
      });
      const json = await res.json();
      if (json?.success && json?.data?.url) {
        window.location.href = json.data.url as string;
        return;
      }
    } catch {
      /* fall through */
    }
    window.location.href = communityUrl(slug, "/dashboard");
  }

  async function openAdmin(slug: string) {
    try {
      const res = await fetch("/api/platform/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, target: "admin" }),
      });
      const json = await res.json();
      if (json?.success && json?.data?.url) {
        window.location.href = json.data.url as string;
        return;
      }
    } catch {
      /* fall through */
    }
    window.location.href = communityAdminUrl(slug, "/admin");
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* still redirect */
    }
    window.location.href = "/login";
  }

  const navItems: { key: View; label: string; icon: typeof LayoutGrid }[] = [
    { key: "apps", label: "Your apps", icon: LayoutGrid },
    { key: "create", label: "Create app", icon: Plus },
    { key: "settings", label: "Platform settings", icon: Settings },
  ];

  return (
    <TooltipProvider delay={120}>
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white font-[family-name:var(--font-manrope),var(--font-noto-sans-gujarati),sans-serif]">
      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar — smooth open/close */}
        <aside
          className={cn(
            "relative hidden shrink-0 overflow-visible transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:block",
            collapsed ? "w-[72px]" : "w-[230px]",
          )}
        >
          <nav
            className={cn(
              "flex h-full w-full flex-col overflow-y-auto overflow-x-hidden bg-[var(--platform-ink-deep)] py-3.5 text-white",
              collapsed ? "items-center" : "",
            )}
          >
            <div
              className={cn(
                "mb-3 flex w-full items-center gap-2.5 transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                collapsed ? "justify-center px-0" : "px-3",
              )}
            >
              <WithTooltip label={collapsed ? "Open sidebar" : "Platform"} side="right" disabled={!collapsed}>
                <button
                  type="button"
                  onClick={() => {
                    if (collapsed) openSidebar();
                  }}
                  aria-label={collapsed ? "Open sidebar" : "Platform"}
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[var(--platform-bright)] to-[var(--platform)] transition-transform duration-300 hover:scale-[1.03]",
                    collapsed && "cursor-pointer ring-offset-2 hover:ring-2 hover:ring-white/20",
                  )}
                >
                  <LayoutGrid className="size-[18px]" strokeWidth={2} />
                </button>
              </WithTooltip>
              <span
                className={cn(
                  "flex-1 truncate text-[15px] font-extrabold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  collapsed ? "max-w-0 translate-x-[-6px] opacity-0" : "max-w-[140px] translate-x-0 opacity-100",
                )}
              >
                Platform
              </span>
            </div>

            <div
              className={cn(
                "flex w-full flex-1 flex-col gap-1 transition-[padding] duration-300",
                collapsed ? "items-center px-0" : "px-2",
              )}
            >
              {navItems.map((item) => {
                const active =
                  item.key === "settings"
                    ? view === "settings"
                    : item.key === "create"
                      ? view === "create"
                      : view === "apps";
                const Icon = item.icon;
                return (
                  <WithTooltip key={item.key} label={item.label} side="right" disabled={!collapsed}>
                    <button
                      type="button"
                      onClick={() => (item.key === "create" ? startCreate() : setView(item.key))}
                      className={cn(
                        "flex cursor-pointer items-center rounded-[10px] text-[13.5px] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        collapsed ? "size-10 justify-center p-0" : "h-10 w-full gap-2.5 px-2.5 text-left",
                        active
                          ? "bg-gradient-to-br from-[var(--platform-bright)] to-[var(--platform)] font-bold text-white"
                          : "font-semibold text-[var(--platform-muted)] hover:bg-white/5",
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" strokeWidth={2.1} />
                      <span
                        className={cn(
                          "truncate transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          collapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100",
                        )}
                      >
                        {item.label}
                      </span>
                    </button>
                  </WithTooltip>
                );
              })}
            </div>

            <div
              className={cn(
                "mx-3 mt-3 overflow-hidden border-t border-[#262A34] text-[11px] leading-relaxed text-[#6B7080] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                collapsed ? "max-h-0 border-0 pt-0 opacity-0" : "max-h-20 pt-3 opacity-100",
              )}
            >
              {liveCount} app{liveCount === 1 ? "" : "s"} live
              <br />
              on {ROOT_DOMAIN}
            </div>

            <div
              className={cn(
                "mt-auto w-full border-t border-[#262A34] pt-2 transition-[padding] duration-300",
                collapsed ? "flex justify-center px-0" : "px-2",
              )}
            >
              <WithTooltip label="Logout" side="right" disabled={!collapsed}>
                <button
                  type="button"
                  onClick={logout}
                  className={cn(
                    "flex cursor-pointer items-center rounded-[10px] text-[13.5px] font-bold text-[#F06156] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/5",
                    collapsed ? "size-10 justify-center p-0" : "h-10 w-full gap-2.5 px-2.5 text-left",
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

          <WithTooltip label={collapsed ? "Open sidebar" : "Close sidebar"} side="right">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
              className="absolute top-10 -right-3 z-30 flex size-6 cursor-pointer items-center justify-center rounded-md border border-[#fff] bg-[var(--platform)] text-[#ffff] shadow-[0_1px_3px_rgba(0,0,0,.35)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105 hover:bg-[#ffff] hover:text-[var(--platform)]"
            >
              <ChevronLeft
                className={cn(
                  "size-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  collapsed && "rotate-180",
                )}
                strokeWidth={2.4}
              />
            </button>
          </WithTooltip>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto bg-[#F7F7F9] pb-20 md:pb-0 [scrollbar-width:thin]">
          {(view === "apps" || view === "settings") && (
            <div className="p-[26px_30px] max-md:p-4">
              {view === "settings" ? (
                <>
                  <h2 className="m-0 text-[22px] font-extrabold text-[var(--platform-ink)]">Platform settings</h2>
                  <p className="mt-1 text-[13px] text-[var(--platform-muted)]">
                    Global platform options for {ROOT_DOMAIN}
                  </p>
                  <div className="mt-5 rounded-2xl border border-[var(--platform-line)] bg-white p-5 shadow-[0_2px_5px_rgba(30,25,40,.05)]">
                    <div className="mb-4 text-xs font-extrabold tracking-wide text-[var(--platform-muted)]">PLATFORM</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold text-[var(--platform-muted)]">Root domain</span>
                        <input className="mafld" defaultValue={ROOT_DOMAIN} readOnly />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold text-[var(--platform-muted)]">Support email</span>
                        <input className="mafld" defaultValue={`support@${ROOT_DOMAIN}`} />
                      </label>
                    </div>
                    <p className="mt-4 text-[12.5px] font-medium text-[var(--platform-muted)]">
                      Apps are managed from Your apps. Branding is per-app and applies live across every screen.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="m-0 text-[22px] font-extrabold text-[var(--platform-ink)]">Your apps</h2>
                      <p className="mt-1 text-[13px] text-[var(--platform-muted)]">
                        Every Gam / Parivar app you run on the platform
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={startCreate}
                      className="inline-flex h-auto cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-br from-[var(--platform-bright)] to-[var(--platform)] px-[18px] py-3 text-[13.5px] font-extrabold text-white"
                    >
                      <Plus className="size-[17px]" strokeWidth={2.3} />
                      Create app
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex items-center gap-2 py-16 text-sm text-[var(--platform-muted)]">
                      <Loader2 className="size-4 animate-spin" /> Loading apps…
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
                      {apps.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-2xl border border-[var(--platform-line)] bg-white p-4 shadow-[0_2px_5px_rgba(30,25,40,.05)]"
                        >
                          <div className="mb-3.5 flex items-center gap-3">
                            <div
                              className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border-2 font-[family-name:var(--font-noto-serif-gujarati)] text-lg font-bold text-white"
                              style={{ background: a.primaryColor, borderColor: a.secondaryColor }}
                            >
                              {a.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={a.logoUrl} alt="" className="size-full object-cover" />
                              ) : (
                                a.logoText || a.nameEn.charAt(0)
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[15px] font-extrabold text-[var(--platform-ink)]">
                                {a.nameGu || a.nameEn}
                              </div>
                              <div className="mt-px text-xs font-semibold text-[var(--platform-muted)]">
                                {communitySiteHostLabel(a.slug)}
                              </div>
                              <div className="mt-0.5 truncate text-[10.5px] font-semibold text-[#B4B8C4]">
                                {communityAdminHostLabel(a.slug)}
                              </div>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold",
                                a.status === "LIVE"
                                  ? "bg-[var(--success-tint)] text-[var(--success)]"
                                  : "bg-[#F1EFEA] text-[var(--platform-muted)]",
                              )}
                            >
                              {a.status === "LIVE" ? "Live" : a.status === "DRAFT" ? "Draft" : "Suspended"}
                            </span>
                          </div>

                          <div className="mb-3.5 flex flex-wrap gap-2">
                            <span className="rounded-lg bg-[var(--platform-surface)] px-2.5 py-1 text-[11.5px] font-bold text-[#6B6E78]">
                              {a.type === "GAM" ? "Gam · ગામ" : "Parivar · પરિવાર"}
                            </span>
                            {/* Live grouping count: villages for a Gam app,
                                surname groups for a Parivar app. */}
                            <span className="rounded-lg bg-[var(--platform-surface)] px-2.5 py-1 text-[11.5px] font-bold text-[#6B6E78]">
                              {a.type === "GAM"
                                ? `${a._count?.villageAreas ?? 0} ${plural(a._count?.villageAreas ?? 0, "village")}`
                                : `${a._count?.surnameGroups ?? 0} ${plural(a._count?.surnameGroups ?? 0, "surname")}`}
                            </span>
                            <span className="rounded-lg bg-[var(--platform-surface)] px-2.5 py-1 text-[11.5px] font-bold text-[#6B6E78]">
                              {a._count?.families ?? 0} {plural(a._count?.families ?? 0, "family", "families")}
                            </span>
                            <span className="rounded-lg bg-[var(--platform-surface)] px-2.5 py-1 text-[11.5px] font-bold text-[#6B6E78]">
                              {a._count?.users ?? 0} {plural(a._count?.users ?? 0, "member")}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5">
                            <div className="mr-auto flex items-center gap-1.5">
                              <span className="size-5 rounded-md border border-black/8" style={{ background: a.primaryColor }} />
                              <span className="size-5 rounded-md border border-black/8" style={{ background: a.secondaryColor }} />
                            </div>
                            <button
                              type="button"
                              onClick={() => editApp(a.id)}
                              className="cursor-pointer rounded-[10px] border-[1.5px] border-[var(--line-input)] bg-white px-3.5 py-2 text-xs font-extrabold text-[var(--ink-mid)]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openApp(a.slug)}
                              className="cursor-pointer rounded-[10px] border-[1.5px] border-[var(--line-input)] bg-white px-3.5 py-2 text-xs font-extrabold text-[var(--ink-mid)]"
                            >
                              Open app
                            </button>
                            <button
                              type="button"
                              onClick={() => openAdmin(a.slug)}
                              className="cursor-pointer rounded-[10px] bg-gradient-to-br from-[var(--platform-bright)] to-[var(--platform)] px-3.5 py-2 text-xs font-extrabold text-white"
                            >
                              Open admin
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={startCreate}
                        className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[#C9C6D4] bg-[#FBFBFE] text-[var(--platform-bright)]"
                      >
                        <span className="flex size-11 items-center justify-center rounded-[13px] bg-[var(--platform-tint)]">
                          <Plus className="size-[22px]" strokeWidth={2.3} />
                        </span>
                        <span className="text-sm font-extrabold">Create a new app</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {view === "create" && (
            <div className="flex min-h-full max-lg:flex-col">
              <div className="min-w-0 flex-1 border-r border-[var(--platform-line)] p-[26px_30px] max-md:p-4 max-lg:border-r-0">
                <button
                  type="button"
                  onClick={() => {
                    setView("apps");
                    setEditingId(null);
                  }}
                  className="mb-3 cursor-pointer text-[12.5px] font-bold text-[var(--platform-bright)]"
                >
                  ‹ All apps
                </button>
                <h2 className="m-0 text-[22px] font-extrabold text-[var(--platform-ink)]">
                  {editing ? "Edit app" : "Create a new app"}
                </h2>
                <p className="mb-[22px] mt-1 text-[13px] text-[var(--platform-muted)]">
                  Set the branding & type. The app configures itself automatically.
                </p>

                {error && (
                  <div className="mb-4 rounded-[11px] border border-[var(--danger-line)] bg-[var(--danger-tint-soft)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--danger)]">
                    {error}
                  </div>
                )}

                <Section label="BASIC DETAILS" />
                <Field label="App name (English) *">
                  <div className="relative">
                    <input
                      className="mafld"
                      value={f.nameEn}
                      placeholder="Mota Zinzuda Samaj"
                      onChange={(e) => onNameEnChange(e.target.value)}
                    />
                    {nameSyncing === "gu2en" && (
                      <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-[var(--platform-muted)]" />
                    )}
                  </div>
                </Field>
                <Field label="App name (ગુજરાતી)">
                  <div className="relative">
                    <input
                      className="mafld font-[family-name:var(--font-noto-serif-gujarati)]"
                      value={f.nameGu}
                      placeholder="મોટા ઝીંઝુડા સમાજ"
                      onChange={(e) => onNameGuChange(e.target.value)}
                    />
                    {nameSyncing === "en2gu" && (
                      <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-[var(--platform-muted)]" />
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-[#A0A5B0]">
                    Type either side — the other fills automatically (names use phonetic Gujarati).
                  </p>
                </Field>

                <div className="mb-[18px]">
                  <div className="mb-1.5 text-xs font-bold text-[var(--platform-muted)]">App logo</div>
                  <div className="flex items-start gap-3.5">
                    <div
                      className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 font-[family-name:var(--font-noto-serif-gujarati)] text-[22px] font-bold text-white"
                      style={{ background: f.primary, borderColor: f.secondary }}
                    >
                      {f.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.logoUrl} alt="" className="size-full object-cover" />
                      ) : (
                        logoInitial
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <input
                        ref={logoFileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadLogo(file);
                        }}
                      />
                      <button
                        type="button"
                        disabled={logoUploading}
                        onClick={() => logoFileRef.current?.click()}
                        className="flex w-full cursor-pointer flex-col items-center justify-center rounded-[13px] border border-dashed border-[#D4CEC2] bg-[var(--field)] px-3 py-3.5 text-[var(--platform-muted)] transition hover:border-[var(--brand)]/40 hover:bg-[#FBF6F0] disabled:opacity-60"
                      >
                        {logoUploading ? (
                          <Loader2 className="size-5 animate-spin" />
                        ) : (
                          <ImagePlus className="size-5" strokeWidth={1.7} />
                        )}
                        <span className="mt-1.5 text-[12.5px] font-bold">
                          {logoUploading ? "Uploading…" : "Upload logo (PNG/SVG)"}
                        </span>
                      </button>
                      {f.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setField("logoUrl", "")}
                          className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-bold text-[var(--danger)]"
                        >
                          <X className="size-3" /> Remove uploaded logo
                        </button>
                      )}
                      <div className="mb-1 mt-2.5 text-xs font-bold text-[var(--platform-muted)]">…or logo text</div>
                      <input
                        className="mafld"
                        maxLength={3}
                        placeholder="શ્રી"
                        value={f.logoText}
                        onChange={(e) => setField("logoText", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Section label="APP TYPE" />
                <div className="mb-[18px] flex gap-3 max-sm:flex-col">
                  {(
                    [
                      { k: "parivar" as const, title: "Parivar (પરિવાર)", desc: "Surname-based families directory" },
                      { k: "gam" as const, title: "Gam (ગામ)", desc: "Village-based directory" },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.k}
                      type="button"
                      onClick={() => setField("type", c.k)}
                      className={cn(
                        "flex-1 cursor-pointer rounded-[13px] border-[1.5px] p-3.5 text-left",
                        f.type === c.k ? "border-[var(--platform)] bg-[var(--platform-tint)]" : "border-[var(--line-input)] bg-white",
                      )}
                    >
                      <div className="text-sm font-extrabold text-[var(--platform-ink)]">{c.title}</div>
                      <div className="mt-1 text-[11.5px] leading-snug text-[var(--platform-muted)]">{c.desc}</div>
                    </button>
                  ))}
                </div>

                <Section label="BRAND COLORS" />
                <div className="mb-[18px] grid grid-cols-2 gap-3.5">
                  <div>
                    <div className="mb-1.5 text-xs font-bold text-[var(--platform-muted)]">Primary</div>
                    <div className="flex flex-wrap gap-1.5">
                      {PRIMARY_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setField("primary", c)}
                          className="size-8 cursor-pointer rounded-[9px] border-[3px]"
                          style={{
                            background: c,
                            borderColor: f.primary === c ? "#22252B" : "rgba(0,0,0,.08)",
                            boxShadow: f.primary === c ? "0 0 0 2px #fff inset" : "none",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-xs font-bold text-[var(--platform-muted)]">Secondary</div>
                    <div className="flex flex-wrap gap-1.5">
                      {SECONDARY_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setField("secondary", c)}
                          className="size-8 cursor-pointer rounded-[9px] border-[3px]"
                          style={{
                            background: c,
                            borderColor: f.secondary === c ? "#22252B" : "rgba(0,0,0,.08)",
                            boxShadow: f.secondary === c ? "0 0 0 2px #fff inset" : "none",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <Section label="DOMAIN" />
                <div className="mb-2">
                  <div className="mb-1.5 text-xs font-bold text-[var(--platform-muted)]">Subdomain *</div>
                  <div className="flex overflow-hidden rounded-xl border-[1.5px] border-[var(--line-input)] bg-white">
                    <input
                      value={f.subdomain}
                      placeholder="mota_zinzuda"
                      disabled={editing}
                      onChange={(e) =>
                        setF((prev) => {
                          const nextSub = e.target.value;
                          const slug = normalizeSlug(nextSub);
                          return {
                            ...prev,
                            subdomain: nextSub,
                            _subTouched: true,
                            adminUsername: prev._userTouched
                              ? prev.adminUsername
                              : slug
                                ? defaultAdminUsername(slug)
                                : prev.adminUsername,
                          };
                        })
                      }
                      className="min-w-0 flex-1 border-none bg-transparent px-3.5 py-3 text-sm text-[var(--platform-ink)] outline-none disabled:opacity-60"
                    />
                    <span className="flex items-center border-l border-[var(--line-input)] bg-[var(--platform-surface)] px-3.5 text-[13.5px] font-bold text-[var(--platform-muted)]">
                      .{ROOT_DOMAIN}
                    </span>
                  </div>
                </div>
                <div className="mb-[22px] space-y-1.5 rounded-[11px] border border-[#D2D6FB] bg-[var(--platform-tint)] px-3.5 py-2.5 text-[13px] font-bold text-[#3A45B0]">
                  <div>🌐 Website: {communitySiteHostLabel(sub)}</div>
                  <div>🛠 Admin: {communityAdminHostLabel(sub)}</div>
                  {editing && <span className="font-semibold text-[#6B7080]">(subdomain can’t be changed)</span>}
                </div>

                {/* Owner credentials — create + edit (password blank when editing) */}
                <Section label={editing ? "OWNER ADMIN" : "OWNER ADMIN (first login)"} />
                <div className="mb-[18px] grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
                  <Field label="Admin display name">
                    <input
                      className="mafld"
                      value={f.adminName}
                      placeholder="Owner name (optional)"
                      onChange={(e) => setField("adminName", e.target.value)}
                    />
                  </Field>
                  <Field label={editing ? "Owner mobile" : "Owner mobile *"}>
                    <input
                      className="mafld"
                      value={f.adminPhone}
                      placeholder="9876543210"
                      inputMode="numeric"
                      maxLength={10}
                      onChange={(e) =>
                        setField("adminPhone", e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                    />
                  </Field>
                </div>
                <div className="mb-2 grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
                  <Field label="Username *">
                    <input
                      className="mafld"
                      value={f.adminUsername}
                      placeholder={defaultAdminUsername(sub)}
                      autoComplete="off"
                      onChange={(e) =>
                        setF((prev) => ({
                          ...prev,
                          adminUsername: e.target.value.replace(/\s+/g, "_").toLowerCase(),
                          _userTouched: true,
                        }))
                      }
                    />
                  </Field>
                  <Field label={editing ? "New password" : "Password *"}>
                    <input
                      className="mafld"
                      type="text"
                      value={f.adminPassword}
                      placeholder={editing ? "Leave blank to keep current" : "admin"}
                      autoComplete="new-password"
                      onChange={(e) => setField("adminPassword", e.target.value)}
                    />
                  </Field>
                </div>
                {editing && (
                  <button
                    type="button"
                    onClick={() => setField("adminPassword", "admin")}
                    className="mb-3 cursor-pointer text-[12.5px] font-bold text-[var(--platform)] underline"
                  >
                    Reset password to “admin”
                  </button>
                )}
                <p className="mb-[18px] text-[12px] font-medium leading-relaxed text-[var(--platform-muted)]">
                  {editing ? (
                    <>
                      Password stays blank for security. Fill it only to change, or use reset.
                      Login uses <span className="font-bold text-[var(--ink-mid)]">username + password</span>.
                    </>
                  ) : (
                    <>
                      Mobile is saved on the owner account. Login uses{" "}
                      <span className="font-bold text-[var(--ink-mid)]">username + password</span> (not OTP).
                      Username auto-fills from subdomain; default password is{" "}
                      <span className="font-bold text-[var(--ink-mid)]">admin</span>.
                    </>
                  )}
                </p>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={saveApp}
                    disabled={saving}
                    className="flex h-[50px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[var(--platform-bright)] to-[var(--platform)] text-[13.5px] font-extrabold text-white disabled:opacity-70"
                  >
                    {saving ? <Loader2 className="size-[18px] animate-spin" /> : <Check className="size-[18px]" strokeWidth={2.3} />}
                    {editing ? "Save changes" : "Create app"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setView("apps");
                      setEditingId(null);
                    }}
                    className="flex h-[50px] cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-[var(--line-input)] bg-white px-5 text-[13.5px] font-extrabold text-[var(--ink-mid)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className="flex w-[340px] shrink-0 flex-col items-center bg-[#F0EFF4] px-[22px] py-6 max-lg:w-full">
                <div className="mb-3.5 self-start text-[11.5px] font-extrabold tracking-wide text-[var(--platform-muted)]">
                  LIVE PREVIEW
                </div>
                <div className="h-[512px] w-[250px] rounded-[36px] bg-[#1C1512] p-2.5 shadow-[0_24px_50px_-20px_rgba(30,25,40,.5)]">
                  <div
                    className="flex h-full w-full flex-col items-center gap-3 overflow-hidden rounded-[29px] px-[22px] py-[34px] text-center"
                    style={{ background: previewBg }}
                  >
                    <div
                      className="flex size-[70px] items-center justify-center overflow-hidden rounded-[20px] border-[3px] font-[family-name:var(--font-noto-serif-gujarati)] text-[26px] font-bold text-white"
                      style={{ background: f.primary, borderColor: f.secondary }}
                    >
                      {f.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.logoUrl} alt="" className="size-full object-cover" />
                      ) : (
                        logoInitial
                      )}
                    </div>
                    <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-[17px] font-bold leading-tight text-[var(--ink)]">
                      {f.nameGu || f.nameEn || (isGam ? "તમારું ગામ" : "તમારો સમાજ")}
                    </div>
                    <div className="text-[11px] font-semibold text-[var(--faint)]">Community Admin login</div>
                    <div className="mt-1.5 flex h-11 w-full items-center rounded-xl border-[1.5px] border-[var(--line-input)] bg-white px-3 text-[12px] font-bold text-[var(--ink)]">
                      {f.adminUsername || defaultAdminUsername(sub)}
                    </div>
                    <div className="flex h-11 w-full items-center rounded-xl border-[1.5px] border-[var(--line-input)] bg-white px-3 text-[12px] font-bold text-[var(--ink)]">
                      {editing
                        ? f.adminPassword
                          ? f.adminPassword
                          : "••••••••"
                        : f.adminPassword || "admin"}
                    </div>
                    <div
                      className="flex h-11 w-full items-center justify-center rounded-xl text-[13px] font-extrabold text-white"
                      style={{ background: f.primary }}
                    >
                      Login
                    </div>
                    <div className="mt-1 w-full border-t border-dashed border-[var(--line-input)] pt-3">
                      <div
                        className="flex h-[42px] w-full items-center justify-center rounded-xl border-[1.5px] bg-white text-[12.5px] font-extrabold"
                        style={{ borderColor: f.primary, color: f.primary }}
                      >
                        {isGam ? "નવું ઘર? નોંધણી કરો" : "નવો પરિવાર? નોંધણી કરો"}
                      </div>
                    </div>
                    <div className="mt-auto flex w-full gap-1.5">
                      <div className="h-[34px] flex-1 rounded-[9px] opacity-[.14]" style={{ background: f.primary }} />
                      <div className="h-[34px] flex-1 rounded-[9px] opacity-[.22]" style={{ background: f.secondary }} />
                      <div className="h-[34px] flex-1 rounded-[9px] opacity-[.14]" style={{ background: f.primary }} />
                    </div>
                  </div>
                </div>
                <div className="mt-3.5 text-center text-[11.5px] leading-relaxed text-[var(--platform-muted)]">
                  Directory: {isGam ? "village-based (Gam)" : "surname-based (Parivar)"}. Branding, logo & colors apply across every screen automatically.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-[#262A34] bg-[var(--platform-ink-deep)]/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-4px_20px_rgba(0,0,0,.35)] backdrop-blur md:hidden">
        {navItems.map((item) => {
          const active =
            item.key === "settings"
              ? view === "settings"
              : item.key === "create"
                ? view === "create"
                : view === "apps";
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              title={item.label}
              onClick={() => (item.key === "create" ? startCreate() : setView(item.key))}
              className={cn(
                "flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-bold",
                active ? "text-white" : "text-[var(--platform-muted)]",
              )}
            >
              <Icon className="size-5" strokeWidth={2.1} />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          title="Logout"
          onClick={logout}
          className="flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-bold text-[#F06156]"
        >
          <LogOut className="size-5" strokeWidth={2.2} />
          <span>Logout</span>
        </button>
      </nav>
    </div>
    </TooltipProvider>
  );
}

function CredentialsModal({
  creds,
  onClose,
}: {
  creds: {
    username: string;
    password: string;
    slug: string;
    name: string;
    ownerName: string;
    ownerPhone: string;
  };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const siteUrl = communityUrl(creds.slug, "/");
  const adminUrl = communityAdminUrl(creds.slug, "/admin");
  const text = [
    `Community: ${creds.name}`,
    `Website: ${siteUrl}`,
    `Admin URL: ${adminUrl}`,
    `Owner name: ${creds.ownerName || "—"}`,
    `Owner mobile: ${creds.ownerPhone || "—"}`,
    `Username: ${creds.username}`,
    `Password: ${creds.password}`,
  ].join("\n");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-[var(--success-tint)]">
          <Check className="size-6 text-[var(--success)]" strokeWidth={2.4} />
        </div>
        <h3 className="mt-2 text-lg font-extrabold text-[var(--success)]">Community Created Successfully</h3>
        <p className="mt-1 text-[13px] text-[var(--platform-muted)]">
          Share these one-time credentials with the community admin. The password is shown only now.
        </p>
        <div className="mt-4 space-y-2 rounded-xl border border-[var(--platform-line)] bg-[#FAFAFC] p-4 text-[13px]">
          <Row label="Community name" value={creds.name} />
          <Row label="Owner admin" value={creds.ownerName || "—"} />
          <Row label="Admin mobile" value={creds.ownerPhone || "—"} mono />
          <Row label="Username" value={creds.username} mono />
          <Row label="Password" value={creds.password} mono />
          <Row label="Admin panel login" value={adminUrl} />
          <Row label="Website" value={siteUrl} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            className="inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[var(--platform-bright)] to-[var(--platform)] px-4 py-3 text-[13px] font-extrabold text-white"
          >
            <Copy className="size-4" /> {copied ? "Copied!" : "Copy credentials"}
          </button>
          <button
            type="button"
            onClick={() =>
              downloadCredentialsPdf(creds.slug || creds.name, [
                ["Community name", creds.name],
                ["Owner admin", creds.ownerName || "—"],
                ["Admin mobile", creds.ownerPhone || "—"],
                ["Username", creds.username],
                ["Password", creds.password],
                ["Admin panel login", adminUrl],
                ["Website", siteUrl],
              ])
            }
            className="inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-[var(--line-input)] bg-white px-4 py-3 text-[13px] font-extrabold text-[var(--ink-mid)]"
          >
            <Download className="size-4" /> Download PDF
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2.5 w-full rounded-xl border-[1.5px] border-[var(--line-input)] bg-white px-5 py-3 text-[13px] font-extrabold text-[var(--ink-mid)]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 font-bold text-[var(--platform-muted)]">{label}</span>
      <span className={cn("break-all text-right font-semibold text-[var(--platform-ink)]", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function Section({ label }: { label: string }) {
  return <div className="mb-3 mt-1.5 text-xs font-extrabold tracking-wide text-[var(--platform-muted)]">{label}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 text-xs font-bold text-[var(--platform-muted)]">{label}</div>
      {children}
    </div>
  );
}
