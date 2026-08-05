"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { PhoneField, type PhoneValue } from "@/components/ui/phone-field";
import { AppSelect } from "@/components/ui/app-select";
import { api } from "@/lib/http";
import { pickText, telLink, waLink } from "@/lib/format";
import {
  ORGAN_TYPES,
  ageFrom,
  canManageDonor,
  canRequest,
  donationSummary,
  donationSummaryLabel,
  donationTypeLabel,
  isOpenStatus,
  nameInitial,
  organLabel,
  type OrganDonorRow,
  type OrganType,
} from "@/lib/organ-donation";
import type { OrganModuleSettings } from "@/lib/community-settings";
import type { Lang } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import { Empty, FIELD, Label, Modal, OrganStatusPill, PrimaryBtn } from "./organ-ui";

/**
 * Option 1 — the community donor list.
 *
 * The phone number sits on the card itself, not behind the request flow: a
 * family in an emergency should be able to call without waiting on an approval,
 * and the in-app request is the paper trail, not the gate.
 */
export function DonorListTab({
  donors,
  settings,
  signedIn,
  viewerUserId,
  viewerFamilyId,
  lang,
  T,
}: {
  donors: OrganDonorRow[];
  settings: OrganModuleSettings;
  signedIn: boolean;
  viewerUserId: string | null;
  viewerFamilyId: string | null;
  lang: Lang;
  T: (gu: string, en: string) => string;
}) {
  const [search, setSearch] = useState("");
  const [village, setVillage] = useState("all");
  const [organ, setOrgan] = useState<"all" | OrganType>("all");
  const [detail, setDetail] = useState<OrganDonorRow | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasActiveFilter = village !== "all" || organ !== "all";

  const villages = useMemo(() => {
    const set = new Set<string>();
    for (const d of donors) {
      const v = (lang === "gu" ? d.villageGu || d.villageEn : d.villageEn) || d.city;
      if (v?.trim()) set.add(v.trim());
    }
    return [
      { value: "all", label: T("બધા ગામ", "All areas") },
      ...Array.from(set)
        .sort()
        .map((v) => ({ value: v, label: v })),
    ];
  }, [donors, lang, T]);

  const organOptions = useMemo(
    () => [
      { value: "all" as const, label: T("બધા અંગ", "All organs") },
      ...ORGAN_TYPES.map((o) => ({ value: o, label: organLabel(o, lang) })),
    ],
    [lang, T],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return donors.filter((d) => {
      const area = ((lang === "gu" ? d.villageGu || d.villageEn : d.villageEn) || d.city || "").trim();
      if (village !== "all" && area !== village) return false;
      if (organ !== "all" && !d.pledges.some((p) => p.organ === organ && isOpenStatus(p.status))) {
        return false;
      }
      if (
        q &&
        ![d.fullNameEn, d.fullNameGu, d.familyLabelEn, d.familyLabelGu, d.surnameEn, d.mobile].some(
          (v) => v?.toLowerCase().includes(q),
        )
      ) {
        return false;
      }
      return true;
    });
  }, [donors, search, village, organ, lang]);

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#B3A996]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={T("નામ કે પરિવાર શોધો…", "Search name or family…")}
            className={cn(FIELD, "pl-10")}
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-label={T("ફિલ્ટર", "Filter")}
          className={cn(
            "relative flex h-12 w-12 flex-none cursor-pointer items-center justify-center rounded-[13px] border-[1.5px] transition",
            hasActiveFilter
              ? "border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]"
              : "border-[#EDE4D4] bg-[#FCFAF6] text-[var(--ink-dim)]",
          )}
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
          {hasActiveFilter && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--brand)]" />
          )}
        </button>
      </div>

      {donors.length === 0 ? (
        <Empty>{T("હજુ કોઈ અંગદાતા નોંધાયા નથી.", "No organ donors registered yet.")}</Empty>
      ) : rows.length === 0 ? (
        <Empty>{T("આ ફિલ્ટરમાં કોઈ દાતા મળ્યા નથી.", "No donors match these filters.")}</Empty>
      ) : (
        <>
          <div className="mb-2.5 px-1 text-[12px] font-bold text-[var(--faint)]">
            {rows.length} {T("દાતા", rows.length === 1 ? "donor" : "donors")}
          </div>
          {rows.map((d) => (
            <DonorCard
              key={d.id}
              donor={d}
              lang={lang}
              T={T}
              showContact={settings.showContact}
              onOpen={() => setDetail(d)}
            />
          ))}
        </>
      )}

      {detail && (
        <DonorDetail
          donor={detail}
          onClose={() => setDetail(null)}
          settings={settings}
          signedIn={signedIn}
          viewerUserId={viewerUserId}
          viewerFamilyId={viewerFamilyId}
          lang={lang}
          T={T}
        />
      )}

      {filtersOpen && (
        <Modal
          title={T("ફિલ્ટર", "Filters")}
          onClose={() => setFiltersOpen(false)}
          footer={
            <div className="flex gap-2">
              <PrimaryBtn
                tone="ghost"
                onClick={() => {
                  setVillage("all");
                  setOrgan("all");
                }}
              >
                {T("રીસેટ", "Reset")}
              </PrimaryBtn>
              <PrimaryBtn onClick={() => setFiltersOpen(false)}>
                {T("લાગુ કરો", "Apply")}
              </PrimaryBtn>
            </div>
          }
        >
          <Label>{T("ગામ / વિસ્તાર", "Village / area")}</Label>
          <AppSelect value={village} onChange={setVillage} options={villages} />

          <Label>{T("અંગ", "Organ")}</Label>
          <AppSelect
            value={organ}
            onChange={(v) => setOrgan(v as "all" | OrganType)}
            options={organOptions}
          />
        </Modal>
      )}
    </>
  );
}

