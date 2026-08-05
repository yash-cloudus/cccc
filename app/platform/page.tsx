"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Download, Eye, EyeOff, ImagePlus, KeyRound, LayoutGrid, Loader2, LogOut, MessageCircle, MessageSquareText, Plus, RefreshCw, Search, Settings, Trash2, X } from "lucide-react";
import { ROOT_DOMAIN } from "@/lib/constants";
import { isSingleHostBrowser } from "@/lib/host";
import { PhoneField } from "@/components/ui/phone-field";
import { DEFAULT_ISO, isValidNumber } from "@/lib/phone";
import { BrandColorsPicker } from "@/components/shared/brand-colors-picker";
import { HostLabel } from "@/components/host-label";
import {
  MAX_LOGO_LETTERS,
  communityAdminUrl,
  communityUrl,
  defaultAdminUsername,
  generateNamePhonePassword,
  normalizeSlug,
  plural,
  truncateLetters,
} from "@/lib/platform";
import { downloadCredentialsPdf } from "@/lib/credentials-pdf";
import { tintPrimary } from "@/lib/platform-types";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { GujaratiInput } from "@/components/ui/gujarati-keyboard";
import { TooltipProvider, WithTooltip } from "@/components/ui/tooltip";
import { SidebarCollapseToggle } from "@/components/ui/sidebar-collapse-toggle";

type ApiCommunity = {
  id: string;
  slug: string;
  nameEn: string;
  nameGu: string | null;
  logoText: string | null;
  logoUrl: string | null;
  type: "PARIVAR" | "GAM";
  status: "LIVE" | "DRAFT" | "SUSPENDED";
  authMode: AuthMode;
  primaryColor: string;
  secondaryColor: string;
  groupingLabel: string | null;
  /** Masks only — the API never returns a stored key, encrypted or otherwise. */
  integration?: {
    apiKeyMask: string | null;
    firmIdMask: string | null;
    senderMobile: string | null;
    senderIso: string | null;
  } | null;
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
    mobileIso?: string | null;
    name: string;
  } | null;
};

/**
 * "Validation failed" alone left the admin guessing which of ~15 fields the
 * server rejected. `fromZod` already ships a per-field `issues` array — this
 * just stops throwing it away.
 */
function apiError(json: unknown, fallback: string): string {
  const j = json as { error?: string; issues?: { path: string; message: string }[] };
  const detail = j?.issues?.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join(" · ");
  return detail || j?.error || fallback;
}

type View = "apps" | "create" | "settings";
type UIType = "parivar" | "gam";
type AuthMode = "MOBILE_PASSWORD" | "WHATSAPP_API" | "SMS";

/**
 * How members of this app sign in, and whether it may automate WhatsApp.
 *
 * SMS is selectable but has no provider yet — it behaves exactly like
 * WHATSAPP_API minus the automation, so the copy says "OTP" rather than just
 * "coming soon". An admin who reads "coming soon" and then watches members log
 * in anyway has been told the wrong thing.
 */
const AUTH_MODES: {
  k: AuthMode;
  title: string;
  desc: string;
  note?: string;
  icon: typeof KeyRound;
  /** Own accent per mode, like TYPE_BADGE — three identical cards are three
   *  things you have to read before you can tell them apart. */
  tint: string;
  text: string;
  ring: string;
}[] = [
  {
    k: "MOBILE_PASSWORD",
    title: "Mobile No / Password",
    desc: "One number + a 6-digit password for the whole family. No WhatsApp automation.",
    note: "Existing families get the head’s mobile and their date of birth (13/11/2004 → 131104) as the first password.",
    icon: KeyRound,
    tint: "bg-[var(--violet-tint)]",
    text: "text-[var(--violet)]",
    ring: "border-[var(--violet)] bg-[var(--violet-tint)]",
  },
  {
    k: "WHATSAPP_API",
    title: "WhatsApp API",
    desc: "Mobile + OTP. The only mode that may auto-send WhatsApp messages.",
    icon: MessageCircle,
    tint: "bg-[var(--success-tint)]",
    text: "text-[var(--wa-dark)]",
    ring: "border-[var(--wa)] bg-[var(--success-tint)]",
  },
  {
    k: "SMS",
    title: "SMS — coming soon",
    desc: "Mobile + OTP, no automation. Runs on the dev OTP until a provider is chosen.",
    icon: MessageSquareText,
    tint: "bg-[var(--info-tint)]",
    text: "text-[var(--info)]",
    ring: "border-[var(--info)] bg-[var(--info-tint)]",
  },
];

