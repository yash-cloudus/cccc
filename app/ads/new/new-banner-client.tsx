"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { AD_DURATIONS, AD_DURATION_MONTHS, adDurationLabel, type AdDuration } from "@/lib/admin-settings";
import { ImageUpload } from "@/app/business/add/add-business-client";
import { AppSelect } from "@/components/ui/app-select";
import { bilingualLabel } from "@/components/forms/family-details-fields";
import { GooglePayIcon, PaytmIcon, PhonePeIcon } from "@/components/icons/payment-app-icons";
import { cn } from "@/lib/utils";

export type BusinessOption = {
  id: string;
  name: string;
  nameEn: string;
  nameGu: string | null;
  address: string;
  phone: string;
  isApproved: boolean;
  /** Paying upgrades this business's own ad — one banner per business. */
  bannerStatus: "none" | "pending" | "active";
};

type PaymentApp = {
  key: string;
  labelEn: string;
  labelGu: string;
  /** Official brand mark, when we have a licensed one — see components/icons/payment-app-icons.tsx. */
  Icon: React.ComponentType<{ className?: string }> | null;
  /** Fallback for apps with no available brand asset (BHIM has no entry in simple-icons). */
  mono?: string;
  /** Circle background behind the mark/mono. */
  badgeClass: string;
  /** Color of the mark/mono itself — apps whose real app-icon is a colour tile (PhonePe) get a
   * white mark on that colour; apps whose mark is a wordmark (GPay, Paytm) read better as their
   * natural brand colour on a plain white tile. */
  iconClass: string;
  iconSize: string;
  scheme: string;
  path: string;
};

/** Common (unofficial but widely used) custom URI schemes each app registers for UPI deep links. */
const PAYMENT_APPS: PaymentApp[] = [
  {
    key: "gpay",
    labelEn: "Pay with GPay",
    labelGu: "GPay થી ચૂકવો",
    Icon: GooglePayIcon,
    badgeClass: "bg-white border-[1.5px] border-[var(--line-soft)]",
    iconClass: "text-[#4285F4]",
    iconSize: "size-5",
    scheme: "tez",
    path: "upi/pay",
  },
  {
    key: "phonepe",
    labelEn: "Pay with PhonePe",
    labelGu: "PhonePe થી ચૂકવો",
    Icon: PhonePeIcon,
    badgeClass: "bg-[#5F259F]",
    iconClass: "text-white",
    iconSize: "size-[18px]",
    scheme: "phonepe",
    path: "pay",
  },
  {
    key: "paytm",
    labelEn: "Pay with Paytm",
    labelGu: "Paytm થી ચૂકવો",
    Icon: PaytmIcon,
    badgeClass: "bg-white border-[1.5px] border-[var(--line-soft)]",
    iconClass: "text-[#20336B]",
    iconSize: "size-5",
    scheme: "paytmmp",
    path: "pay",
  },
  {
    key: "bhim",
    labelEn: "Pay with BHIM",
    labelGu: "BHIM થી ચૂકવો",
    Icon: null,
    mono: "B",
    badgeClass: "bg-white border-[1.5px] border-[var(--line-soft)]",
    iconClass: "text-[#0B2C7A]",
    iconSize: "text-[13px] font-extrabold",
    scheme: "bhim",
    path: "pay",
  },
];

function appUpiLink(app: PaymentApp, upiId: string, payeeName: string, amount: number) {
  return `${app.scheme}://${app.path}?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`;
}

