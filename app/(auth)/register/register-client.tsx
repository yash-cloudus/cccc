"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { bloodToEnum, pickText } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { GujaratiInput } from "@/components/ui/gujarati-keyboard";

type Group = { id: string; nameEn: string; nameGu: string | null };
type Village = { id: string; nameEn: string; nameGu: string | null };

type Member = {
  name: string;
  nameGu: string;
  relation: string;
  dob: string;
  blood: string;
  mobile: string;
  hasWa: boolean;
};

const RELATIONS = [
  { gu: "પુત્ર", en: "Son" },
  { gu: "પુત્રી", en: "Daughter" },
  { gu: "પત્ની", en: "Wife" },
  { gu: "પિતા", en: "Father" },
  { gu: "માતા", en: "Mother" },
  { gu: "ભાઈ", en: "Brother" },
];

const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export function RegisterClient({
  surnameGroups,
  villages,
}: {
  surnameGroups: Group[];
  villages: Village[];
}) {
  const { lang } = useLang();
  const router = useRouter();
  const { fromEn, guInput } = useTranslitSync();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const [step, setStep] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [halOpen, setHalOpen] = useState(false);
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [surnameGroupId, setSurnameGroupId] = useState(surnameGroups[0]?.id ?? "");
  const selectedGroup = useMemo(
    () => surnameGroups.find((g) => g.id === surnameGroupId) ?? null,
    [surnameGroups, surnameGroupId],
  );

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of villages) {
      if (v.nameEn) set.add(v.nameEn);
    }
    return [...set];
  }, [villages]);

  const [city, setCity] = useState(cityOptions[0] ?? "");

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
    m1dob: "",
    m1blood: "B+",
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [newMember, setNewMember] = useState<Member>({
    name: "",
    nameGu: "",
    relation: "Son",
    dob: "",
    blood: "B+",
    mobile: "",
    hasWa: true,
  });

  const steps = [1, 2, 3].map((n) => ({
    n,
    done: step > n,
    active: step === n,
  }));

  function validateStep1() {
    if (!surnameGroupId) return T("અટક જૂથ પસંદ કરો", "Pick a surname group");
    if (form.addr.trim().length < 3) return T("સરનામું જરૂરી છે", "Address is required");
    return null;
  }

  function validateStep2() {
    if (form.m1name.trim().length < 2) return T("વડાનું નામ જરૂરી છે", "Head name is required");
    if (!/^\d{10}$/.test(form.m1mobile.replace(/\D/g, ""))) {
      return T("લોગિન મોબાઈલ 10 અંકનો હોવો જોઈએ", "Login mobile must be 10 digits");
    }
    return null;
  }

  async function submit() {
    const e1 = validateStep1();
    if (e1) return setError(e1);
    const e2 = validateStep2();
    if (e2) return setError(e2);
    if (!consent) return setError(T("સંમતિ જરૂરી છે", "Consent is required"));
    if (!selectedGroup) return setError(T("અટક જૂથ પસંદ કરો", "Pick a surname group"));

    setBusy(true);
    setError(null);

    const payload = {
      surnameGroupId,
      headNameEn: form.m1name.trim(),
      headNameGu: form.m1nameGu.trim() || undefined,
      surnameEn: selectedGroup.nameEn,
      surnameGu: selectedGroup.nameGu || undefined,
      addressEn: form.addr.trim(),
      addressGu: form.addrGu.trim() || undefined,
      city: city || undefined,
      nativeElderNameEn: form.elder.trim() || undefined,
      nativeElderPhone: form.elderPhone.trim() || undefined,
      consentAccepted: true,
      members: [
        {
          fullNameEn: form.m1name.trim(),
          fullNameGu: form.m1nameGu.trim() || undefined,
          relation: "Head",
          mobile: form.m1mobile.replace(/\D/g, ""),
          bloodGroup: bloodToEnum(form.m1blood),
          currentlyAt: city || undefined,
          dateOfBirth: form.m1dob || undefined,
          hasWhatsApp: true,
          isHead: true,
        },
        ...members.map((m) => ({
          fullNameEn: m.name.trim(),
          fullNameGu: m.nameGu.trim() || undefined,
          relation: m.relation,
          mobile: m.mobile.replace(/\D/g, "") || undefined,
          bloodGroup: bloodToEnum(m.blood),
          currentlyAt: city || undefined,
          dateOfBirth: m.dob || undefined,
          hasWhatsApp: m.hasWa,
          isHead: false,
        })),
      ],
    };

    const res = await api.post("/api/families", payload);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AppShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-9 text-center">
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
          <p className="max-w-[280px] text-[13.5px] leading-relaxed text-[var(--ink-mid)]">
            {T(
              "એડમિન મંજૂરી આપશે એટલે તમારા WhatsApp નંબર પર જાણ થશે. પછી એ જ નંબરથી લોગિન કરી શકાશે.",
              "Once the admin approves, you'll be notified on your WhatsApp number. You can then log in with that number.",
            )}
          </p>
          {selectedGroup && (
            <div className="samaj-card mt-1.5 w-full max-w-[300px] p-4 text-left">
              <div className="mb-2.5 text-[11.5px] font-extrabold tracking-wide text-[var(--brand)]">
                {T("અટક જૂથ", "SURNAME GROUP")}
              </div>
              <div className="text-sm font-bold text-[var(--ink)]">
                {pickText(selectedGroup.nameGu, selectedGroup.nameEn, lang)}
              </div>
              <div className="mt-1 text-[11.5px] font-medium text-[var(--faint)]">
                {T("મંજૂરી માટે એડમિન કતારમાં", "In admin approval queue")}
              </div>
            </div>
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
                m1dob: "",
                m1blood: "B+",
              });
            }}
            className="mt-1 w-full max-w-[280px] rounded-[14px] border border-dashed border-[var(--brand-line)] bg-white py-3 text-sm font-bold text-[var(--brand)]"
          >
            {T("બીજા પરિવારની નોંધણી કરો", "Register another family")}
          </button>
          <Link
            href="/login"
            className="flex h-[52px] w-full max-w-[280px] items-center justify-center rounded-2xl text-[15px] font-extrabold text-white shadow-[0_12px_24px_-10px_rgb(var(--brand-rgb) / .6)]"
            style={{ background: "linear-gradient(135deg,var(--brand),var(--brand-dark))" }}
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
          title={T("નવો સભ્ય ઉમેરો", "Add new member")}
          subtitle={T("ઘરના સભ્યની માહિતી ભરો", "Fill in the household member's details")}
          onBack={() => setAddOpen(false)}
        />
        <div className="flex-1 px-4 py-[18px] pb-6">
          <Field label={`${T("પૂરું નામ", "Full name")} (${T("English", "English")}) *`}>
            <input
              className="samaj-fld"
              value={newMember.name}
              onChange={(e) => {
                const v = e.target.value;
                setNewMember((prev) => ({ ...prev, name: v }));
                fromEn(v, (gu) => setNewMember((prev) => ({ ...prev, nameGu: gu })), "newMember");
              }}
              placeholder={T("નામ લખો…", "Enter name…")}
            />
          </Field>
          <Field label={`${T("પૂરું નામ", "Full name")} (${T("ગુજરાતી", "Gujarati")})`}>
            <GujaratiInput
              inputClassName="samaj-fld"
              value={newMember.nameGu}
              onChange={(v) => {
                setNewMember((prev) => ({ ...prev, nameGu: v }));
                guInput(v, (gu) => setNewMember((prev) => ({ ...prev, nameGu: gu })), "newMember:gu");
              }}
            />
          </Field>
          <Field label={`${T("સબંધ", "Relation")} *`}>
            <div className="flex flex-wrap gap-2">
              {RELATIONS.map((r) => (
                <button
                  key={r.en}
                  type="button"
                  onClick={() => setNewMember({ ...newMember, relation: r.en })}
                  className={cn(
                    "rounded-full px-4 py-2.5 text-[13px] font-bold",
                    newMember.relation === r.en
                      ? "bg-[var(--brand)] text-white"
                      : "border border-[var(--line-field)] bg-white text-[var(--ink-dim)]",
                  )}
                >
                  {lang === "gu" ? r.gu : r.en}
                </button>
              ))}
            </div>
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
          <Field label={T("મોબાઈલ (વૈકલ્પિક)", "Mobile (optional)")}>
            <input
              className="samaj-fld"
              value={newMember.mobile}
              onChange={(e) => setNewMember({ ...newMember, mobile: e.target.value })}
              inputMode="numeric"
            />
          </Field>
          <button
            type="button"
            onClick={() => setNewMember({ ...newMember, hasWa: !newMember.hasWa })}
            className="samaj-card mb-4 flex items-center justify-between px-3.5 py-3"
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
          <button
            type="button"
            onClick={() => {
              if (newMember.name.trim().length < 2) return;
              setMembers([...members, newMember]);
              setAddOpen(false);
              setNewMember({
                name: "",
                nameGu: "",
                relation: "Son",
                dob: "",
                blood: "B+",
                mobile: "",
                hasWa: true,
              });
            }}
            className="flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-extrabold text-white"
            style={{ background: "linear-gradient(135deg,var(--brand),var(--brand-dark))" }}
          >
            {T("સભ્ય ઉમેરો", "Add member")}
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-[18px] pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 flex items-center gap-3">
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
        <div className="relative z-2 mt-4 flex items-center gap-2">
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

      <div className="flex-1 px-4 py-4 pb-6">
        {error && <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>}

        {surnameGroups.length === 0 && (
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
              <div className="mb-3 grid grid-cols-2 gap-2.5">
                <Field label={`${T("અટક જૂથ", "Surname group")} *`}>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setGroupOpen(!groupOpen)}
                      className="samaj-fld flex w-full items-center justify-between bg-[var(--field)]"
                    >
                      <span className="truncate">
                        {selectedGroup
                          ? pickText(selectedGroup.nameGu, selectedGroup.nameEn, lang)
                          : T("પસંદ કરો", "Select")}
                      </span>
                      <ChevronDown className="h-5 w-5 flex-none text-[var(--brand)]" />
                    </button>
                    {groupOpen && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-[13px] border border-[var(--line-field)] bg-white shadow-lg">
                        {surnameGroups.map((g, i) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => {
                              setSurnameGroupId(g.id);
                              setGroupOpen(false);
                            }}
                            className={cn(
                              "block w-full px-3 py-2.5 text-left text-sm",
                              i > 0 && "border-t border-[var(--line-soft)]",
                              surnameGroupId === g.id && "bg-[var(--brand-tint)] font-bold text-[var(--brand)]",
                            )}
                          >
                            {pickText(g.nameGu, g.nameEn, lang)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
                <Field label={T("(ગુજરાતી)", "(Gujarati)")}>
                  <div className="flex min-h-[44px] items-center rounded-[13px] border border-dashed border-[var(--line-input)] bg-[#F7F3EC] px-3.5 text-sm text-[var(--ink-dim)]">
                    {selectedGroup?.nameGu || selectedGroup?.nameEn || "—"}
                  </div>
                </Field>
              </div>
              <Field label={`${T("હાલનું સરનામું", "Current address")} (${T("English", "English")}) *`}>
                <input
                  className="samaj-fld"
                  value={form.addr}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((prev) => ({ ...prev, addr: v }));
                    fromEn(v, (gu) => setForm((prev) => ({ ...prev, addrGu: gu })), "addr");
                  }}
                  placeholder={T("મકાન, વિસ્તાર, શહેર…", "House, area, city…")}
                />
                <input
                  className="samaj-fld mt-2"
                  value={form.addrGu}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((prev) => ({ ...prev, addrGu: v }));
                    guInput(v, (gu) => setForm((prev) => ({ ...prev, addrGu: gu })), "addr:gu");
                  }}
                  placeholder={T("ગુજરાતીમાં…", "In Gujarati…")}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setForm({
                            ...form,
                            loc: `${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E`,
                          });
                        },
                        () => setForm({ ...form, loc: city || T("સ્થળ સેવ થયું", "Location saved") }),
                      );
                    } else {
                      setForm({ ...form, loc: city || T("સ્થળ સેવ થયું", "Location saved") });
                    }
                  }}
                  className="mt-2 flex h-12 w-full items-center gap-2.5 rounded-[13px] border-[1.5px] border-[var(--line-input)] bg-white px-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EAF2E8] text-[#1E7A3E]">
                    <MapPin className="h-[19px] w-[19px]" />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-[13.5px] font-bold text-[var(--ink)]">
                      {form.loc
                        ? T("સ્થળ સેવ થયું", "Location captured")
                        : T("નકશા પર સ્થળ પસંદ કરો", "Pin location on map")}
                    </div>
                    {form.loc && <div className="text-[11.5px] font-semibold text-[#1E7A3E]">{form.loc}</div>}
                  </div>
                </button>
              </Field>
              {cityOptions.length > 0 && (
                <Field label={T("હાલ", "Currently at")}>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setHalOpen(!halOpen)}
                      className="samaj-fld flex w-full items-center justify-between"
                    >
                      {city || T("પસંદ કરો", "Select")}
                      <ChevronDown className="h-5 w-5 text-[var(--brand)]" />
                    </button>
                    {halOpen && (
                      <div className="absolute left-0 right-0 top-full z-15 mt-1 overflow-hidden rounded-[13px] border border-[var(--line-field)] bg-white shadow-lg">
                        {cityOptions.map((o, i) => (
                          <button
                            key={o}
                            type="button"
                            onClick={() => {
                              setCity(o);
                              setHalOpen(false);
                            }}
                            className={cn(
                              "block w-full px-3 py-2.5 text-left text-sm",
                              i > 0 && "border-t border-[var(--line-soft)]",
                              city === o && "bg-[var(--brand-tint)] font-bold text-[var(--brand)]",
                            )}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
              )}
              <Field label={T("વતનમાં રહેતા વડીલ (નામ)", "Native elder (name)")}>
                <input
                  className="samaj-fld"
                  value={form.elder}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((prev) => ({ ...prev, elder: v }));
                    fromEn(v, (gu) => setForm((prev) => ({ ...prev, elderGu: gu })), "elder");
                  }}
                />
                <input
                  className="samaj-fld mt-2"
                  value={form.elderGu}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((prev) => ({ ...prev, elderGu: v }));
                    guInput(v, (gu) => setForm((prev) => ({ ...prev, elderGu: gu })), "elder:gu");
                  }}
                />
              </Field>
              <Field label={T("વતનમાં રહેતા વડીલ (ફોન)", "Native elder (phone)")}>
                <input
                  className="samaj-fld"
                  value={form.elderPhone}
                  onChange={(e) => setForm({ ...form, elderPhone: e.target.value })}
                  inputMode="numeric"
                />
              </Field>
              <PrimaryBtn
                onClick={() => {
                  const err = validateStep1();
                  if (err) return setError(err);
                  setError(null);
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
                    {selectedGroup ? pickText(selectedGroup.nameGu, selectedGroup.nameEn, lang) : "—"}
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
                  <input
                    className="samaj-fld"
                    value={form.m1name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((prev) => ({ ...prev, m1name: v }));
                      fromEn(v, (gu) => setForm((prev) => ({ ...prev, m1nameGu: gu })), "m1");
                    }}
                  />
                </Field>
                <Field label={`${T("પૂરું નામ", "Full name")} (${T("ગુજરાતી", "Gujarati")})`}>
                  <GujaratiInput
                    inputClassName="samaj-fld"
                    value={form.m1nameGu}
                    onChange={(v) => {
                      setForm((prev) => ({ ...prev, m1nameGu: v }));
                      guInput(v, (gu) => setForm((prev) => ({ ...prev, m1nameGu: gu })), "m1:gu");
                    }}
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
                <Field label={`${T("મોબાઈલ (લોગિન)", "Mobile (login)")} *`}>
                  <input
                    className="samaj-fld"
                    value={form.m1mobile}
                    onChange={(e) => setForm({ ...form, m1mobile: e.target.value })}
                    inputMode="numeric"
                  />
                </Field>
              </div>
              {members.map((m, i) => (
                <div key={i} className="samaj-card mb-3 p-[15px]">
                  <div className="mb-2 flex justify-between">
                    <b>{T(`સભ્ય ${i + 2}`, `Member ${i + 2}`)}</b>
                    <span className="rounded-lg bg-[#F4EFE6] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-dim)]">
                      {m.relation}
                    </span>
                  </div>
                  <div className="samaj-fld flex justify-between">
                    {lang === "gu" && m.nameGu ? m.nameGu : m.name}
                    <span className="rounded-md bg-[#F4EFE6] px-2 py-0.5 text-[11px] font-bold text-[var(--muted)]">
                      {selectedGroup ? selectedGroup.nameEn : ""}
                    </span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="mb-3 flex h-12 w-full items-center justify-center rounded-[14px] border border-dashed border-[var(--brand-line)] bg-white text-sm font-bold text-[var(--brand)]"
              >
                ＋ {T("બીજા સભ્ય ઉમેરો", "Add another member")}
              </button>
              <PrimaryBtn
                onClick={() => {
                  const err = validateStep2();
                  if (err) return setError(err);
                  setError(null);
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
                  v={selectedGroup ? pickText(selectedGroup.nameGu, selectedGroup.nameEn, lang) : "—"}
                />
                <Kv k={T("સરનામું", "Address")} v={form.addr || "—"} />
                <Kv k={T("હાલ", "Currently at")} v={city || "—"} />
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
                {[form.m1name, ...members.map((m) => m.name)].map((n, i) => (
                  <div key={i} className="flex items-center gap-3 border-t border-[var(--cream)] py-2 first:border-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--danger-tint)] text-[15px] font-extrabold text-[var(--danger)]">
                      {n.trim()[0] || "?"}
                    </div>
                    <div className="flex-1 text-[13.5px] font-bold">{n}</div>
                  </div>
                ))}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
