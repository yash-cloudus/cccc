"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { motion } from "framer-motion";
import { PhoneShell } from "@/components/layout/phone-shell";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { formatMobile } from "@/lib/format";
import { toast } from "sonner";

const OTP_LEN = Math.max(4, Math.min(8, Number(process.env.NEXT_PUBLIC_OTP_LENGTH || 4)));
const DEV_HINT =
  process.env.NEXT_PUBLIC_OTP_DEV_MODE === "true"
    ? process.env.NEXT_PUBLIC_OTP_DEV_CODE || "1234"
    : null;

function OtpForm() {
  const { t, lang } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const mobile = params.get("mobile") || "9876543210";
  const empty = useMemo(() => Array.from({ length: OTP_LEN }, () => ""), []);
  const [otp, setOtp] = useState(empty);
  const [left, setLeft] = useState(42);
  const [loading, setLoading] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (DEV_HINT) toast.message(`Dev OTP: ${DEV_HINT}`, { duration: 8000 });
  }, []);

  const onOtp = useCallback(
    (i: number, val: string) => {
      const digit = val.replace(/\D/g, "").slice(-1);
      setOtp((prev) => {
        const next = [...prev];
        next[i] = digit;
        return next;
      });
      if (digit && i < OTP_LEN - 1) refs.current[i + 1]?.focus();
    },
    [],
  );

  async function resendSms() {
    try {
      const res = await axios.post("/api/auth/otp", { mobile, channel: "sms", purpose: "login" });
      setLeft(42);
      const code = res.data?.data?.devCode;
      toast.success(code ? `OTP sent (dev: ${code})` : "OTP sent via SMS");
    } catch {
      toast.error("Failed to resend OTP");
    }
  }

  async function login() {
    const code = otp.join("");
    if (code.length !== OTP_LEN) {
      toast.error(t("enterOtp"));
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/verify", { mobile, code });
      if (res.data?.success === false) throw new Error(res.data.error);
      router.push("/dashboard");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  const title = lang === "gu" ? "OTP ચકાસણી" : "OTP Verification";
  const sentTo = lang === "gu" ? "આ નંબર પર મોકલેલ" : "Sent to this number";
  const enterCode =
    lang === "gu" ? `${OTP_LEN} અંક નો કોડ નાખો` : `Enter the ${OTP_LEN}-digit code`;
  const resendLabel = lang === "gu" ? "ફરી મોકલો" : "Resend in";
  const viaSms = lang === "gu" ? "SMS થી મોકલો" : "Send via SMS";
  const seePending =
    lang === "gu" ? "pending-approval સ્થિતિ જુઓ →" : "See pending-approval status →";

  return (
    <PhoneShell>
      <BackHeader title={title} onBack={() => router.push("/login")} />
      <div className="flex flex-1 flex-col items-center justify-center gap-[22px] px-[30px] py-[30px] text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex h-[70px] w-[70px] items-center justify-center rounded-[22px] bg-[var(--success-tint)] text-[var(--wa-dark)]"
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2.2A9.8 9.8 0 0 0 3.5 17L2.2 21.8l5-1.3A9.8 9.8 0 1 0 12 2.2Z" />
          </svg>
        </motion.div>

        <div className="text-[14.5px] leading-relaxed text-[var(--ink-mid)]">
          {sentTo}
          <br />
          <b className="text-base text-[var(--ink)]">{formatMobile(mobile)}</b>
          <br />
          {enterCode}
          {DEV_HINT && (
            <>
              <br />
              <span className="mt-1 inline-block text-[12px] font-bold text-[var(--wa-dark)]">
                Dev mode OTP: {DEV_HINT}
              </span>
            </>
          )}
        </div>

        <div className="flex justify-center gap-2">
          {otp.map((val, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={val}
              onChange={(e) => onOtp(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus();
              }}
              maxLength={1}
              inputMode="numeric"
              className="h-14 w-[46px] rounded-[15px] border-[1.5px] border-[var(--line-input)] bg-white text-center text-2xl font-extrabold text-[var(--ink)] outline-none caret-[var(--brand)] focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_rgb(var(--brand-rgb) / .12)]"
            />
          ))}
        </div>

        <div className="text-[12.5px] font-medium text-[var(--faint)]">
          {resendLabel}{" "}
          <b className="text-[var(--ink-mid)]">00:{String(left).padStart(2, "0")}</b> ·{" "}
          <button type="button" onClick={resendSms} className="cursor-pointer text-[var(--brand)] underline">
            {viaSms}
          </button>
        </div>

        <div className="w-full max-w-[300px]">
          <button
            type="button"
            disabled={loading}
            onClick={login}
            className="flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-extrabold text-white shadow-[0_12px_24px_-10px_rgb(var(--brand-rgb) / .6)] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,var(--brand),var(--brand-dark))" }}
          >
            {t("login")}
          </button>
        </div>

        <Link href="/pending" className="text-xs text-[#B7B1A6] underline">
          {seePending}
        </Link>
      </div>
    </PhoneShell>
  );
}

export default function OtpPage() {
  return (
    <Suspense>
      <OtpForm />
    </Suspense>
  );
}
