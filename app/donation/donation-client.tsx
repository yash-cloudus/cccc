"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Heart, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { AppScreen } from "@/components/layout/app-screen";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { pickText, telLink } from "@/lib/format";
import { cn } from "@/lib/utils";

const PRESETS = [501, 1100, 2100, 5100, 11000, 21000];

export function DonationClient({
  communityNameEn,
  communityNameGu,
  upiId,
  contactPhone,
}: {
  communityNameEn: string;
  communityNameGu: string | null;
  upiId: string | null;
  contactPhone: string | null;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);
  const name = pickText(communityNameGu, communityNameEn, lang);

  const [amount, setAmount] = useState<number>(1100);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  const effective = custom ? Number(custom) : amount;

  async function pay() {
    if (!effective || effective <= 0) {
      toast.error(T("રકમ પસંદ કરો", "Choose an amount"));
      return;
    }
    setBusy(true);
    const res = await api.post("/api/donations", {
      amount: effective,
      note: `Donation to ${communityNameEn}`,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (upiId) {
      const url = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
        communityNameEn,
      )}&am=${effective}&cu=INR&tn=${encodeURIComponent("Donation")}`;
      window.location.href = url;
      toast.success(T("UPI એપ ખૂલી રહી છે…", "Opening UPI app…"));
    } else {
      toast.success(
        T("દાનની નોંધ થઈ. સમાજ સંપર્ક કરશે.", "Donation recorded. The community will reach out."),
      );
    }
  }

  return (
    <AppScreen showNav={false}>
      <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-[18px] pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/14">
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </button>
          <div className="flex-1 font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold">
            {T("દાન આપો", "Donate")}
          </div>
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/12">
            <Heart className="h-[21px] w-[21px]" strokeWidth={1.7} />
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-8">
        <p className="mb-4 text-[14px] leading-relaxed text-[#57524A]">
          {T(
            `${name}ને આપેલું આપનું યોગદાન સમાજના કલ્યાણ કાર્યોમાં વપરાશે.`,
            `Your contribution to ${name} supports the community's welfare initiatives.`,
          )}
        </p>

        {upiId ? (
          <div className="samaj-card mb-4 flex flex-col items-center p-6">
            <div className="mb-4 flex h-[200px] w-[200px] items-center justify-center rounded-[20px] border-2 border-dashed border-[#E1DACC] bg-[#FCFAF6] text-[#938C80]">
              <div className="text-center">
                <QrCode className="mx-auto h-16 w-16 text-[#A62A38]" strokeWidth={1.4} />
                <div className="mt-2 text-xs font-bold">UPI</div>
                <div className="mt-1 text-[11px]">{upiId}</div>
              </div>
            </div>
            <div className="text-sm font-bold text-[#2A2320]">{upiId}</div>
          </div>
        ) : (
          <div className="mb-4 rounded-[14px] border border-[#EFE3CB] bg-[#FDF9F0] p-3.5 text-xs leading-relaxed text-[#8B7A55]">
            {T(
              "UPI હજુ સેટ થયું નથી. દાનની નોંધ થશે અને સમાજ આપનો સંપર્ક કરશે.",
              "UPI is not configured yet. Your donation will be recorded and the community will contact you.",
            )}
            {contactPhone && (
              <a href={telLink(contactPhone)} className="mt-2 block font-bold text-[#A62A38]">
                {T("સંપર્ક કરો", "Contact")}: {contactPhone}
              </a>
            )}
          </div>
        )}

        <div className="mb-3 text-xs font-extrabold tracking-wide text-[#8B8375]">
          {T("રકમ પસંદ કરો", "CHOOSE AMOUNT")}
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {PRESETS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAmount(a);
                setCustom("");
              }}
              className={cn(
                "rounded-[14px] border py-3 text-sm font-extrabold transition",
                !custom && amount === a
                  ? "border-[#A62A38] bg-[#FBEDEE] text-[#A62A38]"
                  : "border-[#F0E9DB] bg-white text-[#57524A]",
              )}
            >
              ₹{a.toLocaleString("en-IN")}
            </button>
          ))}
        </div>

        <input
          className="samaj-fld mb-4"
          placeholder={T("અન્ય રકમ", "Other amount")}
          value={custom}
          inputMode="numeric"
          onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
        />

        <button
          type="button"
          onClick={pay}
          disabled={busy}
          className="flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-extrabold text-white shadow-[0_12px_24px_-10px_rgba(166,42,56,.6)] disabled:opacity-70"
          style={{ background: "linear-gradient(135deg,#A62A38,#851F2B)" }}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : upiId ? (
            T(`₹${effective.toLocaleString("en-IN")} UPI થી ચૂકવો`, `Pay ₹${effective.toLocaleString("en-IN")} via UPI`)
          ) : (
            T(`₹${effective.toLocaleString("en-IN")} દાન નોંધાવો`, `Pledge ₹${effective.toLocaleString("en-IN")}`)
          )}
        </button>
      </div>
    </AppScreen>
  );
}
