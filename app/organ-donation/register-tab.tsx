"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { PhoneField, type PhoneValue } from "@/components/ui/phone-field";
import { PickerWithAdd } from "@/components/ui/picker-with-add";
import { api } from "@/lib/http";
import { formatDateDMY, pickText } from "@/lib/format";
import {
  DONATION_TYPES,
  ORGAN_TYPES,
  ageFrom,
  donationTypeLabel,
  organLabel,
  type OrganDonationType,
  type OrganType,
} from "@/lib/organ-donation";
import type { Lang } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import { Empty, FIELD, Label, OrganTypePicker, PrimaryBtn } from "./organ-ui";

export type FamilyMemberOption = {
  id: string;
  fullNameEn: string;
  fullNameGu: string | null;
  relation: string | null;
  gender: "MALE" | "FEMALE" | null;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  mobile: string | null;
  mobileIso: string;
  /** Already has a donor record — offered but not selectable. */
  alreadyRegistered: boolean;
};

const STEPS = [
  { gu: "સભ્ય", en: "Member" },
  { gu: "અંગ", en: "Organs" },
  { gu: "ઇમરજન્સી", en: "Emergency" },
  { gu: "સંમતિ", en: "Consent" },
] as const;

/**
 * Option 3 — the registration form.
 *
 * Personal details are picked, not typed: every field the form needs already
 * exists on the member's directory row, so asking again would only create a
 * second version of the same facts that could disagree with the first.
 */