/** Distinct accent per app type so Parivar/Gam are visually distinguishable at a glance. */
const TYPE_BADGE: Record<"PARIVAR" | "GAM", { tint: string; text: string; solid: string }> = {
  PARIVAR: { tint: "bg-[var(--violet-tint)]", text: "text-[var(--violet)]", solid: "bg-[var(--violet)]" },
  GAM: { tint: "bg-[var(--info-tint)]", text: "text-[var(--info)]", solid: "bg-[var(--info)]" },
};

type Form = {
  nameEn: string;
  nameGu: string;
  logoText: string;
  logoUrl: string;
  type: UIType;
  primary: string;
  secondary: string;
  subdomain: string;
  status: "LIVE" | "DRAFT" | "SUSPENDED";
  adminName: string;
  adminPhone: string;
  adminPhoneIso: string;
  adminUsername: string;
  adminPassword: string;
  primarySurnameEn: string;
  primarySurnameGu: string;
  village: string;
  authMode: AuthMode;
  // Write-only. The API never sends these back — an empty field on edit means
  // "leave whatever is stored alone".
  waApiKey: string;
  waFirmId: string;
  waSenderMobile: string;
  waSenderIso: string;
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
  adminPhoneIso: DEFAULT_ISO,
  adminUsername: "",
  adminPassword: "admin",
  primarySurnameEn: "",
  primarySurnameGu: "",
  village: "",
  authMode: "WHATSAPP_API",
  waApiKey: "",
  waFirmId: "",
  waSenderMobile: "",
  waSenderIso: DEFAULT_ISO,
});

