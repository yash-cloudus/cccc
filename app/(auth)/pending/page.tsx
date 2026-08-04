"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useLang } from "@/providers/lang-provider";
import { useCommunity } from "@/providers/community-provider";

export default function PendingPage() {
  const { t, lang } = useLang();
  const passwordLogin = useCommunity().authMode === "MOBILE_PASSWORD";
  const router = useRouter();

  const title = lang === "gu" ? "મંજૂરી બાકી છે" : "Approval Pending";
  // Password login has no WhatsApp channel — this community never sends that
  // notice, so promising it here would be a message that never arrives.
  const body = passwordLogin
    ? lang === "gu"
      ? "તમારી નોંધણી મળી ગઈ છે. 2 થી 3 દિવસમાં તમે તમારા નંબર અને પાસવર્ડથી લોગિન કરી શકશો. અને છતાં ના થાય તો તમારી કમિટીનો સંપર્ક કરવો."
      : "Your registration has been received. Within 2–3 days you'll be able to log in with your number and password. If you still can't, please contact your committee."
    : lang === "gu"
      ? "તમારા પરિવારની નોંધણી સમાજના એડમિન પાસે મંજૂરી માટે છે. મંજૂરી થતાં WhatsApp પર જાણ થશે."
      : "Your family registration is with the Samaj admin for approval. You will be notified on WhatsApp once approved.";

  return (
    <AppShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-[18px] px-[34px] py-10 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#F0DCA8] bg-[var(--warn-tint)] text-[var(--gold-dark)]"
        >
          <Clock className="h-[46px] w-[46px]" strokeWidth={1.7} />
        </motion.div>
        <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-[22px] font-bold text-[var(--ink)]">
          {title}
        </div>
        <p className="max-w-[280px] text-sm leading-relaxed text-[var(--ink-mid)]">{body || t("pendingBody")}</p>
        <div className="mt-1.5 w-full max-w-[280px]">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="flex h-[52px] w-full items-center justify-center rounded-2xl border-[1.5px] border-[var(--line-input)] bg-white text-[15px] font-extrabold text-[var(--ink-mid)]"
          >
            {t("goBack")}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