function DonorCard({
  donor,
  lang,
  T,
  showContact,
  onOpen,
}: {
  donor: OrganDonorRow;
  lang: Lang;
  T: (gu: string, en: string) => string;
  showContact: boolean;
  onOpen: () => void;
}) {
  const name = pickText(donor.fullNameGu, donor.fullNameEn, lang);
  const family = pickText(donor.familyLabelGu, donor.familyLabelEn, lang);
  const area = (lang === "gu" ? donor.villageGu || donor.villageEn : donor.villageEn) || donor.city;
  const age = ageFrom(donor.dateOfBirth);
  const open = donor.pledges.filter((p) => isOpenStatus(p.status));
  const summary = donationSummary(donor.pledges);

  return (
    <div className="samaj-card mb-2.5 p-[13px]">
      <button type="button" onClick={onOpen} className="flex w-full cursor-pointer items-center gap-3 text-left">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[var(--brand-tint)] text-[15px] font-extrabold text-[var(--brand)]">
          {nameInitial(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-[var(--ink)]">{name}</div>
          <div className="truncate text-xs font-medium text-[var(--faint)]">
            {[family, area, age ? `${age} ${T("વર્ષ", "yrs")}` : null].filter(Boolean).join(" · ")}
          </div>
        </div>
        {showContact && donor.mobile && (
          <a
            href={telLink(donor.mobile, donor.mobileIso)}
            onClick={(e) => e.stopPropagation()}
            aria-label={T("કૉલ", "Call")}
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-[var(--success-tint)] text-[var(--success)]"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
      </button>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {open.map((p) => (
          <OrganStatusPill key={p.id} organ={p.organ} status={p.status} lang={lang} />
        ))}
        {summary && (
          <span className="rounded-full bg-[#F6F1E8] px-[11px] py-1.5 text-[11px] font-extrabold text-[#8B8375]">
            {donationSummaryLabel(summary, lang)}
          </span>
        )}
      </div>
    </div>
  );
}

function DonorDetail({
  donor,
  onClose,
  settings,
  signedIn,
  viewerUserId,
  viewerFamilyId,
  lang,
  T,
}: {
  donor: OrganDonorRow;
  onClose: () => void;
  settings: OrganModuleSettings;
  signedIn: boolean;
  viewerUserId: string | null;
  viewerFamilyId: string | null;
  lang: Lang;
  T: (gu: string, en: string) => string;
}) {
  const [asking, setAsking] = useState<{ pledgeId: string; organ: OrganType } | null>(null);
  const name = pickText(donor.fullNameGu, donor.fullNameEn, lang);
  const age = ageFrom(donor.dateOfBirth);
  const isOwn = canManageDonor(donor, { userId: viewerUserId, familyId: viewerFamilyId });

  const rows: [string, string | null][] = [
    [T("પરિવાર", "Family"), pickText(donor.familyLabelGu, donor.familyLabelEn, lang)],
    [T("અટક", "Surname"), pickText(donor.surnameGu, donor.surnameEn, lang)],
    [
      T("ગામ / વિસ્તાર", "Village / area"),
      (lang === "gu" ? donor.villageGu || donor.villageEn : donor.villageEn) || donor.city,
    ],
    [T("ઉંમર", "Age"), age ? `${age}` : null],
    [T("બ્લડ ગ્રુપ", "Blood group"), donor.bloodGroup?.replace("_POS", "+").replace("_NEG", "-") ?? null],
  ];

  return (
    <Modal title={name} onClose={onClose}>
      {settings.showContact && donor.mobile && (
        <div className="mb-4 flex gap-2">
          <a
            href={telLink(donor.mobile, donor.mobileIso)}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[13px] bg-[var(--success-tint)] text-[13.5px] font-extrabold text-[var(--success)]"
          >
            <Phone className="h-4 w-4" /> {T("કૉલ કરો", "Call")}
          </a>
          <a
            href={waLink(donor.mobile, donor.mobileIso)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 flex-1 items-center justify-center rounded-[13px] bg-[#E4F5E9] text-[13.5px] font-extrabold text-[#1E9E52]"
          >
            WhatsApp
          </a>
        </div>
      )}

      <dl className="mb-4 grid grid-cols-2 gap-y-2.5">
        {rows.map(([label, value]) =>
          value ? (
            <div key={label}>
              <dt className="text-[11.5px] font-bold text-[#A79C88]">{label}</dt>
              <dd className="text-[13.5px] font-bold text-[var(--ink)]">{value}</dd>
            </div>
          ) : null,
        )}
      </dl>

      {donor.note && (
        <p className="mb-4 rounded-[13px] bg-[#FDF9F0] p-3 text-[12.5px] leading-relaxed text-[#8B7A55]">
          {donor.note}
        </p>
      )}

      <div className="mb-1.5 text-[12px] font-bold text-[#8B8375]">
        {T("દાન કરેલ અંગ", "Pledged organs")}
      </div>
      <div className="flex flex-col gap-2">
        {donor.pledges.map((p) => {
          const requestable = settings.requests && signedIn && !isOwn && canRequest(p, donor.isDeceased);
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-[13px] border border-[#F0E9DB] px-3 py-2.5"
            >
              <OrganStatusPill organ={p.organ} status={p.status} lang={lang} />
              {/* Each organ carries its own timing, so it has to be readable on
                  the organ's own row — a single line under the card would be
                  wrong the moment two organs disagree. */}
              <span className="rounded-full bg-[#F6F1E8] px-2.5 py-1 text-[10.5px] font-extrabold whitespace-nowrap text-[#8B8375]">
                {donationTypeLabel(p.donationType, lang)}
              </span>
              <div className="flex-1" />
              {requestable && (
                <button
                  type="button"
                  onClick={() => setAsking({ pledgeId: p.id, organ: p.organ })}
                  className="cursor-pointer rounded-full bg-[var(--brand)] px-3.5 py-1.5 text-[11.5px] font-extrabold text-white"
                >
                  {T("વિનંતી કરો", "Request")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {donor.pledges.some((p) => p.donationType === "AFTER_DEATH") && !donor.isDeceased && (
        <p className="mt-3 rounded-[13px] bg-[#FDF9F0] p-3 text-[12px] leading-relaxed text-[#8B7A55]">
          {T(
            "‘મૃત્યુ પછી’ વાળા અંગ માટે અત્યારે વિનંતી થઈ શકે નહીં.",
            "Organs marked “After death” cannot be requested while the donor is alive.",
          )}
        </p>
      )}
      {!signedIn && (
        <p className="mt-3 text-center text-[12.5px] text-[var(--faint)]">
          {T("વિનંતી કરવા લોગિન કરો.", "Log in to raise a request.")}
        </p>
      )}

      {asking && (
        <RequestModal
          pledgeId={asking.pledgeId}
          organ={asking.organ}
          donorName={name}
          onClose={() => setAsking(null)}
          onDone={onClose}
          lang={lang}
          T={T}
        />
      )}
    </Modal>
  );
}

function RequestModal({
  pledgeId,
  organ,
  donorName,
  onClose,
  onDone,
  lang,
  T,
}: {
  pledgeId: string;
  organ: OrganType;
  donorName: string;
  onClose: () => void;
  onDone: () => void;
  lang: Lang;
  T: (gu: string, en: string) => string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState<PhoneValue>({ iso: "in", digits: "" });
  const [patient, setPatient] = useState("");
  const [hospital, setHospital] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (name.trim().length < 2) {
      return toast.error(T("તમારું નામ લખો", "Enter your name"));
    }
    if (phone.digits.length < 6) {
      return toast.error(T("મોબાઇલ નંબર લખો", "Enter a mobile number"));
    }
    setBusy(true);
    const res = await api.post("/api/organ-donation/requests", {
      pledgeId,
      requesterName: name.trim(),
      requesterMobile: phone.digits,
      requesterMobileIso: phone.iso,
      patientName: patient.trim() || undefined,
      hospital: hospital.trim() || undefined,
      message: message.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(
      T("વિનંતી મોકલાઈ — પરિવારના જવાબની રાહ જુઓ", "Request sent — waiting on the family's reply"),
    );
    onClose();
    onDone();
    router.refresh();
  }

  return (
    <Modal
      title={`${organLabel(organ, lang)} · ${donorName}`}
      onClose={onClose}
      footer={
        <PrimaryBtn onClick={submit} disabled={busy}>
          {busy ? T("મોકલાય છે…", "Sending…") : T("વિનંતી મોકલો", "Send request")}
        </PrimaryBtn>
      }
    >
      <p className="rounded-[13px] bg-[#FDF9F0] p-3 text-[12.5px] leading-relaxed text-[#8B7A55]">
        {T(
          "વિનંતી દાતાના પરિવારને જશે. તેઓ મંજૂર કરે પછી સંપર્ક થશે — તાત્કાલિક હોય તો સીધો કૉલ પણ કરી શકો છો.",
          "Your request goes to the donor's family. Contact follows their approval — for anything urgent you can also call directly.",
        )}
      </p>

      <Label>{T("તમારું નામ", "Your name")}</Label>
      <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />

      <Label>{T("મોબાઇલ નંબર", "Mobile number")}</Label>
      <PhoneField value={phone} onChange={setPhone} t={T} />

      <Label>{T("દર્દીનું નામ (વૈકલ્પિક)", "Patient name (optional)")}</Label>
      <input value={patient} onChange={(e) => setPatient(e.target.value)} className={FIELD} />

      <Label>{T("હોસ્પિટલ (વૈકલ્પિક)", "Hospital (optional)")}</Label>
      <input value={hospital} onChange={(e) => setHospital(e.target.value)} className={FIELD} />

      <Label>{T("સંદેશ (વૈકલ્પિક)", "Message (optional)")}</Label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="w-full rounded-[13px] border-[1.5px] border-[#EDE4D4] bg-[#FCFAF6] px-3.5 py-3 text-[14px] font-semibold text-[var(--ink)] outline-none"
      />
    </Modal>
  );
}