export default function PlatformPage() {
  const { guInput } = useTranslitSync();
  const [view, setView] = useState<View>("apps");
  const [apps, setApps] = useState<ApiCommunity[]>([]);
  const [appSearch, setAppSearch] = useState("");
  const [appTypeFilter, setAppTypeFilter] = useState<"all" | "PARIVAR" | "GAM">("all");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [f, setF] = useState<Form>(blankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What switching to MOBILE_PASSWORD did to the families already in the app. */
  const [backfillNote, setBackfillNote] = useState<string | null>(null);
  const [creds, setCreds] = useState<{
    username: string;
    password: string;
    slug: string;
    name: string;
    ownerName: string;
    ownerPhone: string;
  } | null>(null);
  const [nameSyncing, setNameSyncing] = useState<"en2gu" | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ApiCommunity | null>(null);
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

  const filteredApps = useMemo(() => {
    const needle = appSearch.trim().toLowerCase();
    return apps.filter((a) => {
      if (appTypeFilter !== "all" && a.type !== appTypeFilter) return false;
      if (!needle) return true;
      return (
        a.nameEn.toLowerCase().includes(needle) ||
        (a.nameGu || "").toLowerCase().includes(needle) ||
        a.slug.toLowerCase().includes(needle)
      );
    });
  }, [apps, appSearch, appTypeFilter]);

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

  function usernameTaken(name: string): boolean {
    const n = name.trim().toLowerCase();
    if (!n) return false;
    return apps.some((a) => a.id !== editingId && (a.owner?.username || "").toLowerCase() === n);
  }

  function genUsername() {
    const slug = normalizeSlug(f.subdomain) || normalizeSlug(f.nameEn) || "community";
    const base = defaultAdminUsername(slug);
    let candidate = base;
    let i = 2;
    while (usernameTaken(candidate)) {
      candidate = `${base}${i}`;
      i++;
    }
    setF((prev) => ({ ...prev, adminUsername: candidate, _userTouched: true }));
  }

  function genAdminPassword() {
    setShowAdminPassword(true);
    setField("adminPassword", generateNamePhonePassword(f.adminName, f.adminPhone));
  }

  /** English name → Gujarati name via /api/i18n/transliterate (debounced). */
  function scheduleNameSync(direction: "en2gu", text: string) {
    if (translitTimer.current) clearTimeout(translitTimer.current);
    const token = ++translitToken.current;
    translitTimer.current = setTimeout(async () => {
      const trimmed = text.trim();
      if (!trimmed) {
        if (token !== translitToken.current) return;
        setF((prev) => ({ ...prev, nameGu: "" }));
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
        setF((prev) => ({ ...prev, nameGu: result }));
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

  /**
   * Gujarati name field = Gujarati phonetic keyboard.
   *
   * Typing Latin here converts to Gujarati in place, once a space completes a
   * word. It deliberately does NOT write back to the English name (or the
   * derived subdomain) — that reverse sync used to overwrite what the user had
   * already typed in English.
   */
  function onNameGuChange(v: string) {
    setF((prev) => ({ ...prev, nameGu: v }));
    guInput(v, (gu) => setF((prev) => ({ ...prev, nameGu: gu })), "appName:gu");
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
      status: a.status,
      adminName: a.owner?.name || "",
      adminPhone: a.owner?.mobile || "",
      adminPhoneIso: a.owner?.mobileIso || DEFAULT_ISO,
      adminUsername: a.owner?.username || defaultAdminUsername(a.slug),
      adminPassword: "", // blank for security — only sent if changed
      authMode: a.authMode,
      // Same rule as the password: never populated, only sent when retyped.
      waApiKey: "",
      waFirmId: "",
      waSenderMobile: a.integration?.senderMobile || "",
      waSenderIso: a.integration?.senderIso || DEFAULT_ISO,
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
        if (f.adminPhone && !isValidNumber(f.adminPhone, f.adminPhoneIso))
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
            ...(f.adminPhone ? { adminPhone: f.adminPhone, adminPhoneIso: f.adminPhoneIso } : {}),
            adminUsername: username,
            ...(f.adminPassword.trim() ? { adminPassword: f.adminPassword.trim() } : {}),
            authMode: f.authMode,
            // Blank means "keep what is stored" — the server only overwrites a
            // credential it was actually handed.
            ...(f.waApiKey.trim() ? { waApiKey: f.waApiKey.trim() } : {}),
            ...(f.waFirmId.trim() ? { waFirmId: f.waFirmId.trim() } : {}),
            waSenderMobile: f.waSenderMobile.trim(),
            waSenderIso: f.waSenderIso,
          }),
        });
        const json = await res.json();
        if (!json.success) return setError(apiError(json, "Failed to save."));
        // Switching to password login rewrites every existing family's login.
        // Say what actually happened — silence here reads as "nothing changed",
        // when in fact 200 households just got new credentials.
        const b = json.data?.backfill;
        if (b) {
          const parts = [`${b.withPassword} families got a password from the head's date of birth`];
          if (b.needsPassword) parts.push(`${b.needsPassword} have no date of birth — set those manually`);
          if (b.noMobile) parts.push(`${b.noMobile} have no mobile number and cannot log in`);
          if (b.alreadySet) parts.push(`${b.alreadySet} already had a password and were left alone`);
          setBackfillNote(parts.join(" · "));
        }
        await load();
        setView("apps");
        setEditingId(null);
      } else {
        const username = (f.adminUsername || defaultAdminUsername(slug)).trim().toLowerCase();
        if (username.length < 3) return setError("Admin username must be at least 3 characters.");
        const password = (f.adminPassword || "admin").trim();
        if (password.length < 4) return setError("Admin password must be at least 4 characters.");
        if (!isValidNumber(f.adminPhone, f.adminPhoneIso))
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
          adminPhoneIso: f.adminPhoneIso,
          adminUsername: username,
          adminPassword: password,
          status: f.status,
          primarySurnameEn: f.primarySurnameEn.trim(),
          primarySurnameGu: f.primarySurnameGu.trim(),
          village: f.village.trim(),
          authMode: f.authMode,
          waApiKey: f.waApiKey.trim(),
          waFirmId: f.waFirmId.trim(),
          waSenderMobile: f.waSenderMobile.trim(),
        };

        if (f.type === "parivar" && !f.primarySurnameEn.trim()) {
          return setError("Primary surname is required for Parivar communities.");
        }
        if (
          f.authMode === "WHATSAPP_API" &&
          (f.waApiKey.trim() || f.waFirmId.trim() || f.waSenderMobile.trim()) &&
          !(f.waApiKey.trim() && f.waFirmId.trim() && f.waSenderMobile.trim())
        ) {
          // Partial credentials cannot send, so half-filling them would look
          // configured while behaving exactly like not configured.
          return setError("Fill in all three WhatsApp API fields, or leave all three blank.");
        }

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
          return setError(apiError(json, "Failed to create app."));
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
    // Open the tab synchronously (inside the click handler) so browsers don't
    // treat it as a blocked popup once we redirect it after the await below.
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    try {
      const res = await fetch("/api/platform/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, target: "app" }),
      });
      const json = await res.json();
      if (json?.success && json?.data?.url) {
        if (win) win.location.href = json.data.url as string;
        else window.open(json.data.url as string, "_blank", "noopener,noreferrer");
        return;
      }
    } catch {
      /* fall through */
    }
    // Same fallback rule as the primary path (which delegates this decision to
    // the server-side launch route): a {slug}.ROOT_DOMAIN URL only resolves on
    // a canonical host — on a dev tunnel / LAN IP it has to stay same-origin.
    const fallback = isSingleHostBrowser()
      ? `${window.location.origin}/dashboard?c=${encodeURIComponent(slug)}`
      : communityUrl(slug, "/dashboard");
    if (win) win.location.href = fallback;
    else window.open(fallback, "_blank", "noopener,noreferrer");
  }

  async function openAdmin(slug: string) {
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    try {
      const res = await fetch("/api/platform/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, target: "admin" }),
      });
      const json = await res.json();
      if (json?.success && json?.data?.url) {
        if (win) win.location.href = json.data.url as string;
        else window.open(json.data.url as string, "_blank", "noopener,noreferrer");
        return;
      }
    } catch {
      /* fall through */
    }
    const fallback = isSingleHostBrowser()
      ? `${window.location.origin}/admin?c=${encodeURIComponent(slug)}`
      : communityAdminUrl(slug, "/admin");
    if (win) win.location.href = fallback;
    else window.open(fallback, "_blank", "noopener,noreferrer");
  }

  /** Quick Active/Deactive flip from the app card — persists straight to the DB. */
  async function toggleAppStatus(a: ApiCommunity) {
    const nextStatus = a.status === "LIVE" ? "SUSPENDED" : "LIVE";
    setTogglingId(a.id);
    try {
      const res = await fetch(`/api/platform/communities/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (json?.success) {
        setApps((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: nextStatus } : x)));
        if (editingId === a.id) setField("status", nextStatus);
      } else {
        setError(json.error || "Failed to update app status.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setTogglingId(null);
    }
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

          <SidebarCollapseToggle collapsed={collapsed} onToggle={toggleCollapsed} theme="dark" />
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
                  {backfillNote && (
                    <div className="mb-5 flex items-start gap-3 rounded-[13px] border border-[var(--warn)] bg-[var(--warn-tint)] px-4 py-3">
                      <KeyRound className="mt-0.5 size-4 shrink-0 text-[var(--warn)]" />
                      <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed font-semibold text-[var(--warn)]">
                        Switched to password login. {backfillNote}.
                        <div className="mt-1 font-medium opacity-90">
                          A date of birth is printed on the member&rsquo;s own directory card, so
                          these starting passwords are not secret. Reset any of them from the
                          family page in the community admin.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBackfillNote(null)}
                        className="shrink-0 text-[12px] font-extrabold text-[var(--warn)] underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                  <div className="mb-5 flex flex-wrap items-center gap-3">
                    <div className="mr-auto">
                      <h2 className="m-0 text-[22px] font-extrabold text-[var(--platform-ink)]">Your apps</h2>
                      <p className="mt-1 text-[13px] text-[var(--platform-muted)]">
                        Every Gam / Parivar app you run on the platform
                      </p>
                    </div>

                    <div className="relative min-w-0 flex-1 sm:max-w-[340px]">
                      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--platform-muted)]" />
                      <input
                        value={appSearch}
                        onChange={(e) => setAppSearch(e.target.value)}
                        placeholder="Search Gam / Parivar by name…"
                        className="h-11 w-full rounded-xl border-[1.5px] border-[var(--platform-line)] bg-white pr-3 pl-9 text-[13.5px] text-[var(--platform-ink)] outline-none focus:border-[var(--platform)]"
                      />
                    </div>

                    <div className="flex overflow-hidden rounded-xl border-[1.5px] border-[var(--platform-line)] bg-white">
                      {(
                        [
                          { key: "PARIVAR", label: "Parivar" },
                          { key: "GAM", label: "Gam" },
                        ] as const
                      ).map((opt) => {
                        const active = appTypeFilter === opt.key;
                        const badge = TYPE_BADGE[opt.key];
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setAppTypeFilter(active ? "all" : opt.key)}
                            className={cn(
                              "h-11 cursor-pointer px-4 text-[13px] font-bold whitespace-nowrap last:border-l-[1.5px] last:border-[var(--platform-line)]",
                              active ? cn(badge.solid, "text-white") : cn(badge.tint, badge.text),
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
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
                  ) : filteredApps.length === 0 && apps.length > 0 ? (
                    <div className="flex flex-col items-center gap-1.5 py-16 text-center">
                      <span className="text-[13.5px] font-bold text-[var(--platform-ink)]">No apps match your search</span>
                      <span className="text-[12.5px] text-[var(--platform-muted)]">Try a different name or clear the filter.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
                      {filteredApps.map((a) => (
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
                                <HostLabel slug={a.slug} />
                              </div>
                              <div className="mt-0.5 truncate text-[10.5px] font-semibold text-[#B4B8C4]">
                                <HostLabel slug={a.slug} admin />
                              </div>
                            </div>
                          </div>

                          <div className="mb-3.5 flex flex-wrap gap-2">
                            <span
                              className={cn(
                                "rounded-lg px-2.5 py-1 text-[11.5px] font-bold",
                                TYPE_BADGE[a.type].tint,
                                TYPE_BADGE[a.type].text,
                              )}
                            >
                              {a.type === "GAM" ? "Gam · ગામ" : "Parivar · પરિવાર"}
                            </span>
                            {/* Live grouping count: a Gam app is one fixed village with many
                                surnames, so show surname diversity. A Parivar app is one fixed
                                surname spread across many villages, so show village diversity. */}
                            <span className="rounded-lg bg-[var(--platform-surface)] px-2.5 py-1 text-[11.5px] font-bold text-[#6B6E78]">
                              {a.type === "GAM"
                                ? `${a._count?.surnameGroups ?? 0} ${plural(a._count?.surnameGroups ?? 0, "surname")}`
                                : `${a._count?.villageAreas ?? 0} ${plural(a._count?.villageAreas ?? 0, "village")}`}
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
                            <WithTooltip label="Delete app" side="top">
                              <button
                                type="button"
                                onClick={() => setDeleting(a)}
                                aria-label={`Delete ${a.nameEn}`}
                                className="flex cursor-pointer items-center justify-center rounded-[10px] border-[1.5px] border-[var(--danger-line)] bg-white p-2 text-[var(--danger)] transition hover:bg-[var(--danger-tint-soft)]"
                              >
                                <Trash2 className="size-4" strokeWidth={2.1} />
                              </button>
                            </WithTooltip>
                          </div>

                          <div className="mt-2.5 flex items-center">
                            <button
                              type="button"
                              onClick={() => openAdmin(a.slug)}
                              className="cursor-pointer rounded-[10px] bg-gradient-to-br from-[var(--platform-bright)] to-[var(--platform)] px-3.5 py-2 text-xs font-extrabold text-white"
                            >
                              Open admin
                            </button>
                            <StatusToggle
                              active={a.status === "LIVE"}
                              busy={togglingId === a.id}
                              onToggle={() => toggleAppStatus(a)}
                              className="ml-auto"
                            />
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

                {editing && (
                  <div className="mb-5 flex items-center justify-between gap-3 rounded-[13px] border border-[var(--platform-line)] bg-[var(--platform-surface)] px-4 py-3">
                    <div>
                      <div className="text-[13px] font-extrabold text-[var(--platform-ink)]">App status</div>
                      <div className="text-[11.5px] font-semibold text-[var(--platform-muted)]">
                        Saved with the rest of this form when you click Save changes.
                      </div>
                    </div>
                    <StatusToggle
                      active={f.status === "LIVE"}
                      onToggle={() => setField("status", f.status === "LIVE" ? "SUSPENDED" : "LIVE")}
                    />
                  </div>
                )}

                <Section label="BASIC DETAILS" emphasis />
                <Field label="App name (English) *">
                  <div className="relative">
                    <input
                      className="mafld"
                      value={f.nameEn}
                      placeholder="Mota Zinzuda Samaj"
                      onChange={(e) => onNameEnChange(e.target.value)}
                    />
                  </div>
                </Field>
                <Field label="App name (ગુજરાતી)">
                  <div className="relative">
                    <GujaratiInput
                      inputClassName="mafld font-[family-name:var(--font-noto-serif-gujarati)]"
                      value={f.nameGu}
                      placeholder="મોટા ઝીંઝુડા સમાજ"
                      onChange={onNameGuChange}
                    />
                    {nameSyncing === "en2gu" && (
                      <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-[var(--platform-muted)]" />
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-[#A0A5B0]">
                    English fills this automatically. You can also type here directly — Latin
                    becomes Gujarati as you type (press space after each word).
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
                        {!logoUploading && !f.logoUrl && (
                          <span className="mt-0.5 text-[11px] font-medium opacity-75">
                            512 × 512 px (1:1) recommended
                          </span>
                        )}
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
                      {/* Trimmed by visible letters, not maxLength — "શ્રી" is
                          one Gujarati letter in four UTF-16 units, so
                          maxLength={3} made the app's own default logo
                          untypeable. */}
                      <input
                        className="mafld"
                        placeholder="શ્રી"
                        value={f.logoText}
                        onChange={(e) =>
                          setField("logoText", truncateLetters(e.target.value, MAX_LOGO_LETTERS))
                        }
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

                <Section label="LOGIN METHOD" />
                <div className="mb-[18px] flex gap-3 max-sm:flex-col">
                  {AUTH_MODES.map((m) => {
                    const active = f.authMode === m.k;
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.k}
                        type="button"
                        onClick={() => setField("authMode", m.k)}
                        className={cn(
                          "flex-1 cursor-pointer rounded-[13px] border-[1.5px] p-3.5 text-left transition-colors",
                          active ? m.ring : "border-[var(--line-input)] bg-white hover:border-[var(--platform-line)]",
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-[9px]",
                              m.tint,
                              m.text,
                            )}
                          >
                            <Icon className="size-[17px]" strokeWidth={2.2} />
                          </span>
                          <span className="text-sm font-extrabold text-[var(--platform-ink)]">
                            {m.title}
                          </span>
                          {active && <Check className={cn("ml-auto size-4 shrink-0", m.text)} />}
                        </div>
                        <div className="mt-2 text-[11.5px] leading-snug text-[var(--platform-muted)]">
                          {m.desc}
                        </div>
                        {m.note && active && (
                          <div className={cn("mt-1.5 text-[11.5px] leading-snug font-bold", m.text)}>
                            {m.note}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {f.authMode === "WHATSAPP_API" && (
                  <>
                    <Section label="WHATSAPP API (ARTHIX)" />
                    <div className="mb-2 grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
                      <Field label="ARTHIX_API_KEY">
                        <input
                          className="mafld"
                          type="password"
                          autoComplete="off"
                          value={f.waApiKey}
                          placeholder={
                            editing && apps.find((a) => a.id === editingId)?.integration?.apiKeyMask
                              ? `${apps.find((a) => a.id === editingId)?.integration?.apiKeyMask} — leave blank to keep`
                              : "Paste the API key"
                          }
                          onChange={(e) => setField("waApiKey", e.target.value)}
                        />
                      </Field>
                      <Field label="ARTHIX_FIRM_ID">
                        <input
                          className="mafld"
                          type="password"
                          autoComplete="off"
                          value={f.waFirmId}
                          placeholder={
                            editing && apps.find((a) => a.id === editingId)?.integration?.firmIdMask
                              ? `${apps.find((a) => a.id === editingId)?.integration?.firmIdMask} — leave blank to keep`
                              : "Paste the firm id"
                          }
                          onChange={(e) => setField("waFirmId", e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="mb-[18px]">
                      <Field label="Sender mobile number">
                        <PhoneField
                          variant="admin"
                          value={{ iso: f.waSenderIso, digits: f.waSenderMobile }}
                          onChange={(v) =>
                            setF((prev) => ({ ...prev, waSenderMobile: v.digits, waSenderIso: v.iso }))
                          }
                        />
                      </Field>
                      <p className="mt-2 text-[12px] font-semibold text-[var(--platform-muted)]">
                        Stored encrypted, per community — never in env, never shown to the community
                        admin. Until the ARTHIX endpoint is wired, messages still go out through the
                        admin&rsquo;s own WhatsApp tab and OTP stays on the dev code.
                      </p>
                    </div>
                  </>
                )}

                {!editing && f.type === "parivar" && (
                  <>
                    <Section label="LOCKED SURNAME (PARIVAR)" />
                    <div className="mb-[18px] grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
                      <Field label="Primary surname (English) *">
                        <input
                          className="mafld"
                          value={f.primarySurnameEn}
                          placeholder="e.g. Patel"
                          onChange={(e) => setField("primarySurnameEn", e.target.value)}
                        />
                      </Field>
                      <Field label="Primary surname (ગુજરાતી)">
                        <input
                          className="mafld"
                          value={f.primarySurnameGu}
                          placeholder="e.g. પટેલ"
                          onChange={(e) => setField("primarySurnameGu", e.target.value)}
                        />
                      </Field>
                    </div>
                    <p className="mb-[18px] text-[12px] font-semibold text-[var(--platform-muted)]">
                      Families can only use this surname. City masters are seeded automatically.
                    </p>
                  </>
                )}

                {!editing && f.type === "gam" && (
                  <>
                    <Section label="MAIN VILLAGE (GAM)" />
                    <div className="mb-[18px]">
                      <Field label="Primary village name">
                        <input
                          className="mafld"
                          value={f.village}
                          placeholder="e.g. Mota Zinzuda"
                          onChange={(e) => setField("village", e.target.value)}
                        />
                      </Field>
                      <p className="mt-1.5 text-[12px] font-semibold text-[var(--platform-muted)]">
                        Seeded as the first Village area. Surnames can be added later in Dropdown lists.
                      </p>
                    </div>
                  </>
                )}

                <Section label="BRAND COLORS" />
                <BrandColorsPicker
                  variant="platform"
                  primary={f.primary}
                  secondary={f.secondary}
                  onPrimaryChange={(c) => setField("primary", c)}
                  onSecondaryChange={(c) => setField("secondary", c)}
                  showPreview={false}
                  className="mb-[18px]"
                />

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
                  <div>🌐 Website: <HostLabel slug={sub} /></div>
                  <div>🛠 Admin: <HostLabel slug={sub} admin /></div>
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
                    <PhoneField
                      variant="admin"
                      value={{ iso: f.adminPhoneIso, digits: f.adminPhone }}
                      onChange={(v) =>
                        setF((prev) => ({ ...prev, adminPhone: v.digits, adminPhoneIso: v.iso }))
                      }
                    />
                  </Field>
                </div>
                <div className="mb-2 grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
                  <Field label="Username *">
                    <div className="flex gap-2">
                      <input
                        className="mafld flex-1"
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
                      <button
                        type="button"
                        onClick={genUsername}
                        className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border-[1.5px] border-[var(--line-input)] bg-white px-3 text-[12px] font-bold text-[var(--platform-muted)]"
                      >
                        <RefreshCw className="size-3.5" /> Generate
                      </button>
                    </div>
                    {usernameTaken(f.adminUsername) && (
                      <p className="mt-1.5 text-[11.5px] font-bold text-[var(--danger)]">
                        ⚠ This username already exists. Choose another one.
                      </p>
                    )}
                  </Field>
                  <Field label={editing ? "New password" : "Password *"}>
                    <div className="flex gap-2">
                      <div className="relative min-w-0 flex-1">
                        <input
                          className="mafld"
                          style={{ paddingRight: 38 }}
                          type={showAdminPassword ? "text" : "password"}
                          value={f.adminPassword}
                          placeholder={editing ? "Leave blank to keep current" : "Enter or generate"}
                          autoComplete="new-password"
                          onChange={(e) => setField("adminPassword", e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword((v) => !v)}
                          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-[var(--platform-muted)]"
                          aria-label={showAdminPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showAdminPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={genAdminPassword}
                        className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border-[1.5px] border-[var(--line-input)] bg-white px-3 text-[12px] font-bold text-[var(--platform-muted)]"
                      >
                        <RefreshCw className="size-3.5" /> Generate
                      </button>
                    </div>
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

      {deleting && (
        <DeleteAppModal
          app={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setApps((prev) => prev.filter((x) => x.id !== id));
            setDeleting(null);
            if (editingId === id) {
              setEditingId(null);
              setView("apps");
            }
          }}
        />
      )}

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
  // This modal only ever mounts after "Create community" succeeds — a client
  // action, never part of the server-rendered shell — so reading window here
  // carries no hydration-mismatch risk the way it would in an always-rendered
  // component. Same singleHost rule as openApp/openAdmin above: the handed-off
  // credentials must contain a URL that actually works from wherever the
  // platform admin is currently operating, tunnel included.
  const singleHost = isSingleHostBrowser();
  const siteUrl = singleHost
    ? `${window.location.origin}/?c=${encodeURIComponent(creds.slug)}`
    : communityUrl(creds.slug, "/");
  const adminUrl = singleHost
    ? `${window.location.origin}/admin?c=${encodeURIComponent(creds.slug)}`
    : communityAdminUrl(creds.slug, "/admin");
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

type DeleteImpact = Record<string, number>;

/** Rows in the order a platform admin cares about, with the label to print.
 * Keys must match the `impact` object returned by GET /api/platform/communities/[id]. */
const IMPACT_ROWS: { key: string; singular: string; plural?: string }[] = [
  { key: "families", singular: "family", plural: "families" },
  { key: "members", singular: "member" },
  { key: "users", singular: "login account" },
  { key: "surnameGroups", singular: "surname" },
  { key: "villageAreas", singular: "village area" },
  { key: "businesses", singular: "business listing" },
  { key: "news", singular: "news post" },
  { key: "galleryAlbums", singular: "gallery album" },
  { key: "advertisements", singular: "advertisement" },
  { key: "committees", singular: "committee" },
  { key: "resultDrives", singular: "result drive" },
  { key: "infoSections", singular: "info section" },
  { key: "cmsPages", singular: "CMS page" },
  { key: "dropdownOptions", singular: "dropdown option" },
  { key: "profileUpdateRequests", singular: "profile update request" },
];

/**
 * Delete confirmation for an entire app.
 *
 * Deleting a Community cascades through every table it owns and there is no
 * undo, so this does two things a plain yes/no cannot: it fetches and lists the
 * real row counts that are about to go, and it makes the admin type the
 * subdomain — the one string that is unique per app, so a muscle-memory
 * double-click on the wrong card cannot go through.
 */
function DeleteAppModal({
  app,
  onClose,
  onDeleted,
}: {
  app: ApiCommunity;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/platform/communities/${app.id}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (json.success) setImpact(json.data.impact as DeleteImpact);
        else setError(json.error || "Could not read what this delete would remove.");
      } catch {
        if (!cancelled) setError("Could not read what this delete would remove.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app.id]);

  const rows = impact ? IMPACT_ROWS.filter((r) => (impact[r.key] ?? 0) > 0) : [];
  const total = impact ? Object.values(impact).reduce((sum, n) => sum + n, 0) : 0;
  const matches = typed.trim() === app.slug;

  async function doDelete() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/platform/communities/${app.id}?confirm=${encodeURIComponent(app.slug)}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to delete app.");
        return;
      }
      onDeleted(app.id);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex size-11 items-center justify-center rounded-full bg-[var(--danger-tint-soft)]">
          <AlertTriangle className="size-6 text-[var(--danger)]" strokeWidth={2.3} />
        </div>
        <h3 className="mt-3 text-lg font-extrabold text-[var(--danger)]">
          Delete {app.nameGu || app.nameEn}?
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--platform-muted)]">
          This permanently deletes the app at{" "}
          <span className="font-bold text-[var(--platform-ink)]">
            <HostLabel slug={app.slug} />
          </span>{" "}
          and everything inside it. This cannot be undone.
        </p>

        <div className="mt-4 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-tint-soft)] p-4">
          <div className="mb-2.5 text-[11.5px] font-extrabold tracking-wide text-[var(--danger)]">
            THIS WILL ALSO BE DELETED
          </div>
          {!impact ? (
            <div className="flex items-center gap-2 py-2 text-[13px] text-[var(--platform-muted)]">
              <Loader2 className="size-4 animate-spin" /> Checking what this app holds…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-[13px] font-semibold text-[var(--platform-ink)]">
              This app is empty — no families, members, or content have been added yet.
            </p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {rows.map((r) => (
                  <li key={r.key} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="font-semibold text-[var(--platform-ink)]">
                      {plural(impact[r.key], r.singular, r.plural)}
                    </span>
                    <span className="font-mono font-extrabold text-[var(--danger)]">
                      {impact[r.key]}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 border-t border-[var(--danger-line)] pt-2 text-[12.5px] font-extrabold text-[var(--danger)]">
                {total} {plural(total, "record")} in total
              </div>
            </>
          )}
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-bold text-[var(--platform-muted)]">
            Type <span className="font-mono font-extrabold text-[var(--platform-ink)]">{app.slug}</span> to
            confirm
          </span>
          <input
            className="mafld font-mono"
            value={typed}
            autoComplete="off"
            spellCheck={false}
            placeholder={app.slug}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void doDelete();
            }}
          />
        </label>

        {error && (
          <div className="mt-3 rounded-[11px] border border-[var(--danger-line)] bg-[var(--danger-tint-soft)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--danger)]">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={doDelete}
            disabled={!matches || busy}
            className="inline-flex min-w-[150px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--danger)] px-4 py-3 text-[13px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="cursor-pointer rounded-xl border-[1.5px] border-[var(--line-input)] bg-white px-5 py-3 text-[13px] font-extrabold text-[var(--ink-mid)] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
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

function Section({ label, emphasis }: { label: string; emphasis?: boolean }) {
  return (
    <div
      className={cn(
        "mb-3 mt-1.5 font-extrabold tracking-wide text-[var(--platform-muted)]",
        emphasis ? "text-[15px] text-[var(--platform-ink)]" : "text-xs",
      )}
    >
      {label}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 text-xs font-bold text-[var(--platform-muted)]">{label}</div>
      {children}
    </div>
  );
}

/** Active/Deactive switch — status label above a toggle pill. */
function StatusToggle({
  active,
  busy,
  onToggle,
  className,
}: {
  active: boolean;
  busy?: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-row items-center gap-1.5 opacity-80", className)}>
      <span
        className={cn(
          "rounded-full px-2 py-px text-[9.5px] font-bold",
          active ? "bg-[var(--success-tint)] text-[var(--success)]" : "bg-[var(--danger-tint-soft)] text-[var(--danger)]",
        )}
      >
        {active ? "Active" : "Deactive"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={active ? "Deactivate app" : "Activate app"}
        disabled={busy}
        onClick={onToggle}
        className={cn(
          "relative h-[18px] w-8 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          active ? "bg-[#8FCFA6]" : "bg-[#D8D5CE]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform",
            active && "translate-x-[14px]",
          )}
        />
      </button>
    </div>
  );
}
