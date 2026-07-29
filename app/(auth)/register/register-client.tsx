"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { BackHeader } from "@/components/layout/back-header";
import { CascadingOccupationFields } from "@/components/forms/cascading-occupation-fields";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { bloodToEnum, pickText } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { GujaratiInput } from "@/components/ui/gujarati-keyboard";
import { SpeechInput } from "@/components/ui/speech-input";
import { toast } from "sonner";
import {
  type CascadingOccupationValues,
  blankCascadingOccupation,
  resolveCascadingOccupationForSave,
} from "@/lib/cascading-occupation";
import type { OccupationTreeNode } from "@/lib/occupation-defaults";
import {
  familyPlaceFromHead,
  validateFamilyByType,
  type FamilyDetailsValues,
} from "@/lib/family-form";
import { FamilyDetailsFields } from "@/components/forms/family-details-fields";
import { MemberPlacePicker, labelForPlace } from "@/components/forms/member-place-picker";

type Group = { id: string; nameEn: string; nameGu: string | null };
type Place = { id: string; nameEn: string; nameGu: string | null };
type Relation = { nameEn: string; nameGu: string };

type Member = {
  name: string;
  nameGu: string;
  relation: string;
  dob: string;
  blood: string;
  mobile: string;
  whatsapp: string;
  hasWa: boolean;
  /** Where this member currently lives — English name of a village / city. */
  place: string;
} & CascadingOccupationValues;

const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

function bilingualLabel(nameEn?: string | null, nameGu?: string | null) {
  const en = (nameEn || "").trim();
  const gu = (nameGu || "").trim();
  if (en && gu && en !== gu) return `${en} · ${gu}`;
  return en || gu || "—";
}

const blankMember = (place = ""): Member => ({
  name: "",
  nameGu: "",
  relation: "Son",
  dob: "",
  blood: "B+",
  mobile: "",
  whatsapp: "",
  hasWa: true,
  place,
  ...blankCascadingOccupation(),
});

