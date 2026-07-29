"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/app-shell";
import { useLang } from "@/providers/lang-provider";
import { useCommunity } from "@/providers/community-provider";
import { mainAdminUrl, communityAdminUrl } from "@/lib/host";
import { HostLabel } from "@/components/host-label";
import { LangToggle } from "@/components/ui/lang-toggle";
import { toast } from "sonner";

export default function LoginPage() {
  const { t, lang } = useLang();
  const community = useCommunity();
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const brandName = lang === "gu" ? community.nameGu || community.nameEn : community.nameEn;

  // Member login only on {slug}.localhost / {slug}.community.in
  useEffect(() => {
    if (!community.slug) {
      window.location.replace(mainAdminUrl("/login"));
    }
  }, [community.slug]);

  if (!community.slug) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--platform-ink-deep)] p-6 text-center text-white">
        <div>
          <p className="text-sm text-[#B4B8C4]">Member login needs a community URL.</p>
          <a href={mainAdminUrl("/login")} className="mt-3 inline-block font-bold text-[var(--platform-bright)]">
            Go to Main Admin →
          </a>
        </div>
      </div>
    );
  }

  async function sendOtp(channel: "whatsapp" | "sms") {
    const digits = mobile.replace(/\D/g, "");
    if (digits.length !== 10) {
      toast.error(t("mobile") + " — 10 digits required");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/otp", {
        mobile: digits,
        channel,
        purpose: "login",
      });
      if (res.data?.success === false) throw new Error(res.data.error);
      if (res.data?.data?.pending) {
        router.push("/pending");
        return;
      }
      toast.success(res.data?.data?.message || "OTP sent");
      if (res.data?.data?.devCode) {
        toast.message(`Dev OTP: ${res.data.data.devCode}`, { duration: 10_000 });
      }
      router.push(`/otp?mobile=${digits}`);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; pending?: boolean } } };
      if (ax.response?.data?.pending) {
        router.push("/pending");
        return;
      }
      toast.error(ax.response?.data?.error || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  const displayMobile = mobile.replace(/\D/g, "").slice(0, 10);

  return (
    <AppShell>
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3.5 px-[30px] py-[34px] text-center"
        style={{
          background: "radial-gradient(120% 70% at 50% 0%,var(--brand-tint) 0%,var(--surface) 52%)",
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex h-[94px] w-[94px] items-center justify-center overflow-hidden rounded-[28px] border-[3px] border-[var(--samaj-gold)] text-[32px] font-bold text-white shadow-[0_16px_34px_-10px_rgb(var(--brand-rgb) / .6)]"
          style={{
            background: community.logoUrl
              ? "#fff"
              : `linear-gradient(135deg, ${community.primaryColor}, var(--samaj-primary-dark))`,
          }}
        >
          {community.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={community.logoUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="font-[family-name:var(--font-noto-serif-gujarati)]">
              {community.shortLogo || t("shortBrand")}
            </span>
          )}
        </motion.div>

        <div>
          <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-[22px] font-bold leading-tight text-[var(--ink)]">
            {brandName || t("samaj")}
          </div>
          <div className="mt-1 text-[12px] font-semibold text-[var(--faint-soft)]">
            <HostLabel slug={community.slug} />
          </div>
          <div className="mt-1.5 text-[13px] font-semibold text-[var(--faint)]">{t("memberLogin")}</div>
        </div>

        <div className="mt-2 w-full max-w-[310px] text-left">
          <div className="mb-1.5 text-xs font-bold text-[var(--ink-mid)]">{t("mobile")}</div>
          <div className="flex items-center gap-2.5 rounded-[15px] border-[1.5px] border-[var(--line-input)] bg-white p-[15px] text-[17px] font-bold text-[var(--ink)]">
            <span className="font-semibold text-[var(--faint)]">🇮🇳 +91</span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={displayMobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="98765 43210"
              className="min-w-0 flex-1 border-none bg-transparent text-[17px] font-bold outline-none"
            />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => sendOtp("whatsapp")}
            className="samaj-btn-wa mt-3 flex w-full items-center justify-center gap-2 px-4 py-4 text-[15px] disabled:opacity-60"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2.2A9.8 9.8 0 0 0 3.5 17L2.2 21.8l5-1.3A9.8 9.8 0 1 0 12 2.2Zm5.2 13.9c-.2.6-1.3 1.2-1.8 1.2s-1 .2-3.3-.7a11.3 11.3 0 0 1-4.6-4.1c-.3-.5-1-1.5-1-2.8 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.4-.1.7.5.8 1 1.4 1.7 1.8.5.4.9.5 1.2.2l.6-.6c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.3.1.3.1.6 0 .9Z" />
            </svg>
            {t("getOtpWa")}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => sendOtp("sms")}
            className="mt-3 w-full text-center text-[12.5px] font-medium text-[var(--faint)]"
          >
            {t("noWa")}{" "}
            <span className="font-bold text-[var(--brand)] underline">{t("smsOtp")}</span>
          </button>
        </div>

        <div className="mt-2 w-full max-w-[310px] border-t border-dashed border-[var(--line-input)] pt-[18px]">
          <div className="mb-2.5 text-[13px] font-semibold text-[var(--ink-mid)]">{t("newFamily")}</div>
          <Link
            href="/register"
            className="block rounded-[15px] border-[1.5px] border-[var(--brand-line)] bg-white px-4 py-[15px] text-center text-[14.5px] font-extrabold text-[var(--brand)]"
          >
            {t("regForm")}
          </Link>
          <div className="mt-3.5 flex justify-center gap-4 text-[11.5px] font-bold">
            <a
              href={community.slug ? communityAdminUrl(community.slug, "/admin/login") : "/admin/login"}
              className="text-[var(--platform-muted)] hover:text-[var(--brand)]"
            >
              {lang === "gu" ? "એડમિન પેનલ" : "Admin Panel"}
            </a>
            <a href={mainAdminUrl("/login")} className="text-[var(--platform-bright)] hover:underline">
              {lang === "gu" ? "મુખ્ય એડમિન" : "Main Admin"}
            </a>
          </div>
          <LangToggle className="mx-auto mt-5 w-fit" />
        </div>
      </div>
    </AppShell>
  );
}
