"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { BackHeader } from "@/components/layout/back-header";
import { HeaderLangToggle } from "@/components/ui/lang-toggle";
import { CascadingOccupationFields } from "@/components/forms/cascading-occupation-fields";
import { useLang } from "@/providers/lang-provider";
import { useCommunity } from "@/providers/community-provider";
import { PhotoPicker } from "@/components/forms/photo-picker";
import { api } from "@/lib/http";
import { bloodToEnum, pickText, telLink, waLink } from "@/lib/format";
import { GENDERS, genderFromRelation } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { DateField } from "@/components/ui/date-field";
import { PhoneField } from "@/components/ui/phone-field";
import { NriFields, type NriCityOption } from "@/components/forms/nri-fields";
import { DEFAULT_ISO, digitsOf, formatFull, isValidNumber, numberError } from "@/lib/phone";
import { GujaratiInput } from "@/components/ui/gujarati-keyboard";
import { SpeechInput } from "@/components/ui/speech-input";
import { toast } from "sonner";
import {
  type CascadingOccupationValues,
  blankCascadingOccupation,
  cascadingOccupationSummary,
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
import { PickerWithAdd } from "@/components/ui/picker-with-add";

type Group = { id: string; nameEn: string; nameGu: string | null };
type Place = { id: string; nameEn: string; nameGu: string | null };
type Relation = { nameEn: string; nameGu: string };

type Member = {
  name: string;
  nameGu: string;
  relation: string;
  /** `Gender` enum value — required before the member can be added. */
  gender: string;
  dob: string;
  blood: string;
  mobile: string;
  /** Country of `mobile`. Stored separately — a dial code glued to the number
   *  cannot be taken apart again. */
  mobileIso: string;
  whatsapp: string;
  whatsappIso: string;
  hasWa: boolean;
  /** Living abroad. Replaces the village/city question with country + city. */
  isNri: boolean;
  nriCountry: string;
  nriCity: string;
  /** Where this member currently lives — English name of a village / city. */
  place: string;
} & CascadingOccupationValues;

const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const BLOOD_OPTIONS = BLOOD.map((b) => ({ value: b, label: b }));

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
  gender: genderFromRelation("Son") ?? "",
  dob: "",
  // No pre-selected blood group: "B+" was a guess that silently became the
  // answer for anyone who never opened the picker.
  blood: "",
  mobile: "",
  mobileIso: DEFAULT_ISO,
  whatsapp: "",
  whatsappIso: DEFAULT_ISO,
  hasWa: true,
  isNri: false,
  nriCountry: "",
  nriCity: "",
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
  nriCities,
  contactPerson,
}: {
  communityType: "PARIVAR" | "GAM";
  lockedSurname: Group | null;
  surnameGroups: Group[];
  cities: Place[];
  villages: Place[];
  relations: Relation[];
  occupationTree: OccupationTreeNode[];
  /** Admin-managed NRI cities, grouped by country name. */
  nriCities: NriCityOption[];
  contactPerson: {
    nameEn: string;
    nameGu: string | null;
    mobile: string;
    mobileIso: string;
    role: "DATA_MANAGER" | "OWNER";
  } | null;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const { fromEn, guInput } = useTranslitSync();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);
  // No prop plumbing: `app/layout.tsx` already puts the community in front of
  // every client component.
  const passwordLogin = useCommunity().authMode === "MOBILE_PASSWORD";

  const [step, setStep] = useState(1);
  /** Errors stay hidden until the step is actually attempted — a form that is
   *  red before it is touched reads as broken, not as helpful. */
  const [tried, setTried] = useState<{
    s1: boolean;
    s2: boolean;
    s3: boolean;
    member: boolean;
  }>({ s1: false, s2: false, s3: false, member: false });
  const [addOpen, setAddOpen] = useState(false);
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null);
  const [consent, setConsent] = useState(true);
  const [consentError, setConsentError] = useState(false);
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
    m1photo: "",
    m1mobile: "",
    m1mobileIso: DEFAULT_ISO,
    m1whatsapp: "",
    m1whatsappIso: DEFAULT_ISO,
    m1dob: "",
    m1blood: "",
    m1gender: "",
    m1place: "",
    m1isNri: false,
    m1nriCountry: "",
    m1nriCity: "",
    elderIso: DEFAULT_ISO,
    hasWhatsApp: true,
    ...blankCascadingOccupation(),
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [newMember, setNewMember] = useState<Member>(blankMember);

  /* ── MOBILE_PASSWORD: one number and one password for the whole household ── */
  const [loginMobile, setLoginMobile] = useState("");
  const [loginMobileIso, setLoginMobileIso] = useState(DEFAULT_ISO);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPassword2, setLoginPassword2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  /** Every member who entered a usable mobile. The head comes first, so it is
   *  the default pick without any extra state. */
  const loginCandidates = useMemo(() => {
    const out: { label: string; mobile: string; iso: string }[] = [];
    const push = (label: string, raw: string, iso: string) => {
      const d = digitsOf(raw);
      // Keyed on country too: the same ten digits under two countries are two
      // different accounts.
      if (isValidNumber(d, iso) && !out.some((o) => o.mobile === d && o.iso === iso)) {
        out.push({ label, mobile: d, iso });
      }
    };
    push(form.m1name.trim() || T("વડા", "Head"), form.m1mobile, form.m1mobileIso);
    members.forEach((m, i) =>
      push(m.name.trim() || T(`સભ્ય ${i + 2}`, `Member ${i + 2}`), m.mobile, m.mobileIso),
    );
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.m1name, form.m1mobile, form.m1mobileIso, members, lang]);

  // Required, not polish: editing or removing the member who held the login
  // would otherwise submit a number that belongs to nobody, and the server
  // rejects that.
  useEffect(() => {
    if (!passwordLogin) return;
    if (!loginCandidates.some((c) => c.mobile === loginMobile && c.iso === loginMobileIso)) {
      setLoginMobile(loginCandidates[0]?.mobile ?? "");
      setLoginMobileIso(loginCandidates[0]?.iso ?? DEFAULT_ISO);
    }
  }, [passwordLogin, loginCandidates, loginMobile, loginMobileIso]);

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


  const contactName = contactPerson
    ? pickText(contactPerson.nameGu, contactPerson.nameEn, lang)
    : T("સમાજ સંપર્ક", "Community contact");
  const contactRole = contactPerson?.role === "DATA_MANAGER"
    ? T("ડેટા મેનેજર", "Data Manager")
    : T("એડમિન", "Admin");
  const contactMobile = contactPerson?.mobile || "";
  const contactPhoneHref = contactMobile ? `tel:${contactMobile}` : "#";
  // Through waLink, not a hand-built +91 URL — the coordinator may be abroad.
  const contactWhatsappHref = contactMobile ? waLink(contactMobile, contactPerson?.mobileIso) : "#";

  /**
   * Password communities get a step of their own for the login number and
   * password. It is the one screen that decides how the household gets back in,
   * so it should not be a footnote under the member list.
   */
  const LOGIN_STEP = 3;
  const reviewStep = passwordLogin ? 4 : 3;
  const steps = [
    { n: 1, label: T("માહિતી", "Details") },
    { n: 2, label: T("સભ્યો", "Members") },
    ...(passwordLogin ? [{ n: LOGIN_STEP, label: T("લોગિન", "Login") }] : []),
    { n: reviewStep, label: T("ચકાસો", "Review") },
  ].map((s) => ({ ...s, done: step > s.n, active: step === s.n }));

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
    nativeElderIso: form.elderIso,
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

  /**
   * Both validators return a `field -> message` map instead of one string, so
   * the message can sit under the box it is about. Cheap and pure, so they run
   * on every render once the step has been attempted — which means an error
   * disappears the moment it is fixed, with no per-field wiring.
   */
  type Errs = Record<string, string>;

  function validateStep1(): Errs {
    const e: Errs = {};
    if (!selectedGroup && !surnameGroupId) {
      e.surnameGroup = T("અટક જૂથ પસંદ કરો", "Pick a surname group");
    }
    // Keyed to match FamilyDetailsFields' own field names, so the message lands
    // under the box rather than in a banner at the bottom of the step.
    if (form.addr.trim().length < 3) {
      e.addressEn = T("સરનામું જરૂરી છે", "Address is required");
    }
    return e;
  }

  /** The head's place lives on their member card, so it is validated with step 2. */
  function validateStep2(): Errs {
    const e: Errs = {};
    if (form.m1name.trim().length < 2) e.m1name = T("વડાનું નામ જરૂરી છે", "Head name is required");
    if (!form.m1gender) e.m1gender = T("વડાની જાતિ પસંદ કરો", "Pick the head's gender");
    if (!form.m1dob) e.m1dob = T("જન્મતારીખ જરૂરી છે", "Date of birth is required");

    // The head's mobile is always asked for, whatever their gender — it is the
    // household's way in, and a family headed by a woman must still be able to
    // register and log in. Validated against its own country, not a fixed
    // Indian pattern.
    const mobErr = numberError(form.m1mobile, form.m1mobileIso, T);
    if (mobErr) e.m1mobile = mobErr;

    // A member abroad answers country + city instead of a village.
    if (form.m1isNri) {
      if (!form.m1nriCountry) e.m1nriCountry = T("દેશ પસંદ કરો", "Pick a country");
      if (!form.m1nriCity.trim()) e.m1nriCity = T("શહેર લખો", "Enter a city");
      return e;
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
      e.m1place =
        communityType === "GAM"
          ? T("ગામ / શહેર પસંદ કરો", "Pick the village / city")
          : T("શહેર પસંદ કરો", "Pick the city");
    }
    return e;
  }

  /** MOBILE_PASSWORD only: the login step. */
  function validateStep3(): Errs {
    const e: Errs = {};
    if (!loginMobile) e.loginMobile = T("લોગિન નંબર પસંદ કરો", "Pick the login number");
    if (!/^\d{6}$/.test(loginPassword)) {
      e.loginPassword = T("6 અંકનો પાસવર્ડ નાખો", "Enter a 6-digit password");
    } else if (loginPassword !== loginPassword2) {
      e.loginPassword2 = T("પાસવર્ડ મેળ ખાતો નથી", "Passwords do not match");
    }
    return e;
  }

  /** Add-member sub-form. Mobile is deliberately absent — see the form itself. */
  function validateNewMember(): Errs {
    const e: Errs = {};
    if (newMember.name.trim().length < 2) e.name = T("સભ્યનું નામ જરૂરી છે", "Member name is required");
    if (!newMember.relation) e.relation = T("સબંધ પસંદ કરો", "Pick a relation");
    if (!newMember.gender) e.gender = T("જાતિ પસંદ કરો", "Pick a gender");
    if (!newMember.dob) e.dob = T("જન્મતારીખ જરૂરી છે", "Date of birth is required");
    if (newMember.isNri) {
      if (!newMember.nriCountry) e.nriCountry = T("દેશ પસંદ કરો", "Pick a country");
      if (!newMember.nriCity.trim()) e.nriCity = T("શહેર લખો", "Enter a city");
    }
    // A member's mobile is optional, but a wrong one must not be stored.
    if (newMember.mobile && !isValidNumber(newMember.mobile, newMember.mobileIso)) {
      e.mobile = numberError(newMember.mobile, newMember.mobileIso, T) ?? "";
    }
    return e;
  }

  const errs1 = tried.s1 ? validateStep1() : {};
  const errs2 = tried.s2 ? validateStep2() : {};
  const errs3 = tried.s3 ? validateStep3() : {};
  const errsM = tried.member ? validateNewMember() : {};

  /**
   * Women are not asked for a phone number, so the field is hidden for them —
   * except on the head's card, where the number is the household's login and is
   * asked for regardless.
   */
  const memberWantsMobile = newMember.gender !== "FEMALE";

  /** Switching a member to female drops any number typed for them, so a hidden
   *  field can never quietly submit one. Existing records are untouched: this
   *  only fires when someone actively changes the answer. */
  const setMemberGender = (gender: string) =>
    setNewMember((prev) => ({
      ...prev,
      gender,
      ...(gender === "FEMALE" ? { mobile: "", whatsapp: "", hasWa: true } : {}),
    }));

  async function submit() {
    // Review can only be reached through the earlier steps, but a stale value
    // can still be sitting there — send the user back to the step that owns it
    // rather than firing a toast about a field two screens away.
    setTried((p) => ({ ...p, s1: true, s2: true, s3: true }));
    if (Object.keys(validateStep1()).length > 0) return setStep(1);
    if (Object.keys(validateStep2()).length > 0) return setStep(2);
    if (passwordLogin && Object.keys(validateStep3()).length > 0) return setStep(LOGIN_STEP);
    setConsentError(!consent);
    if (!consent || !selectedGroup) return;

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
      nativeElderPhone: digitsOf(form.elderPhone) || undefined,
      nativeElderIso: form.elderIso,
      latitude: coords.lat ?? undefined,
      longitude: coords.lng ?? undefined,
      consentAccepted: true,
      ...(passwordLogin ? { loginMobile, loginMobileIso, loginPassword } : {}),
      members: [
        {
          fullNameEn: form.m1name.trim(),
          fullNameGu: form.m1nameGu.trim() || undefined,
          relation: "Head",
          gender: form.m1gender || undefined,
          // `|| undefined` so an unfilled head mobile stores NULL, not "" —
          // an empty string still matches `some: { mobile }` lookups and
          // pollutes the FamilyMember.mobile index.
          mobile: digitsOf(form.m1mobile) || undefined,
          mobileIso: form.m1mobileIso,
          whatsappIso: form.hasWhatsApp ? form.m1mobileIso : form.m1whatsappIso,
          isNri: form.m1isNri,
          nriCountry: form.m1isNri ? form.m1nriCountry : undefined,
          nriCity: form.m1isNri ? form.m1nriCity.trim() : undefined,
          bloodGroup: bloodToEnum(form.m1blood),
          // An NRI's "currently at" is the foreign city, which is what every
          // directory screen already reads.
          currentlyAt: form.m1isNri ? form.m1nriCity.trim() || undefined : form.m1place || undefined,
          dateOfBirth: form.m1dob || undefined,
          hasWhatsApp: form.hasWhatsApp,
          whatsapp: form.hasWhatsApp ? undefined : digitsOf(form.m1whatsapp) || undefined,
          isHead: true,
          // Data URL — the server shrinks nothing, it only stores what the
          // browser already downscaled (components/forms/photo-picker.tsx).
          photo: form.m1photo || undefined,
          occupation: headOcc.occupation || undefined,
          occupationOther: headOcc.occupationOther || undefined,
          education: headOcc.education || undefined,
          course: headOcc.course || undefined,
          specialization: headOcc.specialization || undefined,
        },
        ...members.map((m, i) => ({
          fullNameEn: m.name.trim(),
          fullNameGu: m.nameGu.trim() || undefined,
          relation: m.relation,
          gender: m.gender || undefined,
          mobile: digitsOf(m.mobile) || undefined,
          mobileIso: m.mobileIso,
          whatsappIso: m.hasWa ? m.mobileIso : m.whatsappIso,
          isNri: m.isNri,
          nriCountry: m.isNri ? m.nriCountry : undefined,
          nriCity: m.isNri ? m.nriCity.trim() : undefined,
          bloodGroup: bloodToEnum(m.blood),
          currentlyAt: m.isNri ? m.nriCity.trim() || undefined : m.place || city || undefined,
          dateOfBirth: m.dob || undefined,
          hasWhatsApp: m.hasWa,
          whatsapp: m.hasWa ? undefined : digitsOf(m.whatsapp) || undefined,
          isHead: false,
          occupation: memberOcc[i].occupation || undefined,
          occupationOther: memberOcc[i].occupationOther || undefined,
          education: memberOcc[i].education || undefined,
          course: memberOcc[i].course || undefined,
          specialization: memberOcc[i].specialization || undefined,
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
            {/* Password login has no WhatsApp channel at all — promising a
                notification there would be a message that never arrives. */}
            {passwordLogin
              ? T(
                  "2 થી 3 દિવસમાં તમે તમારા નંબર અને પાસવર્ડથી લોગિન કરી શકશો. અને છતાં ના થાય તો તમારી કમિટીનો સંપર્ક કરવો.",
                  "Within 2–3 days you'll be able to log in with your number and password. If you still can't, please contact your committee.",
                )
              : T(
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

            {/* Call only under password login: that community runs no WhatsApp
                channel, so the green button would send them somewhere nobody
                is listening. */}
            <div className={cn("mt-3 grid gap-2.5", passwordLogin ? "grid-cols-1" : "grid-cols-2")}>
              <a
                href={contactPhoneHref}
                className="flex h-11 items-center justify-center rounded-[14px] bg-[var(--brand-tint)] text-[13px] font-extrabold text-[var(--brand)]"
              >
                {T("કોલ કરો", "Call")}
              </a>
              {!passwordLogin && (
                <a
                  href={contactWhatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 items-center justify-center rounded-[14px] bg-[var(--success-tint)] text-[13px] font-extrabold text-[var(--wa-dark)]"
                >
                  WhatsApp
                </a>
              )}
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
              setTried({ s1: false, s2: false, s3: false, member: false });
              setMembers([]);
              setLoginMobile("");
              setLoginPassword("");
              setLoginPassword2("");
              setShowPwd(false);
              setShowPwd2(false);
              setForm({
                addr: "",
                addrGu: "",
                elder: "",
                elderGu: "",
                elderPhone: "",
                loc: "",
                m1name: "",
                m1nameGu: "",
                m1photo: "",
                m1mobile: "",
                m1mobileIso: DEFAULT_ISO,
                m1whatsapp: "",
                m1whatsappIso: DEFAULT_ISO,
                m1dob: "",
                m1blood: "",
                m1gender: "",
                m1place: "",
                m1isNri: false,
                m1nriCountry: "",
                m1nriCity: "",
                elderIso: DEFAULT_ISO,
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
          <Field label={`${T("સબંધ", "Relation")} *`} error={errsM.relation}>
            <div className="flex flex-wrap gap-2">
              {relationChoices.map((r) => (
                <button
                  key={r.nameEn}
                  type="button"
                  onClick={() =>
                    setNewMember((prev) => {
                      // Most relations state the gender; fill it in, but never
                      // overwrite an answer already given.
                      const gender = prev.gender || genderFromRelation(r.nameEn) || "";
                      return {
                        ...prev,
                        relation: r.nameEn,
                        gender,
                        // "Daughter" sets FEMALE without anyone touching the
                        // gender buttons, so the number has to go here too.
                        ...(gender === "FEMALE" ? { mobile: "", whatsapp: "", hasWa: true } : {}),
                      };
                    })
                  }
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
          <Field label={`${T("જાતિ", "Gender")} *`} error={errsM.gender}>
            <div className="flex flex-wrap gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setMemberGender(g.value)}
                  className={cn(
                    "rounded-full px-4 py-2.5 text-[13px] font-bold",
                    newMember.gender === g.value
                      ? "bg-[var(--brand)] text-white"
                      : "border border-[var(--line-field)] bg-white text-[var(--ink-dim)]",
                  )}
                >
                  {lang === "gu" ? g.gu : g.en}
                </button>
              ))}
            </div>
          </Field>
          {/* Above the place question, and replaces it when ticked. */}
          <NriFields
            value={{
              isNri: newMember.isNri,
              nriCountry: newMember.nriCountry,
              nriCity: newMember.nriCity,
            }}
            onChange={(patch) => setNewMember((prev) => ({ ...prev, ...patch }))}
            cities={nriCities}
            error={{ country: errsM.nriCountry, city: errsM.nriCity }}
            t={T}
          />
          {!newMember.isNri && (
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
          )}
          <div className="mb-3.5 grid grid-cols-2 gap-2.5">
            <Field label={`${T("જન્મ", "DOB")} *`} error={errsM.dob}>
              <DateField
                dob
                value={newMember.dob}
                onChange={(v) => setNewMember({ ...newMember, dob: v })}
                t={T}
              />
            </Field>
            <Field label={T("બ્લડ", "Blood")}>
              <PickerWithAdd
                value={newMember.blood}
                onChange={(v) => setNewMember({ ...newMember, blood: v })}
                options={BLOOD_OPTIONS}
                placeholder={T("બ્લડ ગ્રુપ પસંદ કરો", "Select blood group")}
                t={T}
              />
            </Field>
          </div>
          {/* Not asked of women. The head's card asks regardless of gender —
              that number is the household's login. */}
          <div
            className={cn(
              "mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_280px]",
              !memberWantsMobile && "hidden",
            )}
          >
            <Field label={T("મોબાઈલ (વૈકલ્પિક)", "Mobile (optional)")}>
              <PhoneField
                value={{ iso: newMember.mobileIso, digits: newMember.mobile }}
                onChange={(v) =>
                  setNewMember((prev) => ({
                    ...prev,
                    mobile: v.digits,
                    mobileIso: v.iso,
                    whatsappIso: prev.hasWa ? v.iso : prev.whatsappIso,
                  }))
                }
                t={T}
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
                <PhoneField
                  value={{ iso: newMember.whatsappIso, digits: newMember.whatsapp }}
                  onChange={(v) =>
                    setNewMember((prev) => ({ ...prev, whatsapp: v.digits, whatsappIso: v.iso }))
                  }
                  t={T}
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
              // These used to fail silently — the button just did nothing —
              // then loudly, as a toast. Now the message sits under the field.
              setTried((p) => ({ ...p, member: true }));
              if (Object.keys(validateNewMember()).length > 0) return;
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
          <HeaderLangToggle />
        </div>
        {/* Connector count follows the step count — it used to be hard-coded to
            two, so a fourth step lost its line and drifted to the right edge.
            Each step is a fixed-width column so the labels stay centred under
            their circle; only the connectors stretch. */}
        <div className="relative z-2 mx-auto mt-4 flex w-full max-w-[680px] items-start gap-1.5">
          {steps.map((s, idx) => (
            <Fragment key={s.n}>
              <div className="flex w-[56px] flex-none flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] font-extrabold transition-colors",
                    s.active
                      ? "bg-white text-[var(--brand)]"
                      : s.done
                        ? "bg-[var(--gold)] text-white"
                        : "bg-white/18 text-white/70",
                  )}
                >
                  {s.done ? "✓" : s.n}
                </div>
                <span
                  className={cn(
                    "text-center text-[9.5px] leading-tight font-bold",
                    s.active ? "text-white" : "text-white/60",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                // 13.5px = half the 30px circle minus half the 3px bar, so the
                // line meets the circles at their centre.
                <div
                  className={cn(
                    "mt-[13.5px] h-[3px] flex-1 rounded-sm transition-colors",
                    s.done ? "bg-[var(--gold)]" : "bg-white/25",
                  )}
                />
              )}
            </Fragment>
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
                errors={errs1}
                t={T}
              />

              <PrimaryBtn
                onClick={() => {
                  setTried((p) => ({ ...p, s1: true }));
                  if (Object.keys(validateStep1()).length > 0) return;
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
                {/* Head only — the rest of the household is not asked for one. */}
                <PhotoPicker
                  className="mb-3.5"
                  value={form.m1photo}
                  onChange={(v) => setForm((prev) => ({ ...prev, m1photo: v }))}
                  label={T("વડાનો ફોટો", "Head's photo")}
                  hint={T(
                    "મરજિયાત — ડિરેક્ટરીમાં પરિવારના વડા સાથે દેખાશે.",
                    "Optional — shown with the family head in the directory.",
                  )}
                />
                <Field label={`${T("પૂરું નામ", "Full name")} *`} error={errs2.m1name}>
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
                {/* Sits above the place question and replaces it when ticked. */}
                <NriFields
                  value={{
                    isNri: form.m1isNri,
                    nriCountry: form.m1nriCountry,
                    nriCity: form.m1nriCity,
                  }}
                  onChange={(patch) =>
                    setForm((prev) => ({
                      ...prev,
                      ...(patch.isNri !== undefined ? { m1isNri: patch.isNri } : {}),
                      ...(patch.nriCountry !== undefined ? { m1nriCountry: patch.nriCountry } : {}),
                      ...(patch.nriCity !== undefined ? { m1nriCity: patch.nriCity } : {}),
                    }))
                  }
                  cities={nriCities}
                  error={{ country: errs2.m1nriCountry, city: errs2.m1nriCity }}
                  t={T}
                />
                {!form.m1isNri && (
                  <Field
                    label={`${communityType === "GAM" ? T("ગામ / શહેર", "Village / city") : T("શહેર", "City")} *`}
                    error={errs2.m1place}
                  >
                    <MemberPlacePicker
                      value={form.m1place}
                      onChange={(v) => setForm((prev) => ({ ...prev, m1place: v }))}
                      options={allPlaces}
                      onAddNew={addPlace}
                      t={T}
                    />
                  </Field>
                )}
                <Field label={`${T("જાતિ", "Gender")} *`} error={errs2.m1gender}>
                  <div className="flex flex-wrap gap-2">
                    {GENDERS.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, m1gender: g.value }))}
                        className={cn(
                          "rounded-full px-4 py-2.5 text-[13px] font-bold",
                          form.m1gender === g.value
                            ? "bg-[var(--brand)] text-white"
                            : "border border-[var(--line-field)] bg-white text-[var(--ink-dim)]",
                        )}
                      >
                        {lang === "gu" ? g.gu : g.en}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={`${T("જન્મ", "DOB")} *`} error={errs2.m1dob}>
                    <DateField
                      dob
                      value={form.m1dob}
                      onChange={(v) => setForm({ ...form, m1dob: v })}
                      t={T}
                    />
                  </Field>
                  <Field label={T("બ્લડ", "Blood")}>
                    <PickerWithAdd
                      value={form.m1blood}
                      onChange={(v) => setForm({ ...form, m1blood: v })}
                      options={BLOOD_OPTIONS}
                      placeholder={T("બ્લડ ગ્રુપ પસંદ કરો", "Select blood group")}
                      t={T}
                    />
                  </Field>
                </div>
                <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_280px]">
                  {/* Always asked, whatever the head's gender — this is the
                      household's way in. Under MOBILE_PASSWORD they may still
                      hand the login to another member further down. */}
                  <Field
                    label={`${T("મોબાઈલ", "Mobile")}${passwordLogin ? "" : ` ${T("(લોગિન)", "(login)")}`} *`}
                    error={errs2.m1mobile}
                  >
                    <PhoneField
                      value={{ iso: form.m1mobileIso, digits: form.m1mobile }}
                      onChange={(v) =>
                        setForm((prev) => ({
                          ...prev,
                          m1mobile: v.digits,
                          m1mobileIso: v.iso,
                          // The WhatsApp number follows the mobile's country
                          // until it is given one of its own.
                          m1whatsappIso: prev.hasWhatsApp ? v.iso : prev.m1whatsappIso,
                        }))
                      }
                      t={T}
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
                      <PhoneField
                        value={{ iso: form.m1whatsappIso, digits: form.m1whatsapp }}
                        onChange={(v) =>
                          setForm((prev) => ({ ...prev, m1whatsapp: v.digits, m1whatsappIso: v.iso }))
                        }
                        t={T}
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
                  setTried((p) => ({ ...p, s2: true }));
                  if (Object.keys(validateStep2()).length > 0) return;
                  setStep(3);
                }}
              >
                {passwordLogin ? T("આગળ: લોગિન", "Next: login") : T("આગળ", "Next")}
              </PrimaryBtn>
            </motion.div>
          )}

          {/* Step 3 under MOBILE_PASSWORD — how this household gets back in.
              Its own screen rather than a card under the member list, because
              it is the one answer they will need again months from now. */}
          {passwordLogin && step === LOGIN_STEP && (
            <motion.div key="sLogin" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <h2 className="mb-1 text-[15px] font-extrabold">
                {T("લોગિન નંબર અને પાસવર્ડ", "Login number & password")}
              </h2>
              <p className="mb-3 text-[12.5px] leading-snug text-[var(--faint)]">
                {T(
                  "આખો પરિવાર આ એક જ નંબર અને પાસવર્ડથી લોગિન કરશે",
                  "The whole family logs in with this one number and password",
                )}
              </p>

              <div className="samaj-card mb-3 p-[15px]">
                <b className="text-[13.5px]">{T("કયો નંબર?", "Which number?")}</b>
                <p className="mb-2.5 mt-0.5 text-[11.5px] leading-snug text-[var(--faint)]">
                  {T(
                    "જે સભ્યોના મોબાઈલ ભર્યા છે એમાંથી પસંદ કરો",
                    "Pick from the members who gave a mobile number",
                  )}
                </p>

                {loginCandidates.length === 0 ? (
                  <p className="samaj-fld text-[12.5px] font-semibold text-[var(--danger)]">
                    {T("પહેલાં વડાનો મોબાઈલ ભરો", "Fill in the head's mobile first")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {loginCandidates.map((c) => (
                      <button
                        key={c.mobile}
                        type="button"
                        onClick={() => {
                          setLoginMobile(c.mobile);
                          setLoginMobileIso(c.iso);
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-[12px] border-[1.5px] px-3 py-2.5 text-left",
                          loginMobile === c.mobile && loginMobileIso === c.iso
                            ? "border-[var(--brand)] bg-[var(--brand-tint)]"
                            : "border-[var(--line-input)] bg-white",
                        )}
                      >
                        <span className="min-w-0 break-words text-[13px] font-bold text-[var(--ink)]">
                          {c.label}
                        </span>
                        <span className="shrink-0 text-[12.5px] font-semibold text-[var(--faint)]">
                          {c.mobile}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {errs3.loginMobile && (
                  <p className="mt-2 text-[11.5px] font-bold text-[var(--danger)]">
                    {errs3.loginMobile}
                  </p>
                )}
              </div>

              <div className="samaj-card mb-3 p-[15px]">
                <b className="text-[13.5px]">{T("પાસવર્ડ", "Password")}</b>
                <p className="mb-2.5 mt-0.5 text-[11.5px] leading-snug text-[var(--faint)]">
                  {T("બરાબર 6 અંક", "Exactly 6 digits")}
                </p>
                <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
                  <PinField
                    label={`${T("પાસવર્ડ (6 અંક)", "Password (6 digits)")} *`}
                    value={loginPassword}
                    onChange={setLoginPassword}
                    error={errs3.loginPassword}
                    show={showPwd}
                    onToggle={() => setShowPwd((v) => !v)}
                    t={T}
                  />
                  <PinField
                    label={`${T("પાસવર્ડ ફરી લખો", "Re-enter password")} *`}
                    value={loginPassword2}
                    onChange={setLoginPassword2}
                    error={errs3.loginPassword2}
                    show={showPwd2}
                    onToggle={() => setShowPwd2((v) => !v)}
                    t={T}
                  />
                </div>
              </div>

              <PrimaryBtn
                onClick={() => {
                  setTried((p) => ({ ...p, s3: true }));
                  if (Object.keys(validateStep3()).length > 0) return;
                  setStep(reviewStep);
                }}
              >
                {T("આગળ", "Next")}
              </PrimaryBtn>
            </motion.div>
          )}

          {step === reviewStep && (
            <motion.div key="sReview" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
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
                {/* The number, never the password. */}
                {passwordLogin && (
                  <>
                    <Kv k={T("લોગિન નંબર", "Login number")} v={loginMobile ? formatFull(loginMobile, loginMobileIso) : "—"} />
                    <button
                      type="button"
                      onClick={() => setStep(LOGIN_STEP)}
                      className="mt-1.5 mr-3 text-xs font-bold text-[var(--brand)] underline"
                    >
                      {T("લોગિન બદલો?", "Change login?")}
                    </button>
                  </>
                )}
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
                    occupation: cascadingOccupationSummary(form),
                    place: form.m1place,
                  },
                  ...members.map((m) => ({
                    name: m.name,
                    nameGu: m.nameGu,
                    relation: m.relation,
                    dob: m.dob,
                    blood: m.blood,
                    occupation: cascadingOccupationSummary(m),
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
                onClick={() => {
                  setConsent(!consent);
                  setConsentError(false);
                }}
                className={cn(
                  "mb-1.5 flex gap-2.5 rounded-2xl border p-3.5 text-left text-[12.5px] leading-relaxed",
                  consentError
                    ? "border-[var(--danger)] bg-[var(--danger-tint)] text-[var(--danger)]"
                    : "border-[#EFE3CB] bg-[#FDF9F0] text-[#6B5E42]",
                )}
              >
                <span>{consent ? "☑" : "☐"}</span>
                <span>
                  {T(
                    "આ માહિતી સમાજના નોંધાયેલા સભ્યોને બતાવવામાં આવશે તેની હું સંમતિ આપું છું.",
                    "I consent to this information being shown to registered members of the Samaj.",
                  )}
                </span>
              </button>
              {consentError && (
                <p className="mb-3 text-[11.5px] font-bold text-[var(--danger)]">
                  {T("સંમતિ જરૂરી છે", "Consent is required")}
                </p>
              )}
              <div className="mb-4" />
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

function Field({
  label,
  error,
  children,
}: {
  label: React.ReactNode;
  /** Shown under the field. Replaces the toast that used to fire on Next —
   *  a toast names the problem but not the box it belongs to. */
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <div className="mb-1 text-xs font-bold text-[var(--muted)]">{label}</div>
      {children}
      {error && (
        <p className="mt-1 text-[11.5px] font-bold text-[var(--danger)]">{error}</p>
      )}
    </div>
  );
}

/**
 * A 6-digit PIN with a show/hide eye.
 *
 * The eye matters more here than on a normal password box: the family is
 * choosing a number they must remember, and a row of dots gives them no way to
 * check what they typed before committing to it.
 */
function PinField({
  label,
  value,
  onChange,
  error,
  show,
  onToggle,
  t,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  show: boolean;
  onToggle: () => void;
  t: (gu: string, en: string) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-bold text-[var(--ink-mid)]">{label}</span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          className="samaj-fld w-full pr-11 tracking-[0.3em]"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? t("છુપાવો", "Hide") : t("બતાવો", "Show")}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-[var(--faint)]"
        >
          {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      </div>
      {error && <p className="mt-1 text-[11.5px] font-bold text-[var(--danger)]">{error}</p>}
    </label>
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