export function NewBannerClient({
  businesses,
  upiId,
  payeeName,
  tiers,
  defaultDuration,
}: {
  businesses: BusinessOption[];
  upiId: string;
  payeeName: string;
  /** Price for each plan, as currently configured in Admin → Settings. */
  tiers: Record<AdDuration, number>;
  defaultDuration: AdDuration;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const [imageUrl, setImageUrl] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [paymentProof, setPaymentProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<AdDuration>(defaultDuration);

  const business = businesses.find((b) => b.id === businessId) ?? null;
  const amount = tiers[plan];
  const duration = adDurationLabel(AD_DURATION_MONTHS[plan], T);

  const upiLink = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`
    : null;

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!upiLink) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(upiLink, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [upiLink]);

  async function submit() {
    if (!imageUrl) return toast.error(T("બેનર ઈમેજ અપલોડ કરો", "Upload the banner image"));
    if (!businessId) return toast.error(T("ધંધો પસંદ કરો", "Pick the linked business"));
    // Never let a member pay for a business that already holds a banner.
    if (business && business.bannerStatus !== "none") {
      return toast.error(
        T("આ ધંધા માટે બેનર પહેલેથી છે", "This business already has a banner"),
      );
    }
    if (!paymentProof) {
      return toast.error(T("ચૂકવણીનો સ્ક્રીનશોટ અપલોડ કરો", "Upload the payment screenshot"));
    }

    setBusy(true);
    const res = await api.post("/api/ads", {
      name: business?.name ?? T("બેનર", "Banner"),
      imageUrl,
      businessId,
      paymentProof,
      ownerMobile: business?.phone || undefined,
      months: AD_DURATION_MONTHS[plan],
    });
    setBusy(false);
    if (!res.ok) {
      return toast.error(res.issues?.map((i) => i.message).filter(Boolean).join(" · ") || res.error);
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
            onError={toast.error}
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
            <AppSelect
              value={businessId}
              onChange={setBusinessId}
              ariaLabel={T("ધંધો પસંદ કરો", "Pick your business")}
              options={[
                { value: "", label: T("તમારો ધંધો પસંદ કરો", "Pick your business") },
                ...businesses.map((b) => ({
                  value: b.id,
                  disabled: b.bannerStatus !== "none",
                  label: `${bilingualLabel(b.nameEn, b.nameGu)}${
                    b.bannerStatus === "active"
                      ? T(" — બેનર ચાલુ છે", " — banner already running")
                      : b.bannerStatus === "pending"
                        ? T(" — બેનર ચકાસણી બાકી", " — banner awaiting review")
                        : b.isApproved
                          ? ""
                          : T(" (મંજૂરી બાકી)", " (pending approval)")
                  }`,
                })),
              ]}
            />
          )}
        </Field>

        <Field label={`${T("સમયગાળો પસંદ કરો", "Choose a plan")} *`}>
          <div className="grid grid-cols-2 gap-2.5">
            {AD_DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPlan(d)}
                className={cn(
                  "rounded-[14px] border-[1.5px] px-3.5 py-3 text-left transition-colors",
                  plan === d
                    ? "border-[var(--brand)] bg-[var(--brand-tint)]"
                    : "border-[var(--line-soft)] bg-white",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-bold text-[var(--ink-mid)]">
                    {adDurationLabel(AD_DURATION_MONTHS[d], T)}
                  </span>
                  <span className="text-[15px] font-extrabold text-[var(--brand)]">
                    ₹{tiers[d].toLocaleString("en-IN")}
                  </span>
                </div>
              </button>
            ))}
          </div>
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
                `જાહેરાત મંજૂર થયા પછી ${duration} સુધી હોમ સ્ક્રીન પર દર્શાવવામાં આવશે.`,
                `Once approved it runs on the home screen for ${duration}.`,
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
              ({T(`${duration} માટે`, `for ${duration}`)})
            </span>
          </span>
        </div>

        <div className="mb-3 rounded-[16px] border border-[var(--line-soft)] bg-white p-4">
          <div className="mb-4 text-center text-[12.5px] font-extrabold text-[var(--brand)]">
            {T("QR સ્કેન કરીને UPI થી ચૂકવો", "Scan the QR to pay via UPI")}
          </div>
          {upiId ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col items-center text-center">
                {qrDataUrl && (
                  <div className="mb-3 rounded-[14px] border border-[var(--line-soft)] bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="UPI QR code" className="size-[168px]" />
                  </div>
                )}
                <div className="text-[14px] font-bold text-[var(--brand)]">{payeeName}</div>
              </div>

              <div className="flex flex-col items-center justify-center gap-3.5 sm:items-start">
                <div className="flex items-center gap-3">
                  {PAYMENT_APPS.map((appDef) => (
                    <a
                      key={appDef.key}
                      href={appUpiLink(appDef, upiId, payeeName, amount)}
                      aria-label={T(appDef.labelGu, appDef.labelEn)}
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95",
                        appDef.badgeClass,
                      )}
                    >
                      {appDef.Icon ? (
                        <appDef.Icon className={cn(appDef.iconSize, appDef.iconClass)} />
                      ) : (
                        <span className={cn(appDef.iconSize, appDef.iconClass)}>{appDef.mono}</span>
                      )}
                    </a>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(upiId);
                    toast.success(T("UPI ID કોપી થયું", "UPI ID copied"));
                  }}
                  className="flex items-center gap-1.5 text-[15px] font-bold tracking-wide text-[var(--brand)]"
                >
                  {upiId}
                  <Copy className="size-[15px]" strokeWidth={2.2} />
                </button>

                <span className="inline-block rounded-full bg-[#EEF1F6] px-3.5 py-1.5 text-[12px] font-bold text-[#4A5B72]">
                  {T("રકમ", "Amount")} ₹{amount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-center text-[12.5px] text-[var(--faint)]">
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
            onError={toast.error}
          />
        </Field>

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
