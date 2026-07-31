"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAdminT } from "@/lib/i18n/admin-dictionary";

type Branding = {
  slug: string;
  nameEn: string;
  nameGu: string | null;
  logoText: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, lang } = useAdminT();
  const [brand, setBrand] = useState<Branding | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/community/current", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.success && setBrand(j.data.community))
      .catch(() => {});
  }, []);

  const primary = brand?.primaryColor || "#A62A38";
  const secondary = brand?.secondaryColor || "#E8A33D";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, slug: brand?.slug }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || t("login.failed"));
        return;
      }
      router.push(params.get("next") || "/admin");
      router.refresh();
    } catch {
      setError(t("login.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-dvh items-center justify-center p-4 font-[family-name:var(--font-manrope),var(--font-noto-sans-gujarati),sans-serif]"
      style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <span
            className="flex size-11 items-center justify-center overflow-hidden rounded-[13px] border-2 font-[family-name:var(--font-noto-serif-gujarati)] text-lg font-bold text-white"
            style={{ background: primary, borderColor: secondary }}
          >
            {brand?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              brand?.logoText || brand?.nameEn?.charAt(0) || "?"
            )}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-extrabold text-[var(--ink)]">
              {(lang === "en"
                ? brand?.nameEn || brand?.nameGu
                : brand?.nameGu || brand?.nameEn) || t("login.communityAdmin")}
            </div>
            <div className="text-[11.5px] font-semibold text-[var(--faint)]">{t("login.panel")}</div>
          </div>
        </div>

        <h1 className="text-xl font-extrabold text-[var(--ink)]">{t("login.title")}</h1>
        <p className="mt-1 text-[13px] text-[var(--faint)]">{t("login.subtitle")}</p>

        {error && (
          <div className="mt-4 rounded-[11px] border border-[var(--danger-line)] bg-[var(--danger-tint-soft)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--danger)]">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-3.5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[var(--muted)]">
              {t("login.username")}
            </span>
            <input
              className="mafld"
              value={username}
              autoFocus
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              placeholder="community_admin"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[var(--muted)]">
              {t("login.password")}
            </span>
            <div className="relative">
              <input
                className="mafld"
                style={{ paddingRight: 40 }}
                type={showPassword ? "text" : "password"}
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--faint)]"
                aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </div>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[14px] font-extrabold text-white disabled:opacity-70"
            style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
          >
            {loading && <Loader2 className="size-[18px] animate-spin" />}
            {t("login.signIn")}
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-[var(--faint)]">
          {t("login.memberNote")}{" "}
          <a href="/login" className="font-bold" style={{ color: primary }}>
            {t("login.mainApp")}
          </a>
          {t("login.memberNoteEnd")}
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