export function RegisterClient({
  communityType,
  lockedSurname,
  surnameGroups,
  cities,
  villages,
  relations,
  occupationTree,
  contactPerson,
}: {
  communityType: "PARIVAR" | "GAM";
  lockedSurname: Group | null;
  surnameGroups: Group[];
  cities: Place[];
  villages: Place[];
  relations: Relation[];
  occupationTree: OccupationTreeNode[];
  contactPerson: {
    nameEn: string;
    nameGu: string | null;
    mobile: string;
    role: "DATA_MANAGER" | "OWNER";
  } | null;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const { fromEn, guInput } = useTranslitSync();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const [step, setStep] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null);
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const initialGroupId =
    lockedSurname?.id ?? surnameGroups[0]?.id ?? "";
  const [surnameGroupId, setSurnameGroupId] = useState(initialGroupId);
  const selectedGroup = useMemo(() => {
    if (lockedSurname) return lockedSurname;
    return surnameGroups.find((g) => g.id === surnameGroupId) ?? null;
  }, [lockedSurname, surnameGroups, surnameGroupId]);

  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });
  const [nativePlace] = useState("");
  const [email] = useState("");

  /**
   * Places a member can pick from. GAM communities live in villages, PARIVAR
   * communities in cities — one list either way, since a member only ever
   * answers "where do you live now?".
   */
  const placeOptions = communityType === "GAM" ? villages : cities;
  /** Locally-added places (typed by the registrant) sit alongside the masters. */
  const [extraPlaces, setExtraPlaces] = useState<Place[]>([]);
  const allPlaces = useMemo(() => [...placeOptions, ...extraPlaces], [placeOptions, extraPlaces]);
  const addPlace = ({ nameEn, nameGu }: { nameEn: string; nameGu: string }) =>
    setExtraPlaces((prev) =>
      prev.some((p) => p.nameEn === nameEn) || placeOptions.some((p) => p.nameEn === nameEn)
        ? prev
        : [...prev, { id: `new:${nameEn}`, nameEn, nameGu: nameGu || null }],
    );

  const [form, setForm] = useState({
    addr: "",
    addrGu: "",
    elder: "",
    elderGu: "",
    elderPhone: "",
    loc: "",
    m1name: "",
    m1nameGu: "",
    m1mobile: "",
    m1whatsapp: "",
    m1dob: "",
    m1blood: "B+",
    m1place: "",
    hasWhatsApp: true,
    ...blankCascadingOccupation(),
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [newMember, setNewMember] = useState<Member>(blankMember);

  /** Household place of record — the head's. Drives Family.city / villageAreaId. */
  const { city, villageAreaId, livesOutsideVillage } = useMemo(
    () => familyPlaceFromHead(form.m1place, villages),
    [form.m1place, villages],
  );

  function openAddMember() {
    setEditingMemberIndex(null);
    // New members default to the head's place — most households share one.
    setNewMember(blankMember(form.m1place));
    setAddOpen(true);
  }

  function openEditMember(index: number) {
    setEditingMemberIndex(index);
    setNewMember(structuredClone(members[index]));
    setAddOpen(true);
  }

  const relationChoices = useMemo(
    () =>
      relations.filter((r) => r.nameEn.toLowerCase() !== "head").length
        ? relations.filter((r) => r.nameEn.toLowerCase() !== "head")
        : [
            { nameEn: "Son", nameGu: "પુત્ર" },
            { nameEn: "Daughter", nameGu: "પુત્રી" },
            { nameEn: "Wife", nameGu: "પત્ની" },
            { nameEn: "Father", nameGu: "પિતા" },
            { nameEn: "Mother", nameGu: "માતા" },
            { nameEn: "Brother", nameGu: "ભાઈ" },
            { nameEn: "Sister", nameGu: "બહેન" },
          ],
    [relations],
  );

  const relationLabel = (relation: string) => {
    const found = relationChoices.find((r) => r.nameEn === relation);
    return found ? bilingualLabel(found.nameEn, found.nameGu) : relation;
  };

  const relationBadgeLabel = (relation: string) => {
    const found = relationChoices.find((r) => r.nameEn === relation);
    return found?.nameGu || found?.nameEn || relation;
  };

  const formatShortDate = (value: string) => {
    if (!value) return "";
    const [y, m, d] = value.split("-");
    if (!y || !m || !d) return value;
    return `${Number(d)}/${Number(m)}/${String(y).slice(-2)}`;
  };

  const occupationLabel = (values: {
    occupation?: string;
    occupationOther?: string;
    education?: string;
    course?: string;
  }) => values.occupationOther || values.course || values.education || values.occupation || "";

  const contactName = contactPerson
    ? pickText(contactPerson.nameGu, contactPerson.nameEn, lang)
    : T("સમાજ સંપર્ક", "Community contact");
  const contactRole = contactPerson?.role === "DATA_MANAGER"
    ? T("ડેટા મેનેજર", "Data Manager")
    : T("એડમિન", "Admin");
  const contactMobile = contactPerson?.mobile || "";
  const contactPhoneHref = contactMobile ? `tel:${contactMobile}` : "#";
  const contactWhatsappHref = contactMobile ? `https://wa.me/91${contactMobile}` : "#";

  const steps = [1, 2, 3].map((n) => ({
    n,
    done: step > n,
    active: step === n,
  }));

  const placeLabel = labelForPlace(form.m1place, allPlaces, T("પસંદ કરો", "Select"));

  /**
   * The shared <FamilyDetailsFields> speaks the API's field names, while this
   * screen keeps its own state split across several hooks. Adapting here is a
   * far smaller change than renaming state throughout the wizard.
   */
  const details: FamilyDetailsValues = {
    surnameGroupId: selectedGroup?.id ?? surnameGroupId,
    surnameEn: selectedGroup?.nameEn ?? "",
    surnameGu: selectedGroup?.nameGu ?? "",
    addressEn: form.addr,
    addressGu: form.addrGu,
    city,
    villageAreaId: villageAreaId ?? "",
    livesOutsideVillage,
    nativeElderNameEn: form.elder,
    nativeElderNameGu: form.elderGu,
    nativeElderPhone: form.elderPhone,
    latitude: coords.lat,
    longitude: coords.lng,
  };

  function applyDetails(patch: Partial<FamilyDetailsValues>) {
    if (patch.surnameGroupId !== undefined) setSurnameGroupId(patch.surnameGroupId);
    if (patch.latitude !== undefined || patch.longitude !== undefined) {
      setCoords({ lat: patch.latitude ?? null, lng: patch.longitude ?? null });
    }
    setForm((prev) => ({
      ...prev,
      ...(patch.addressEn !== undefined ? { addr: patch.addressEn } : {}),
      ...(patch.addressGu !== undefined ? { addrGu: patch.addressGu } : {}),
      ...(patch.nativeElderNameEn !== undefined ? { elder: patch.nativeElderNameEn } : {}),
      ...(patch.nativeElderNameGu !== undefined ? { elderGu: patch.nativeElderNameGu } : {}),
      ...(patch.nativeElderPhone !== undefined ? { elderPhone: patch.nativeElderPhone } : {}),
    }));
  }

  function validateStep1() {
    if (communityType === "PARIVAR") {
      if (!lockedSurname && !surnameGroupId) {
        return T("અટક જૂથ પસંદ કરો", "Pick a surname group");
      }
    } else if (!surnameGroupId && !selectedGroup) {
      return T("અટક જૂથ પસંદ કરો", "Pick a surname group");
    }
    if (form.addr.trim().length < 3) return T("સરનામું જરૂરી છે", "Address is required");
    if (!selectedGroup && !surnameGroupId) {
      return T("અટક જૂથ પસંદ કરો", "Pick a surname group");
    }
    return null;
  }

  /** The head's place lives on their member card, so it is validated with step 2. */
  function validateStep2() {
    if (form.m1name.trim().length < 2) return T("વડાનું નામ જરૂરી છે", "Head name is required");
    const mob = form.m1mobile.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(mob)) {
      return T("લોગિન મોબાઈલ 10 અંકનો હોવો જોઈએ", "Login mobile must be 10 digits (6–9…)");
    }
    const typeErr = validateFamilyByType(communityType, {
      headNameEn: form.m1name,
      addressEn: form.addr,
      city,
      villageAreaId,
      livesOutsideVillage,
      surnameGroupId: selectedGroup?.id ?? surnameGroupId,
      surnameEn: selectedGroup?.nameEn,
    });
    if (typeErr) {
      return communityType === "GAM"
        ? T("વડાનું ગામ / શહેર પસંદ કરો", "Pick the head's village / city")
        : T("વડાનું શહેર પસંદ કરો", "Pick the head's city");
    }
    return null;
  }

  async function submit() {
    const e1 = validateStep1();
    if (e1) return toast.error(e1);
    const e2 = validateStep2();
    if (e2) return toast.error(e2);
    if (!consent) return toast.error(T("સંમતિ જરૂરી છે", "Consent is required"));
    if (!selectedGroup) return toast.error(T("અટક જૂથ પસંદ કરો", "Pick a surname group"));

    setBusy(true);

    const headOcc = await resolveCascadingOccupationForSave(occupationTree, form);
    const memberOcc = await Promise.all(
      members.map((m) => resolveCascadingOccupationForSave(occupationTree, m)),
    );

    const payload = {
      surnameGroupId: selectedGroup.id,
      headNameEn: form.m1name.trim(),
      headNameGu: form.m1nameGu.trim() || undefined,
      surnameEn: selectedGroup.nameEn,
      surnameGu: selectedGroup.nameGu || undefined,
      addressEn: form.addr.trim(),
      addressGu: form.addrGu.trim() || undefined,
      city: city || undefined,
      nativePlace: nativePlace.trim() || undefined,
      email: email.trim() || undefined,
      villageAreaId: livesOutsideVillage ? null : villageAreaId || null,
      livesOutsideVillage,
      nativeElderNameEn: form.elder.trim() || undefined,
      nativeElderNameGu: form.elderGu.trim() || undefined,
      nativeElderPhone: form.elderPhone.trim() || undefined,
      latitude: coords.lat ?? undefined,
      longitude: coords.lng ?? undefined,
      consentAccepted: true,
      members: [
        {
          fullNameEn: form.m1name.trim(),
          fullNameGu: form.m1nameGu.trim() || undefined,
          relation: "Head",
          mobile: form.m1mobile.replace(/\D/g, ""),
          bloodGroup: bloodToEnum(form.m1blood),
          currentlyAt: form.m1place || undefined,
          dateOfBirth: form.m1dob || undefined,
          hasWhatsApp: true,
          isHead: true,
          occupation: headOcc.occupation || undefined,
          occupationOther: headOcc.occupationOther || undefined,
          education: headOcc.education || undefined,
          course: headOcc.course || undefined,
        },
        ...members.map((m, i) => ({
          fullNameEn: m.name.trim(),
          fullNameGu: m.nameGu.trim() || undefined,
          relation: m.relation,
          mobile: m.mobile.replace(/\D/g, "") || undefined,
          bloodGroup: bloodToEnum(m.blood),
          currentlyAt: m.place || city || undefined,
          dateOfBirth: m.dob || undefined,
          hasWhatsApp: m.hasWa,
          isHead: false,
          occupation: memberOcc[i].occupation || undefined,
          occupationOther: memberOcc[i].occupationOther || undefined,
          education: memberOcc[i].education || undefined,
          course: memberOcc[i].course || undefined,
        })),
      ],
    };

    const res = await api.post("/api/families", payload);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || T("નોંધણી થઈ નથી", "Registration failed"));
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AppShell>
        <div className="flex flex-1 flex-col items-center px-7 py-9 text-center">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="flex h-[92px] w-[92px] items-center justify-center rounded-full border-2 border-[#B7E6C6] bg-[var(--success-tint)] text-[var(--wa-dark)]"
          >
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m5 12 5 5 9-11" />
            </svg>
          </motion.div>
          <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-[21px] font-bold text-[var(--ink)]">
            {T("નોંધણી મળી ગઈ!", "Registration received!")}
          </div>
          <p className="mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-[var(--ink-mid)]">
            {T(
              "એડમિન મંજૂરી આપશે એટલે તમારા WhatsApp નંબર પર જાણ થશે. પછી એ જ નંબરથી લોગિન કરી શકાશે.",
              "Once the admin approves, you'll be notified on your WhatsApp number. You can then log in with that number.",
            )}
          </p>

          {contactPerson ? (
          <div className="mt-4 w-full max-w-[340px] rounded-[24px] border border-[var(--brand-line)] bg-white p-4 text-left shadow-[0_14px_35px_-24px_rgba(40,40,40,.25)]">
            <div className="mb-2 text-[11.5px] font-extrabold tracking-wide text-[var(--brand)]">
              {T("આ જૂથ માટે સંયોજક", "Coordinator for this group")}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-tint)] text-[18px] font-extrabold text-[var(--brand)]">
                {(contactName || "?").trim()[0] || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold text-[var(--ink)]">{contactName}</div>
                <div className="mt-0.5 text-[12px] font-medium text-[var(--faint)]">
                  {contactRole}
                  {selectedGroup
                    ? ` · ${bilingualLabel(selectedGroup.nameEn, selectedGroup.nameGu)}`
                    : ""}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <a
                href={contactPhoneHref}
                className="flex h-11 items-center justify-center rounded-[14px] bg-[var(--brand-tint)] text-[13px] font-extrabold text-[var(--brand)]"
              >
                {T("કોલ કરો", "Call")}
              </a>
              <a
                href={contactWhatsappHref}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 items-center justify-center rounded-[14px] bg-[var(--success-tint)] text-[13px] font-extrabold text-[var(--wa-dark)]"
              >
                WhatsApp
              </a>
            </div>

            <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--faint)]">
              {T(
                "મંજૂરી બાકી હોય ત્યાં સુધી જરૂર પડે તો આ નંબર પર સંપર્ક કરી શકો છો.",
                "If needed, you can contact them on this number while approval is pending.",
              )}
            </p>
          </div>
          ) : (
            <p className="mt-4 max-w-[320px] text-[11.5px] leading-relaxed text-[var(--faint)]">
              {T(
                "આ સંભાળનાર ત્યારે જ દેખાય જ્યારે તમારા અટક જૂથ માટે એડમિન નિમાયેલ હોય.",
                "A coordinator appears here only when the admin has assigned one for your surname group.",
              )}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setStep(1);
              setMembers([]);
              setForm({
                addr: "",
                addrGu: "",
                elder: "",
                elderGu: "",
                elderPhone: "",
                loc: "",
                m1name: "",
                m1nameGu: "",
                m1mobile: "",
                m1whatsapp: "",
                m1dob: "",
                m1blood: "B+",
                m1place: "",
                hasWhatsApp: true,
                ...blankCascadingOccupation(),
              });
            }}
            className="mt-5 w-full max-w-[340px] rounded-[16px] border border-dashed border-[var(--brand-line)] bg-white py-3 text-sm font-bold text-[var(--brand)]"
          >
            {T("બીજા પરિવારની નોંધણી કરો", "Register another family")}
          </button>
          <Link
            href="/login"
            className="mt-4 flex h-[52px] w-full max-w-[340px] items-center justify-center rounded-2xl border border-[color:rgb(var(--brand-rgb)/.18)] !text-white text-[15px] font-extrabold shadow-[0_12px_24px_-10px_rgb(var(--brand-rgb) / .45)]"
            style={{
              background: "linear-gradient(135deg,var(--brand),var(--brand-dark))",
              color: "#fff",
              textShadow: "0 1px 0 rgba(0,0,0,.12)",
            }}
          >
            {T("લોગિન પર જાઓ", "Go to login")}
          </Link>
        </div>
      </AppShell>
    );
  }

  if (addOpen) {
    return (
      <AppShell>
        <BackHeader
          title={editingMemberIndex === null ? T("નવો સભ્ય ઉમેરો", "Add new member") : T("સભ્યમાં ફેરફાર કરો", "Edit member")}
          subtitle={T("ઘરના સભ્યની માહિતી ભરો", "Fill in the household member's details")}
          onBack={() => {
            setAddOpen(false);
            setEditingMemberIndex(null);
          }}
        />
        <div className="mx-auto w-full max-w-[680px] flex-1 px-4 py-[18px] pb-6">
          <Field label={`${T("પૂરું નામ", "Full name")} (${T("English", "English")}) *`}>
            <div className="relative">
              <SpeechInput
                inputClassName="samaj-fld pr-[150px]"
                value={newMember.name}
                onChange={(v) => {
                  setNewMember((prev) => ({ ...prev, name: v }));
                  fromEn(v, (gu) => setNewMember((prev) => ({ ...prev, nameGu: gu })), "newMember");
                }}
                placeholder={T("નામ લખો…", "Enter name…")}
              />
              {selectedGroup && (
                <span className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 rounded-full border border-[#F1E4CC] bg-[#FFF7EA] px-2.5 py-1 text-[10.5px] font-extrabold text-[#9C6A1B]">
                  {selectedGroup.nameEn}
                </span>
              )}
            </div>
          </Field>
          <Field label={`${T("પૂરું નામ", "Full name")} (${T("ગુજરાતી", "Gujarati")})`}>
            <div className="relative">
              <GujaratiInput
                inputClassName="samaj-fld pr-[150px]"
                value={newMember.nameGu}
                onChange={(v) => {
                  setNewMember((prev) => ({ ...prev, nameGu: v }));
                  guInput(v, (gu) => setNewMember((prev) => ({ ...prev, nameGu: gu })), "newMember:gu");
                }}
              />
              {selectedGroup?.nameGu && (
                <span className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 rounded-full border border-[#F1E4CC] bg-[#FFF7EA] px-2.5 py-1 text-[10.5px] font-extrabold text-[#9C6A1B]">
                  {selectedGroup.nameGu}
                </span>
              )}
            </div>
          </Field>
          <Field label={`${T("સબંધ", "Relation")} *`}>
            <div className="flex flex-wrap gap-2">
              {relationChoices.map((r) => (
                <button
                  key={r.nameEn}
                  type="button"
                  onClick={() => setNewMember({ ...newMember, relation: r.nameEn })}
                  className={cn(
                    "rounded-full px-4 py-2.5 text-[13px] font-bold",
                    newMember.relation === r.nameEn
                      ? "bg-[var(--brand)] text-white"
                      : "border border-[var(--line-field)] bg-white text-[var(--ink-dim)]",
                  )}
                >
                  {lang === "gu" ? r.nameGu || r.nameEn : r.nameEn}
                </button>
              ))}
            </div>
          </Field>
          <Field
            label={`${communityType === "GAM" ? T("ગામ / શહેર", "Village / city") : T("શહેર", "City")}`}
          >
            <MemberPlacePicker
              value={newMember.place}
              onChange={(v) => setNewMember((prev) => ({ ...prev, place: v }))}
              options={allPlaces}
              onAddNew={addPlace}
              t={T}
            />
          </Field>
          <div className="mb-3.5 grid grid-cols-2 gap-2.5">
            <Field label={T("જન્મ", "DOB")}>
              <input
                type="date"
                className="samaj-fld"
                value={newMember.dob}
                onChange={(e) => setNewMember({ ...newMember, dob: e.target.value })}
              />
            </Field>
            <Field label={T("બ્લડ", "Blood")}>
              <select
                className="samaj-fld"
                value={newMember.blood}
                onChange={(e) => setNewMember({ ...newMember, blood: e.target.value })}
              >
                {BLOOD.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_280px]">
            <Field label={T("મોબાઈલ (વૈકલ્પિક)", "Mobile (optional)")}>
              <input
                className="samaj-fld"
                value={newMember.mobile}
                onChange={(e) =>
                  setNewMember({
                    ...newMember,
                    mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                  })
                }
                inputMode="numeric"
              />
            </Field>
            {newMember.hasWa ? (
              <div className="mb-3.5">
                <div className="mb-1 text-xs font-bold text-[var(--muted)]">&nbsp;</div>
                <button
                  type="button"
                  onClick={() => setNewMember({ ...newMember, hasWa: !newMember.hasWa })}
                  className="samaj-card flex h-[48px] w-full items-center justify-between px-3.5"
                >
                  <span className="text-[13.5px] font-semibold">
                    {T("આ નંબર પર WhatsApp છે", "This number has WhatsApp")}
                  </span>
                  <span
                    className={cn(
                      "relative h-[27px] w-[46px] rounded-2xl transition-colors",
                      newMember.hasWa ? "bg-[var(--brand)]" : "bg-[var(--scroll-thumb)]",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow transition-all",
                        newMember.hasWa ? "left-[22px]" : "left-[3px]",
                      )}
                    />
                  </span>
                </button>
              </div>
            ) : (
              <Field
                label={
                  <span className="flex items-center justify-between gap-2">
                    <span>{T("WhatsApp નંબર", "WhatsApp number")}</span>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand)]">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() =>
                          setNewMember((prev) => ({
                            ...prev,
                            hasWa: true,
                            whatsapp: "",
                          }))
                        }
                        className="size-3.5 accent-[var(--brand)]"
                      />
                      {T("એ જ નંબર", "same mobile")}
                    </label>
                  </span>
                }
              >
                <input
                  className="samaj-fld"
                  value={newMember.whatsapp}
                  onChange={(e) =>
                    setNewMember({
                      ...newMember,
                      whatsapp: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                  inputMode="numeric"
                  placeholder="98765 43210"
                />
              </Field>
            )}
          </div>
          <div className="mb-3.5">
            <CascadingOccupationFields
              tree={occupationTree}
              t={T}
              values={newMember}
              onChange={(patch) => setNewMember((prev) => ({ ...prev, ...patch }))}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (newMember.name.trim().length < 2) return;
              if (editingMemberIndex === null) {
                setMembers([...members, newMember]);
              } else {
                setMembers((prev) => prev.map((m, i) => (i === editingMemberIndex ? newMember : m)));
              }
              setAddOpen(false);
              setEditingMemberIndex(null);
              setNewMember(blankMember());
            }}
            className="flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-extrabold text-white"
            style={{ background: "linear-gradient(135deg,var(--brand),var(--brand-dark))" }}
          >
            {editingMemberIndex === null ? T("સભ્ય ઉમેરો", "Add member") : T("ફેરફાર સચવો", "Save changes")}
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-[18px] pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 mx-auto flex w-full max-w-[680px] items-center gap-3">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : router.push("/login"))}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/14"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <div className="flex-1 font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold">
            {T("પરિવાર નોંધણી", "Family Registration")}
          </div>
        </div>
        <div className="relative z-2 mx-auto mt-4 flex w-full max-w-[680px] items-center gap-2">
          {steps.map((s, idx) => (
            <div key={s.n} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold",
                  s.active
                    ? "bg-white text-[var(--brand)]"
                    : s.done
                      ? "bg-[var(--gold)] text-white"
                      : "bg-white/18 text-white/70",
                )}
              >
                {s.done ? "✓" : s.n}
              </div>
              {idx < 2 && <div className="h-[3px] flex-1 rounded-sm bg-white/25" />}
            </div>
          ))}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[680px] flex-1 px-4 py-4 pb-6">
        {communityType === "GAM" && surnameGroups.length === 0 && (
          <p className="mb-3 rounded-[14px] border border-[#EFE3CB] bg-[#FDF9F0] p-3.5 text-xs text-[#8B7A55]">
            {T(
              "અટક જૂથ હજુ સેટ નથી. કૃપા કરી કોમ્યુનિટી એડમિનનો સંપર્ક કરો.",
              "No surname groups yet. Please contact the community admin.",
            )}
          </p>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <h2 className="mb-3.5 text-[15px] font-extrabold text-[var(--ink)]">
                {T("પરિવારની માહિતી", "Family information")}
              </h2>

              <FamilyDetailsFields
                variant="member"
                values={details}
                onChange={applyDetails}
                communityType={communityType}
                lockedSurname={lockedSurname}
                surnameGroups={surnameGroups}
                t={T}
              />

              <PrimaryBtn
                onClick={() => {
                  const err = validateStep1();
                  if (err) return toast.error(err);
                  setStep(2);
                }}
              >
                {T("આગળ: સભ્યો ઉમેરો", "Next: add members")}
              </PrimaryBtn>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <div className="mb-3.5 flex items-center justify-between rounded-2xl bg-[#F4EFE6] px-3.5 py-3">
                <div>
                  <div className="text-[11px] font-extrabold tracking-wide text-[var(--muted)]">
                    {T("પરિવારની માહિતી", "FAMILY INFO")}
                  </div>
                  <div className="mt-0.5 text-sm font-bold">
                    {selectedGroup
                      ? bilingualLabel(selectedGroup.nameEn, selectedGroup.nameGu)
                      : "—"}
                  </div>
                </div>
                <button type="button" onClick={() => setStep(1)} className="text-xs font-bold text-[var(--brand)] underline">
                  {T("ફેરફાર", "Edit")}
                </button>
              </div>
              <h2 className="mb-3 text-[15px] font-extrabold">
                {T(`ઘરના સભ્યો (${members.length + 1} ઉમેર્યા)`, `Household members (${members.length + 1} added)`)}
              </h2>
              <div className="samaj-card mb-3 border-[1.5px] border-[var(--gold-border)] p-[15px]">
                <div className="mb-2.5 flex items-center justify-between">
                  <b className="text-[14.5px]">{T("સભ્ય 1 — વડા", "Member 1 — Head")}</b>
                  <span className="rounded-lg bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--brand)]">
                    {T("પરિવારના વડા", "Family head")}
                  </span>
                </div>
                <Field label={`${T("પૂરું નામ", "Full name")} *`}>
                  <div className="relative">
                    <SpeechInput
                      inputClassName="samaj-fld pr-[150px]"
                      value={form.m1name}
                      onChange={(v) => {
                        setForm((prev) => ({ ...prev, m1name: v }));
                        fromEn(v, (gu) => setForm((prev) => ({ ...prev, m1nameGu: gu })), "m1");
                      }}
                    />
                    {selectedGroup && (
                      <span className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 rounded-full border border-[#F1E4CC] bg-[#FFF7EA] px-2.5 py-1 text-[10.5px] font-extrabold text-[#9C6A1B]">
                        {selectedGroup.nameEn}
                      </span>
                    )}
                  </div>
                </Field>
                <Field label={`${T("પૂરું નામ", "Full name")} (${T("ગુજરાતી", "Gujarati")})`}>
                  <div className="relative">
                    <GujaratiInput
                      inputClassName="samaj-fld pr-[150px]"
                      value={form.m1nameGu}
                      onChange={(v) => {
                        setForm((prev) => ({ ...prev, m1nameGu: v }));
                        guInput(v, (gu) => setForm((prev) => ({ ...prev, m1nameGu: gu })), "m1:gu");
                      }}
                    />
                    {selectedGroup?.nameGu && (
                      <span className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 rounded-full border border-[#F1E4CC] bg-[#FFF7EA] px-2.5 py-1 text-[10.5px] font-extrabold text-[#9C6A1B]">
                        {selectedGroup.nameGu}
                      </span>
                    )}
                  </div>
                </Field>
                <Field
                  label={`${communityType === "GAM" ? T("ગામ / શહેર", "Village / city") : T("શહેર", "City")} *`}
                >
                  <MemberPlacePicker
                    value={form.m1place}
                    onChange={(v) => setForm((prev) => ({ ...prev, m1place: v }))}
                    options={allPlaces}
                    onAddNew={addPlace}
                    t={T}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={T("જન્મ", "DOB")}>
                    <input
                      type="date"
                      className="samaj-fld"
                      value={form.m1dob}
                      onChange={(e) => setForm({ ...form, m1dob: e.target.value })}
                    />
                  </Field>
                  <Field label={T("બ્લડ", "Blood")}>
                    <select
                      className="samaj-fld"
                      value={form.m1blood}
                      onChange={(e) => setForm({ ...form, m1blood: e.target.value })}
                    >
                      {BLOOD.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_280px]">
                  <Field label={`${T("મોબાઈલ (લોગિન)", "Mobile (login)")} *`}>
                    <input
                      className="samaj-fld"
                      value={form.m1mobile}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          m1mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                        })
                      }
                      inputMode="numeric"
                    />
                  </Field>
                  {form.hasWhatsApp ? (
                    <div className="mb-3.5">
                      <div className="mb-1 text-xs font-bold text-[var(--muted)]">&nbsp;</div>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, hasWhatsApp: !prev.hasWhatsApp }))}
                        className="samaj-card flex h-[48px] w-full items-center justify-between px-3.5"
                      >
                        <span className="text-[13.5px] font-semibold">
                          {T("આ નંબર પર WhatsApp છે", "This number has WhatsApp")}
                        </span>
                        <span
                          className={cn(
                            "relative h-[27px] w-[46px] rounded-2xl transition-colors",
                            form.hasWhatsApp ? "bg-[var(--brand)]" : "bg-[var(--scroll-thumb)]",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow transition-all",
                              form.hasWhatsApp ? "left-[22px]" : "left-[3px]",
                            )}
                          />
                        </span>
                      </button>
                    </div>
                  ) : (
                    <Field
                      label={
                        <span className="flex items-center justify-between gap-2">
                          <span>{T("WhatsApp નંબર", "WhatsApp number")}</span>
                          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand)]">
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  hasWhatsApp: true,
                                  m1whatsapp: "",
                                }))
                              }
                              className="size-3.5 accent-[var(--brand)]"
                            />
                            {T("એ જ નંબર", "same mobile")}
                          </label>
                        </span>
                      }
                    >
                      <input
                        className="samaj-fld"
                        value={form.m1whatsapp}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            m1whatsapp: e.target.value.replace(/\D/g, "").slice(0, 10),
                          })
                        }
                        inputMode="numeric"
                        placeholder="98765 43210"
                      />
                    </Field>
                  )}
                </div>
                <CascadingOccupationFields
                  tree={occupationTree}
                  t={T}
                  values={form}
                  onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                />
              </div>
              {members.map((m, i) => (
                <div key={i} className="samaj-card mb-3 p-[15px]">
                  <div className="mb-2 flex justify-between">
                    <b>{T(`સભ્ય ${i + 2}`, `Member ${i + 2}`)}</b>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-[#F4EFE6] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-dim)]">
                        {(() => {
                          const relation = relationChoices.find((r) => r.nameEn === m.relation);
                          return relation
                            ? bilingualLabel(relation.nameEn, relation.nameGu)
                            : m.relation;
                        })()}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditMember(i)}
                        className="text-[11px] font-bold text-[var(--brand)]"
                      >
                        {T("ફેરફાર", "Edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMembers((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-[11px] font-bold text-[var(--danger)]"
                      >
                        {T("કાઢી નાખો", "Remove")}
                      </button>
                    </div>
                  </div>
                  <div className="samaj-fld flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 break-words font-semibold text-[var(--ink)]">
                      {lang === "gu" && m.nameGu ? m.nameGu : m.name}
                    </span>
                    <span className="shrink-0 rounded-md bg-[#F4EFE6] px-2 py-0.5 text-[11px] font-bold text-[var(--muted)]">
                      {selectedGroup
                        ? bilingualLabel(selectedGroup.nameEn, selectedGroup.nameGu)
                        : ""}
                    </span>
                  </div>
                  {m.place && (
                    <div className="mt-1.5 flex items-center gap-1.5 px-1 text-[11.5px] font-semibold text-[var(--faint)]">
                      <MapPin className="size-3.5 flex-none text-[var(--ochre)]" strokeWidth={2} />
                      {labelForPlace(m.place, allPlaces, "")}
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={openAddMember}
                className="mb-3 flex h-12 w-full items-center justify-center rounded-[14px] border border-dashed border-[var(--brand-line)] bg-white text-sm font-bold text-[var(--brand)]"
              >
                ＋ {T("બીજા સભ્ય ઉમેરો", "Add another member")}
              </button>
              <PrimaryBtn
                onClick={() => {
                  const err = validateStep2();
                  if (err) return toast.error(err);
                  setStep(3);
                }}
              >
                {T("આગળ", "Next")}
              </PrimaryBtn>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <h2 className="mb-3 text-[15px] font-extrabold">{T("ચકાસો અને મોકલો", "Review & send")}</h2>
              <div className="samaj-card mb-3 p-4">
                <div className="mb-2 text-[11.5px] font-extrabold tracking-wide text-[var(--brand)]">
                  {T("પરિવારની માહિતી", "FAMILY INFO")}
                </div>
                <Kv
                  k={T("અટક", "Surname")}
                  v={selectedGroup ? bilingualLabel(selectedGroup.nameEn, selectedGroup.nameGu) : "—"}
                />
                <Kv k={T("સરનામું", "Address")} v={form.addr || "—"} />
                <Kv k={T("હાલ", "Currently at")} v={placeLabel || "—"} />
                {(form.elder || form.elderGu || form.elderPhone) && (
                  <Kv
                    k={T("વડીલ", "Elder")}
                    v={[lang === "gu" ? form.elderGu || form.elder : form.elder || form.elderGu, form.elderPhone]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                )}
                <button type="button" onClick={() => setStep(1)} className="mt-1.5 text-xs font-bold text-[var(--brand)] underline">
                  {T("ફેરફાર કરવો?", "Make changes?")}
                </button>
              </div>
              <div className="samaj-card mb-3 p-4">
                <div className="mb-2 flex justify-between">
                  <span className="text-[11.5px] font-extrabold tracking-wide text-[var(--brand)]">
                    {T("સભ્યો", "Members")} ({members.length + 1})
                  </span>
                  <button type="button" onClick={() => setStep(2)} className="text-xs font-bold text-[var(--brand)] underline">
                    {T("ફેરફાર", "Edit")}
                  </button>
                </div>
                {[
                  {
                    name: form.m1name,
                    nameGu: form.m1nameGu,
                    relation: "Head",
                    dob: form.m1dob,
                    blood: form.m1blood,
                    occupation: occupationLabel(form),
                    place: form.m1place,
                  },
                  ...members.map((m) => ({
                    name: m.name,
                    nameGu: m.nameGu,
                    relation: m.relation,
                    dob: m.dob,
                    blood: m.blood,
                    occupation: occupationLabel(m),
                    place: m.place,
                  })),
                ].map((member, i) => {
                  const displayName = lang === "gu" && member.nameGu ? member.nameGu : member.name;
                  const parts = [
                    relationLabel(member.relation),
                    member.place ? labelForPlace(member.place, allPlaces, "") : "",
                    member.dob ? `${T("જન્મ", "DOB")} ${formatShortDate(member.dob)}` : "",
                    member.blood || "",
                    member.occupation || "",
                  ].filter(Boolean);
                  return (
                    <div key={i} className="flex items-start gap-3 border-t border-[var(--cream)] py-3 first:border-0">
                      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[var(--danger-tint)] text-[15px] font-extrabold text-[var(--danger)]">
                        {(displayName || "?").trim()[0] || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-bold text-[var(--ink)]">{displayName}</div>
                            <div className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-mid)]">
                              {parts.join(" · ")}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#F8F1E6] px-2.5 py-1 text-[10.5px] font-bold text-[var(--ink-dim)]">
                            {relationBadgeLabel(member.relation)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setConsent(!consent)}
                className="mb-4 flex gap-2.5 rounded-2xl border border-[#EFE3CB] bg-[#FDF9F0] p-3.5 text-left text-[12.5px] leading-relaxed text-[#6B5E42]"
              >
                <span>{consent ? "☑" : "☐"}</span>
                <span>
                  {T(
                    "આ માહિતી સમાજના નોંધાયેલા સભ્યોને બતાવવામાં આવશે તેની હું સંમતિ આપું છું.",
                    "I consent to this information being shown to registered members of the Samaj.",
                  )}
                </span>
              </button>
              <PrimaryBtn onClick={submit} busy={busy}>
                {T("નોંધણી મોકલો", "Submit registration")}
              </PrimaryBtn>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1 text-xs font-bold text-[var(--muted)]">{label}</div>
      {children}
    </div>
  );
}

function PrimaryBtn({
  children,
  onClick,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-extrabold text-white shadow-[0_12px_24px_-10px_rgb(var(--brand-rgb) / .6)] disabled:opacity-70"
      style={{ background: "linear-gradient(135deg,var(--brand),var(--brand-dark))" }}
    >
      {busy ? <Loader2 className="size-5 animate-spin" /> : children}
    </button>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 py-1 text-[13px] text-[var(--ink-soft)]">
      <b className="min-w-[70px] flex-none font-bold text-[var(--faint)]">{k}</b>
      <span>{v}</span>
    </div>
  );
}
