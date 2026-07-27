"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useLang } from "@/providers/lang-provider";

export default function PendingPage() {
  const { t, lang } = useLang();
  const router = useRouter();

  const title = lang === "gu" ? "મંજૂરી બાકી છે" : "Approval Pending";
  const body =
    lang === "gu"
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