export function RegisterTab({
  members,
  canAdd,
  signedIn,
  lang,
  T,
  onDone,
}: {
  members: FamilyMemberOption[];
  canAdd: boolean;
  signedIn: boolean;
  lang: Lang;
  T: (gu: string, en: string) => string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [memberId, setMemberId] = useState("");
  // Organ → when it may be taken. A Map, not a Set plus one shared type: the
  // whole point of this step is that a member can answer differently per organ.
  const [organs, setOrgans] = useState<Map<OrganType, OrganDonationType>>(new Map());
  const [emName, setEmName] = useState("");
  const [emRelation, setEmRelation] = useState("");
  const [emPhone, setEmPhone] = useState<PhoneValue>({ iso: "in", digits: "" });
  const [consent, setConsent] = useState(false);
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);

  const member = useMemo(() => members.find((m) => m.id === memberId) ?? null, [members, memberId]);

  const options = useMemo(
    () =>
      members.map((m) => ({
        value: m.id,
        label: pickText(m.fullNameGu, m.fullNameEn, lang),
        right: m.relation || undefined,
        tag: m.alreadyRegistered ? T("પહેલેથી નોંધાયેલ", "already registered") : undefined,
      })),
    [members, lang, T],
  );

  if (!signedIn) {
    return <Empty>{T("ફોર્મ ભરવા લોગિન કરો.", "Log in to fill this form.")}</Empty>;
  }
  if (!canAdd) {
    return (
      <Empty>
        {T("અત્યારે નવી નોંધ ઉમેરી શકાતી નથી.", "New registrations are turned off right now.")}
      </Empty>
    );
  }
  if (members.length === 0) {
    return (
      <Empty>
        {T(
          "તમારા પરિવારના સભ્યો મળ્યા નથી. પહેલા પરિવારની નોંધણી મંજૂર થવી જોઈએ.",
          "No family members found. Your family registration must be approved first.",
        )}
      </Empty>
    );
  }

  /** Tick / untick an organ. A newly ticked one starts on BOTH — the widest
   *  answer, which the member then narrows if they mean something stricter. */
  function toggleOrgan(organ: OrganType) {
    setOrgans((prev) => {
      const next = new Map(prev);
      if (next.has(organ)) next.delete(organ);
      else next.set(organ, "BOTH");
      return next;
    });
  }

  function setOrganType(organ: OrganType, type: OrganDonationType) {
    setOrgans((prev) => new Map(prev).set(organ, type));
  }

  function next() {
    if (step === 0) {
      if (!member) return toast.error(T("સભ્ય પસંદ કરો", "Select a member"));
      if (member.alreadyRegistered) {
        return toast.error(
          T("આ સભ્ય પહેલેથી નોંધાયેલ છે", "This member is already registered as a donor"),
        );
      }
    }
    if (step === 1 && organs.size === 0) {
      return toast.error(T("ઓછામાં ઓછું એક અંગ પસંદ કરો", "Select at least one organ"));
    }
    if (step === 2) {
      if (emName.trim().length < 2) {
        return toast.error(T("ઇમરજન્સી સંપર્કનું નામ લખો", "Enter the emergency contact name"));
      }
      if (emPhone.digits.length < 6) {
        return toast.error(T("ઇમરજન્સી મોબાઇલ નંબર લખો", "Enter the emergency mobile number"));
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    if (!member) return;
    if (!consent) {
      return toast.error(T("સંમતિ સ્વીકારો", "Accept the consent statement"));
    }
    if (signature.trim().length < 2) {
      return toast.error(T("પૂરું નામ લખો", "Type your full name"));
    }
    setBusy(true);
    const res = await api.post("/api/organ-donation", {
      familyMemberId: member.id,
      organs: Array.from(organs, ([organ, donationType]) => ({ organ, donationType })),
      emergencyName: emName.trim(),
      emergencyRelation: emRelation.trim() || undefined,
      emergencyMobile: emPhone.digits,
      emergencyMobileIso: emPhone.iso,
      consentAccepted: true,
      consentSignature: signature.trim(),
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(T("નોંધણી થઈ ગઈ — આભાર 🙏", "Registered — thank you 🙏"));
    onDone();
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s.en} className="flex flex-1 items-center gap-1.5">
            <div
              className={cn(
                "flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11.5px] font-extrabold",
                i < step
                  ? "bg-[var(--success)] text-white"
                  : i === step
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[#F1EBDE] text-[#A79C88]",
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-[2px] flex-1 rounded-full",
                  i < step ? "bg-[var(--success)]" : "bg-[#F1EBDE]",
                )}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mb-1 text-[13px] font-extrabold text-[var(--ink)]">
        {T(STEPS[step].gu, STEPS[step].en)}
      </div>

      {step === 0 && (
        <>
          <Label>{T("કયા સભ્ય અંગદાન કરે છે?", "Which member is donating?")}</Label>
          <PickerWithAdd
            value={memberId}
            onChange={setMemberId}
            options={[{ value: "", label: T("સભ્ય પસંદ કરો", "Select a member") }, ...options]}
            placeholder={T("સભ્ય પસંદ કરો", "Select a member")}
            t={T}
            syncKey="organ-member"
            className="[&_button]:h-12 [&_button]:rounded-[13px] [&_button]:border-[#EDE4D4] [&_button]:bg-[#FCFAF6] [&_button]:text-[14px]"
          />

          {member && (
            <div className="mt-3 rounded-[14px] border border-[#F0E9DB] bg-[#FCFAF6] p-3.5">
              <div className="mb-1.5 text-[11.5px] font-bold text-[#A79C88]">
                {T("ડિરેક્ટરીમાંથી આપોઆપ", "Filled automatically from the directory")}
              </div>
              <dl className="grid grid-cols-2 gap-y-2">
                {(
                  [
                    [T("સંબંધ", "Relation"), member.relation],
                    [
                      T("જન્મ તારીખ", "Date of birth"),
                      member.dateOfBirth ? formatDateDMY(member.dateOfBirth) : null,
                    ],
                    [T("ઉંમર", "Age"), ageFrom(member.dateOfBirth)?.toString() ?? null],
                    [
                      T("બ્લડ ગ્રુપ", "Blood group"),
                      member.bloodGroup?.replace("_POS", "+").replace("_NEG", "-") ?? null,
                    ],
                    [
                      T("લિંગ", "Gender"),
                      member.gender === "MALE"
                        ? T("પુરુષ", "Male")
                        : member.gender === "FEMALE"
                          ? T("સ્ત્રી", "Female")
                          : null,
                    ],
                    [T("મોબાઇલ", "Mobile"), member.mobile],
                  ] as [string, string | null][]
                ).map(([label, value]) =>
                  value ? (
                    <div key={label}>
                      <dt className="text-[11px] font-bold text-[#A79C88]">{label}</dt>
                      <dd className="text-[13px] font-bold text-[var(--ink)]">{value}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <Label>{T("કયા અંગ દાન કરવા છે?", "Which organs are being pledged?")}</Label>
          <p className="mb-2 text-[11.5px] leading-relaxed text-[#A79C88]">
            {T(
              "દરેક અંગ માટે અલગ પસંદગી કરી શકો છો — દા.ત. કિડની જીવતાં, આંખ મૃત્યુ પછી.",
              "Each organ can be answered differently — e.g. a kidney while living, eyes only after death.",
            )}
          </p>

          <OrganTypePicker
            selected={organs}
            onToggle={toggleOrgan}
            onSetType={setOrganType}
            lang={lang}
            T={T}
          />

          <button
            type="button"
            onClick={() =>
              setOrgans((prev) =>
                prev.size === ORGAN_TYPES.length
                  ? new Map()
                  : new Map(ORGAN_TYPES.map((o) => [o, prev.get(o) ?? "BOTH"])),
              )
            }
            className="mt-3 flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[13px] border-[1.5px] border-[var(--brand-line)] bg-white text-[12.5px] font-extrabold text-[var(--brand)] sm:w-auto sm:px-4"
          >
            {organs.size === ORGAN_TYPES.length ? (
              <X className="h-3.5 w-3.5" strokeWidth={3} />
            ) : (
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            )}
            {organs.size === ORGAN_TYPES.length
              ? T("બધું હટાવો", "Clear all")
              : T("બધા અંગ પસંદ કરો", "Select all organs")}
          </button>

          {organs.size > 0 && (
            <p className="mt-3 rounded-[13px] bg-[#FDF9F0] p-3 text-[11.5px] leading-relaxed text-[#8B7A55]">
              {T(
                "‘મૃત્યુ પછી’ વાળા અંગ માટે અત્યારે કોઈ વિનંતી નહીં કરી શકે — પરિવાર સમય આવ્યે જાણ કરશે.",
                "Organs marked “After death” cannot be requested now — the family reports it when the time comes.",
              )}
            </p>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <Label>{T("સંપર્કનું નામ", "Contact name")}</Label>
          <input value={emName} onChange={(e) => setEmName(e.target.value)} className={FIELD} />

          <Label>{T("સંબંધ", "Relation")}</Label>
          <input
            value={emRelation}
            onChange={(e) => setEmRelation(e.target.value)}
            className={FIELD}
          />

          <Label>{T("મોબાઇલ નંબર", "Mobile number")}</Label>
          <PhoneField value={emPhone} onChange={setEmPhone} t={T} />
        </>
      )}

      {step === 3 && (
        <>
          <div className="mt-3 flex flex-col gap-2.5">
            <ConsentRow
              checked={consent}
              onToggle={() => setConsent((v) => !v)}
              text={T(
                "હું મારી માહિતી અંગદાનના હેતુ માટે વાપરવાની પરવાનગી આપું છું.",
                "I allow my information to be used for organ donation purposes.",
              )}
            />
          </div>

          <Label>{T("સહી / પૂરું નામ", "Signature / full name")}</Label>
          <input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder={member ? pickText(member.fullNameGu, member.fullNameEn, lang) : ""}
            className={FIELD}
          />

          <div className="mt-4 rounded-[14px] border border-[#EFE3CB] bg-[#FDF9F0] p-3.5 text-[12px] leading-relaxed text-[#8B7A55]">
            <div className="mb-1.5 font-extrabold">{T("સારાંશ", "Summary")}</div>
            {member && (
              <div className="font-bold text-[var(--ink)]">
                {pickText(member.fullNameGu, member.fullNameEn, lang)}
              </div>
            )}
            {/* Grouped by type, not one flat list: the member is confirming a
                different promise for each group, so they need to read them apart. */}
            <div className="mt-1.5 flex flex-col gap-1">
              {DONATION_TYPES.map((type) => {
                const inType = Array.from(organs)
                  .filter(([, t]) => t === type)
                  .map(([o]) => organLabel(o, lang));
                if (inType.length === 0) return null;
                return (
                  <div key={type}>
                    <span className="font-extrabold">{donationTypeLabel(type, lang)}:</span>{" "}
                    {inType.join(", ")}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="mt-5 flex gap-2">
        {step > 0 && (
          <PrimaryBtn tone="ghost" onClick={() => setStep((s) => s - 1)}>
            {T("પાછળ", "Back")}
          </PrimaryBtn>
        )}
        {step < STEPS.length - 1 ? (
          <PrimaryBtn onClick={next}>{T("આગળ", "Next")}</PrimaryBtn>
        ) : (
          <PrimaryBtn
            onClick={submit}
            disabled={busy || !consent || signature.trim().length < 2}
          >
            {busy ? T("મોકલાય છે…", "Submitting…") : T("નોંધણી કરો", "Submit registration")}
          </PrimaryBtn>
        )}
      </div>
    </>
  );
}

function ConsentRow({
  checked,
  onToggle,
  text,
}: {
  checked: boolean;
  onToggle: () => void;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-[13px] border-[1.5px] p-3 text-left text-[13px] font-semibold leading-relaxed transition",
        checked
          ? "border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--ink)]"
          : "border-[#EDE4D4] bg-[#FCFAF6] text-[var(--ink-dim)]",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[6px] border-[1.5px] text-[11px] font-black",
          checked ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[#D9CFBB]",
        )}
      >
        {checked ? "✓" : ""}
      </span>
      {text}
    </button>
  );
}
