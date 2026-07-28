"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Info, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { BANNER_PRICE_INR } from "@/lib/constants";
import { ImageUpload } from "@/app/business/add/add-business-client";
import { cn } from "@/lib/utils";

export type BusinessOption = {
  id: string;
  name: string;
  address: string;
  phone: string;
  isApproved: boolean;
};

export function NewBannerClient({
  businesses,
  upiId,
  payeeName,
}: {
  businesses: BusinessOption[];
  upiId: string;
  payeeName: string;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const [imageUrl, setImageUrl] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [paymentProof, setPaymentProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const business = businesses.find((b) => b.id === businessId) ?? null;
  const amount = BANNER_PRICE_INR;

  // ponytail: UPI deep link rather than a rendered QR — no encoder dependency,
  // and it opens the payment app directly on the phone running the app. Set a
  // `upiQrUrl` community setting to also show a scannable image.
  const upiLink = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`
    : null;

  async function submit() {
    if (!imageUrl) return setError(T("બેનર ઈમેજ અપલોડ કરો", "Upload the banner image"));
    if (!businessId) return setError(T("ધંધો પસંદ કરો", "Pick the linked business"));
    if (!paymentProof) {
      return setError(T("ચૂકવણીનો સ્ક્રીનશોટ અપલોડ કરો", "Upload the payment screenshot"));
    }

    setBusy(true);
    setError(null);
    const res = await api.post("/api/ads", {
      name: business?.name ?? T("બેનર", "Banner"),
      imageUrl,
      businessId,
      paymentProof,
      ownerMobile: business?.phone || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      return setError(res.issues?.map((i) => i.message).filter(Boolean).join(" · ") || res.error);
    }
    toast.success(T("બેનર મોકલાયું — એડમિન ચકાસશે", "Banner submitted — admin will review"));
    router.push("/ads");
    router.refresh();
  }

  return (
    <AppScreen showNav={false}>
      <BackHeader title={T("નવું બેનર ઉમેરો", "Add a new banner")} />

      <div className="px-4 py-4 pb-8">
        <Field label={`${T("બેનર ઈમેજ", "Banner image")} *`}>
          <ImageUpload
            value={imageUrl}
            onChange={setImageUrl}
            folder="ad-banners"
            label={T("બેનર ઈમેજ અપલોડ કરો", "Upload banner image")}
            hint={T("ભલામણ માપ: 1200 × 600px", "Recommended size: 1200 × 600px")}
            onError={setError}
          />
        </Field>

        <Field
          label={`${T("ધંધા સાથે લિંક કરો", "Link to a business")} *`}
          hint={T(
            "સંપર્ક, સરનામું, ફોન — લિંક કરેલ ધંધામાંથી આપોઆપ આવે.",
            "Contact, address and phone come from the linked business.",
          )}
        >
          {businesses.length === 0 ? (
            <button
              type="button"
              onClick={() => router.push("/business/add")}
              className="w-full rounded-[13px] border-[1.5px] border-dashed border-[var(--brand-line)] bg-[var(--brand-tint)] px-4 py-4 text-[13px] font-bold text-[var(--brand)]"
            >
              {T("પહેલા ધંધો ઉમેરો →", "Add a business first →")}
            </button>
          ) : (
            <select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              className="w-full rounded-[13px] border-[1.5px] border-[var(--line-input)] bg-white px-3.5 py-3 text-[14px] font-semibold text-[var(--ink)] outline-none"
            >
              <option value="">{T("તમારો ધંધો પસંદ કરો", "Pick your business")}</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.isApproved ? "" : T(" (મંજૂરી બાકી)", " (pending approval)")}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="mb-3 rounded-[14px] border border-[#C9DDF0] bg-[#F1F7FD] p-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-extrabold text-[#2B5F92]">
            <Info className="size-4" strokeWidth={2.2} />
            {T("નોંધ", "Note")}
          </div>
          <p className="text-[12px] leading-relaxed text-[#3C5A78]">
            {T(
              "તમે સબમિટ કરેલી બેનર જાહેરાત એડમિન દ્વારા ચકાસણી અને મંજૂરી (Approval) બાદ જ એપ્લિકેશનના હોમ સ્ક્રીન પર દર્શાવવામાં આવશે.",
              "Your banner appears on the app home screen only after an admin verifies and approves it.",
            )}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11.5px] leading-relaxed text-[#3C5A78]">
            <li>
              {T(
                "જાહેરાત મંજૂર થયા પછી 1 વર્ષ સુધી હોમ સ્ક્રીન પર દર્શાવવામાં આવશે.",
                "Once approved it runs on the home screen for one year.",
              )}
            </li>
            <li>
              {T(
                "જાહેરાત મંજૂર ન થાય તો તેનું કારણ તમને એપ્લિકેશનમાં બતાવવામાં આવશે.",
                "If it is rejected, the reason is shown to you in the app.",
              )}
            </li>
          </ul>
        </div>

        <div className="mb-3 flex items-center justify-between rounded-[14px] border border-[var(--line-soft)] bg-white px-3.5 py-3">
          <span className="text-[12.5px] font-bold text-[var(--faint)]">
            {T("ચાર્જ", "Charge")}
          </span>
          <span className="text-[14px] font-extrabold text-[var(--brand)]">
            ₹{amount.toLocaleString("en-IN")}{" "}
            <span className="text-[11.5px] font-semibold text-[var(--faint)]">
              ({T("1 વર્ષ માટે", "for 1 year")})
            </span>
          </span>
        </div>

        <div className="mb-3 rounded-[16px] border border-[var(--line-soft)] bg-white p-4 text-center">
          <div className="mb-3 text-[12.5px] font-extrabold text-[var(--brand)]">
            {T("UPI થી ચૂકવણી કરો", "Pay via UPI")}
          </div>
          {upiId ? (
            <>
              <div className="text-[14px] font-bold text-[var(--ink)]">{payeeName}</div>
              <div className="mt-0.5 font-mono text-[12.5px] text-[var(--faint)]">{upiId}</div>
              <span className="mt-2.5 inline-block rounded-lg bg-[#EEF1F6] px-3 py-1 text-[12px] font-bold text-[#4A5B72]">
                {T("રકમ", "Amount")} ₹{amount.toLocaleString("en-IN")}
              </span>
              <a
                href={upiLink!}
                className="samaj-btn mt-3 flex w-full items-center justify-center gap-2 py-3.5 text-[14px]"
              >
                <Wallet className="size-[18px]" strokeWidth={2.1} />
                {T("UPI એપ ખોલો", "Open UPI app")}
              </a>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(upiId);
                  toast.success(T("UPI ID કોપી થયું", "UPI ID copied"));
                }}
                className="mt-2 text-[12px] font-bold text-[var(--brand)] underline"
              >
                {T("UPI ID કોપી કરો", "Copy UPI ID")}
              </button>
            </>
          ) : (
            <p className="text-[12.5px] text-[var(--faint)]">
              {T(
                "સમાજે હજુ UPI ID સેટ કરી નથી — એડમિનનો સંપર્ક કરો.",
                "The community has not set a UPI ID yet — contact an admin.",
              )}
            </p>
          )}
        </div>

        <Field label={`${T("ચૂકવણીનો સ્ક્રીનશોટ", "Payment screenshot")} *`}>
          <ImageUpload
            value={paymentProof}
            onChange={setPaymentProof}
            folder="ad-payments"
            label={T("સ્ક્રીનશોટ અપલોડ કરો", "Upload screenshot")}
            hint={T("UPI પેમેન્ટ સફળ થયાનો ફોટો", "Photo of the successful UPI payment")}
            onError={setError}
          />
        </Field>

        {error && <p className="mb-3 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className={cn(
            "samaj-btn flex w-full items-center justify-center gap-2 py-4 text-[15.5px]",
            busy && "opacity-60",
          )}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <Check className="size-5" strokeWidth={2.3} />
              {T(
                `ચૂકવણી કરો ₹${amount.toLocaleString("en-IN")}`,
                `Submit payment ₹${amount.toLocaleString("en-IN")}`,
              )}
            </>
          )}
        </button>
      </div>
    </AppScreen>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[12px] font-bold text-[var(--ink-mid)]">{label}</div>
      {children}
      {hint && (
        <p className="mt-1.5 rounded-[11px] border border-[var(--gold-border)] bg-[var(--gold-tint)] px-3 py-2 text-[11.5px] leading-relaxed text-[#7A4E10]">
          {hint}
        </p>
      )}
    </div>
  );
}
