"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  Droplet,
  Info,
  Loader2,
  Phone,
  Plus,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { AppScreen } from "@/components/layout/app-screen";
import { HeaderLangToggle } from "@/components/ui/lang-toggle";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { bloodLabel, bloodToEnum, formatDate, pickText, relationLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { GujaratiInput } from "@/components/ui/gujarati-keyboard";
import { SpeechInput } from "@/components/ui/speech-input";
import { PickerWithAdd } from "@/components/ui/picker-with-add";
import { DateField } from "@/components/ui/date-field";
import { PhoneField } from "@/components/ui/phone-field";
import { DEFAULT_ISO } from "@/lib/phone";
import { CascadingOccupationFields } from "@/components/forms/cascading-occupation-fields";
import {
  type CascadingOccupationValues,
  blankCascadingOccupation,
  cascadingFromStored,
  resolveCascadingOccupationForSave,
} from "@/lib/cascading-occupation";
import type { OccupationTreeNode } from "@/lib/occupation-defaults";

type FamilyMemberRow = {
  id: string;
  fullNameEn: string;
  fullNameGu: string | null;
  relation: string | null;
  mobile: string | null;
  mobileIso: string | null;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  occupation: string | null;
  occupationOther: string | null;
  education: string | null;
  course: string | null;
  specialization: string | null;
  currentlyAt: string | null;
  hasWhatsApp: boolean;
  isHead: boolean;
};

type ProfileResp = {
  profile:
    | {
        id: string;
        source: "profile" | "familyMember";
        familyId: string | null;
        fullNameEn: string;
        fullNameGu: string | null;
        relation: string | null;
        dateOfBirth: string | null;
        bloodGroup: string | null;
        occupation: string | null;
        occupationOther: string | null;
        education: string | null;
        course: string | null;
        specialization: string | null;
        currentlyAt: string | null;
        showPhone: boolean;
        family: {
          id: string;
          familyMembers: FamilyMemberRow[];
          surnameGroup: { nameEn: string; nameGu: string | null } | null;
        } | null;
      }
    | null;
  mobile: string | null;
  mobileIso: string | null;
  pendingUpdateRequest: { id: string; submittedAt: string } | null;
};

const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

/** Avatar tints cycled across the family list, like the reference design. */
const MEMBER_TINTS = [
  { bg: "var(--violet-tint)", fg: "var(--violet)" },
  { bg: "var(--danger-tint)", fg: "var(--danger)" },
  { bg: "var(--leaf-tint)", fg: "var(--leaf)" },
  { bg: "var(--ochre-tint)", fg: "var(--ochre)" },
  { bg: "var(--info-tint)", fg: "var(--info)" },
];

function ageOf(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

type EditTarget =
  | { kind: "self" }
  | { kind: "member"; member: FamilyMemberRow }
  | { kind: "new" };

type EditForm = {
  fullNameEn: string;
  fullNameGu: string;
  relation: string;
  mobile: string;
  mobileIso: string;
  dateOfBirth: string;
  currentlyAt: string;
  blood: string;
} & CascadingOccupationValues;

const blankEditForm = (): EditForm => ({
  fullNameEn: "",
  fullNameGu: "",
  relation: "",
  mobile: "",
  mobileIso: DEFAULT_ISO,
  dateOfBirth: "",
  currentlyAt: "",
  blood: "",
  ...blankCascadingOccupation(),
});

export function ProfileClient({
  occupationTree,
  relations,
}: {
  occupationTree: OccupationTreeNode[];
  relations: { nameEn: string; nameGu: string }[];
}) {
  const { lang } = useLang();
  const router = useRouter();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);
  const { fromEn, guInput } = useTranslitSync();

  const [data, setData] = useState<ProfileResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPhone, setSavingPhone] = useState(false);

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(blankEditForm);
  const [saving, setSaving] = useState(false);

  const relationChoices = (
    relations.length
      ? relations
      : [
          { nameEn: "Wife", nameGu: "પત્ની" },
          { nameEn: "Son", nameGu: "પુત્ર" },
          { nameEn: "Daughter", nameGu: "પુત્રી" },
          { nameEn: "Father", nameGu: "પિતા" },
          { nameEn: "Mother", nameGu: "માતા" },
          { nameEn: "Other", nameGu: "અન્ય" },
        ]
  ).filter((r) => r.nameEn.toLowerCase() !== "head");

  async function loadProfile() {
    const res = await api.get<ProfileResp>("/api/profile");
    setLoading(false);
    if (res.ok) setData(res.data);
    else setError(res.error);
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const profile = data?.profile ?? null;

  async function toggleShowPhone() {
    if (!profile) return;
    setSavingPhone(true);
    const next = !profile.showPhone;
    const res = await api.patch("/api/profile", { showPhone: next });
    setSavingPhone(false);
    if (!res.ok) return toast.error(res.error);
    setData((prev) =>
      prev?.profile ? { ...prev, profile: { ...prev.profile, showPhone: next } } : prev,
    );
  }

  function openEdit(target: EditTarget) {
    if (!profile) return;
    if (target.kind === "self") {
      setEditForm({
        fullNameEn: profile.fullNameEn,
        fullNameGu: profile.fullNameGu ?? "",
        relation: profile.relation ?? "",
        mobile: data?.mobile ?? "",
        mobileIso: data?.mobileIso ?? DEFAULT_ISO,
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
        currentlyAt: profile.currentlyAt ?? "",
        blood: bloodLabel(profile.bloodGroup) || "",
        ...cascadingFromStored(occupationTree, profile),
      });
    } else if (target.kind === "member") {
      const m = target.member;
      setEditForm({
        fullNameEn: m.fullNameEn,
        fullNameGu: m.fullNameGu ?? "",
        relation: m.relation ?? "",
        mobile: m.mobile ?? "",
        mobileIso: m.mobileIso ?? DEFAULT_ISO,
        dateOfBirth: m.dateOfBirth ? m.dateOfBirth.slice(0, 10) : "",
        currentlyAt: m.currentlyAt ?? "",
        blood: bloodLabel(m.bloodGroup) || "",
        ...cascadingFromStored(occupationTree, m),
      });
    } else {
      setEditForm(blankEditForm());
    }
    setEditTarget(target);
  }

  async function saveEdit() {
    if (!profile || !editTarget) return;
    if (editForm.fullNameEn.trim().length < 2) {
      toast.error(T("પૂરું નામ જરૂરી છે", "Full name is required"));
      return;
    }
    if (editTarget.kind !== "self" && !editForm.relation) {
      toast.error(T("સબંધ પસંદ કરો", "Pick a relation"));
      return;
    }
    setSaving(true);
    const occ = await resolveCascadingOccupationForSave(occupationTree, editForm);

    const base = {
      fullNameEn: editForm.fullNameEn.trim(),
      fullNameGu: editForm.fullNameGu.trim() || undefined,
      mobile: editForm.mobile || undefined,
      mobileIso: editForm.mobile ? editForm.mobileIso : undefined,
      dateOfBirth: editForm.dateOfBirth || undefined,
      bloodGroup: bloodToEnum(editForm.blood),
      occupation: occ.occupation || undefined,
      occupationOther: occ.occupationOther || undefined,
      education: occ.education || undefined,
      course: occ.course || undefined,
      specialization: occ.specialization || undefined,
    };

    let res;
    let successMsg = T("ફેરફાર મંજૂરી માટે મોકલ્યા", "Changes sent for approval");
    if (editTarget.kind === "new") {
      res = await api.post("/api/profile/update-request", {
        addMember: true,
        relation: editForm.relation || undefined,
        ...base,
      });
      successMsg = T("નવો સભ્ય મંજૂરી માટે મોકલ્યો", "New member sent for approval");
    } else if (editTarget.kind === "member") {
      res = await api.post("/api/profile/update-request", {
        memberId: editTarget.member.id,
        relation: editForm.relation || undefined,
        ...base,
      });
    } else if (profile.source === "familyMember") {
      // Own record — goes through the same admin approval queue.
      res = await api.post("/api/profile/update-request", {
        ...base,
        currentlyAt: editForm.currentlyAt.trim() || undefined,
      });
    } else {
      // Admin-created Profile accounts save straight through (no queue for that table).
      res = await api.patch("/api/profile", {
        ...base,
        mobile: undefined,
        currentlyAt: editForm.currentlyAt.trim() || undefined,
      });
      successMsg = T("સાચવ્યું", "Saved");
    }

    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setEditTarget(null);
    toast.success(successMsg);
    loadProfile();
  }

  const title = T("મારી પ્રોફાઈલ", "My Profile");

  if (loading) {
    return (
      <AppScreen showNav={false}>
        <BackHeader title={title} onBack={() => router.back()} />
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
        </div>
      </AppScreen>
    );
  }

  if (error || !profile) {
    return (
      <AppScreen showNav={false}>
        <BackHeader title={title} onBack={() => router.back()} />
        <div className="px-6 py-16 text-center text-[13.5px] text-[var(--faint)]">
          {error
            ? error
            : T("પ્રોફાઈલ ઉપલબ્ધ નથી. કૃપા કરી લોગિન કરો.", "No profile found. Please log in.")}
          <div className="mt-4">
            <Link href="/login" className="text-sm font-bold text-[var(--brand)]">
              {T("લોગિન →", "Log in →")}
            </Link>
          </div>
        </div>
      </AppScreen>
    );
  }

  const ownName = pickText(profile.fullNameGu, profile.fullNameEn, lang);
  const surnameLabel = pickText(
    profile.family?.surnameGroup?.nameGu,
    profile.family?.surnameGroup?.nameEn,
    lang,
  );
  const name = [ownName, surnameLabel].filter(Boolean).join(" ");
  const relationSub = [relationLabel(profile.relation, lang), surnameLabel]
    .filter(Boolean)
    .join(" · ");
  const rows = [
    { label: T("મોબાઈલ", "Mobile"), value: data?.mobile || "—", bg: "var(--brand-tint)", fg: "var(--brand)", Icon: Phone },
    { label: T("જન્મ", "DOB"), value: formatDate(profile.dateOfBirth, lang) || "—", bg: "var(--ochre-tint)", fg: "var(--ochre)", Icon: Calendar },
    { label: T("બ્લડ", "Blood"), value: bloodLabel(profile.bloodGroup) || "—", bg: "var(--danger-tint)", fg: "var(--danger)", Icon: Droplet },
    { label: T("વ્યવસાય", "Work"), value: profile.occupation || "—", bg: "var(--info-tint)", fg: "var(--info)", Icon: User },
  ];

  const isSelfMember = (m: FamilyMemberRow) =>
    m.id === profile.id || m.fullNameEn === profile.fullNameEn;

  /* ─────────────────────── Edit screen (full page) ─────────────────────── */

  if (editTarget) {
    const editingName =
      editTarget.kind === "member"
        ? pickText(editTarget.member.fullNameGu, editTarget.member.fullNameEn, lang)
        : "";
    const heading =
      editTarget.kind === "self"
        ? T("મારી માહિતી બદલો", "Edit my details")
        : editTarget.kind === "new"
          ? T("નવો સભ્ય ઉમેરો", "Add new member")
          : editingName;
    const queued = editTarget.kind !== "self" || profile.source === "familyMember";

    return (
      <AppScreen showNav={false}>
        <BackHeader
          title={heading}
          subtitle={
            queued
              ? T("ફેરફાર એડમિન મંજૂરી પછી લાગુ થાય", "Changes apply after admin approval")
              : undefined
          }
          onBack={() => setEditTarget(null)}
        />
        <div className="mx-auto w-full max-w-[680px] flex-1 px-4 py-[18px] pb-8">
          {queued && (
            <div className="mb-4 rounded-[13px] border border-[#D3E0EF] bg-[#F1F5FA] p-3 text-[12px] leading-relaxed text-[#3E5B7C]">
              {T(
                "આ ફેરફાર સાચવ્યા પછી એડમિન પાસે મંજૂરી માટે જશે. મંજૂરી પછી જ પ્રોફાઈલમાં દેખાશે.",
                "After you save, this goes to the admin for approval. It appears in the profile only once approved.",
              )}
            </div>
          )}

          <EditField label={`${T("પૂરું નામ", "Full name")} (English) *`}>
            <SpeechInput
              inputClassName="samaj-fld"
              value={editForm.fullNameEn}
              onChange={(v) => {
                setEditForm((prev) => ({ ...prev, fullNameEn: v }));
                fromEn(v, (gu) => setEditForm((prev) => ({ ...prev, fullNameGu: gu })), "profileEdit");
              }}
              placeholder={T("નામ લખો…", "Enter name…")}
            />
          </EditField>
          <EditField label={`${T("પૂરું નામ", "Full name")} (${T("ગુજરાતી", "Gujarati")})`}>
            <GujaratiInput
              inputClassName="samaj-fld"
              value={editForm.fullNameGu}
              onChange={(v) => {
                setEditForm((prev) => ({ ...prev, fullNameGu: v }));
                guInput(v, (gu) => setEditForm((prev) => ({ ...prev, fullNameGu: gu })), "profileEdit:gu");
              }}
              placeholder={T("ગુજરાતીમાં…", "In Gujarati…")}
            />
          </EditField>

          {editTarget.kind !== "self" && (
            <EditField label={`${T("સબંધ", "Relation")} *`}>
              <div className="flex flex-wrap gap-2">
                {relationChoices.map((r) => (
                  <button
                    key={r.nameEn}
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, relation: r.nameEn }))}
                    className={cn(
                      "rounded-full px-4 py-2.5 text-[13px] font-bold",
                      editForm.relation === r.nameEn
                        ? "bg-[var(--brand)] text-white"
                        : "border border-[var(--line-field)] bg-white text-[var(--ink-dim)]",
                    )}
                  >
                    {lang === "gu" ? r.nameGu || r.nameEn : r.nameEn}
                  </button>
                ))}
              </div>
            </EditField>
          )}

          <div className="mb-3.5 grid grid-cols-2 gap-2.5">
            <EditField label={T("જન્મ તારીખ", "Date of birth")}>
              <DateField
                dob
                value={editForm.dateOfBirth}
                onChange={(v) => setEditForm((prev) => ({ ...prev, dateOfBirth: v }))}
                t={T}
              />
            </EditField>
            <EditField label={T("બ્લડ ગ્રુપ", "Blood group")}>
              <PickerWithAdd
                value={editForm.blood}
                onChange={(v) => setEditForm((prev) => ({ ...prev, blood: v }))}
                options={[
                  { value: "", label: "—" },
                  ...BLOOD.map((b) => ({ value: b, label: b })),
                ]}
                placeholder={T("બ્લડ ગ્રુપ પસંદ કરો", "Select blood group")}
                t={T}
              />
            </EditField>
          </div>

          <div className="mb-3.5">
            <CascadingOccupationFields
              tree={occupationTree}
              t={T}
              values={editForm}
              onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
            />
          </div>

          <EditField label={T("મોબાઈલ", "Mobile")}>
            <PhoneField
              value={{ iso: editForm.mobileIso, digits: editForm.mobile }}
              onChange={(v) =>
                setEditForm((prev) => ({ ...prev, mobile: v.digits, mobileIso: v.iso }))
              }
            />
          </EditField>

          {editTarget.kind === "self" && (
            <EditField label={T("હાલ ક્યાં", "Currently at")}>
              <SpeechInput
                inputClassName="samaj-fld"
                value={editForm.currentlyAt}
                onChange={(v) => setEditForm((prev) => ({ ...prev, currentlyAt: v }))}
              />
            </EditField>
          )}

          <button
            type="button"
            onClick={saveEdit}
            disabled={saving}
            className="mt-1 flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold text-white shadow-[0_12px_24px_-10px_rgb(var(--brand-rgb)/.6)] disabled:opacity-70"
            style={{ background: "linear-gradient(135deg,var(--brand),var(--brand-dark))" }}
          >
            {saving ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <Check className="size-[18px]" strokeWidth={2.4} />
                {queued
                  ? T("સાચવો અને મંજૂરી માટે મોકલો", "Save & send for approval")
                  : T("સાચવો", "Save")}
              </>
            )}
          </button>
        </div>
      </AppScreen>
    );
  }

  /* ───────────────────────────── Main screen ───────────────────────────── */

  return (
    <AppScreen>
      <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-[22px] pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 mb-4 flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/14">
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </button>
          <div className="flex-1 font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold">{title}</div>
          <HeaderLangToggle />
        </div>
        <div className="relative z-2 flex items-center gap-3.5">
          <div className="flex h-16 w-16 flex-none items-center justify-center rounded-[20px] bg-white text-[26px] font-extrabold text-[var(--brand)]">
            {name.trim()[0] || "?"}
          </div>
          <div>
            <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-[17px] font-bold">{name}</div>
            <div className="mt-0.5 text-[12.5px] text-white/72">{relationSub}</div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-8">
        {data?.pendingUpdateRequest && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#F0DCA8] bg-[#FEF6E7] p-3.5">
            <span className="mt-0.5 flex size-8 flex-none items-center justify-center rounded-full bg-[#FBE9C0] text-[#8A6D1E]">
              <Clock className="size-4" />
            </span>
            <div>
              <div className="text-[13.5px] font-extrabold text-[#8A6D1E]">
                {T("ફેરફાર મંજૂરી માટે મોકલ્યા", "Changes sent for approval")}
              </div>
              <div className="mt-0.5 text-[12px] leading-relaxed text-[#A6853A]">
                {T(
                  "એડમિન ચકાસીને મંજૂરી આપશે એટલે તમારી પ્રોફાઈલ અપડેટ થશે. ત્યાં સુધી જૂની માહિતી દેખાશે.",
                  "Once the admin verifies & approves, your profile will update. Until then the old details are shown.",
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <span className="text-[13px] font-extrabold tracking-wide text-[var(--ink-mid)]">{T("મારી વિગતો", "MY DETAILS")}</span>
          <button type="button" onClick={() => openEdit({ kind: "self" })} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-tint)] px-3 py-1.5 text-[12.5px] font-extrabold text-[var(--brand)]">
            <PencilIcon />
            {T("બદલો", "Edit")}
          </button>
        </div>
        <div className="samaj-card px-[15px] py-1.5">
          {rows.map((r) => {
            const Icon = r.Icon;
            return (
              <div key={r.label} className="flex items-center gap-3 border-t border-[#F6F1E8] py-3 first:border-0">
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ background: r.bg, color: r.fg }}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <div className="text-[11.5px] font-semibold text-[var(--faint)]">{r.label}</div>
                  <div className="mt-0.5 text-[14.5px] font-bold text-[var(--ink)]">{r.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-2.5 mt-5 px-0.5 text-[13px] font-extrabold tracking-wide text-[var(--ink-mid)]">
          {T("ગોપનીયતા (તરત લાગુ)", "PRIVACY (APPLIES INSTANTLY)")}
        </div>
        <button type="button" onClick={toggleShowPhone} disabled={savingPhone} className="samaj-card mb-5 flex w-full items-center gap-3 p-3.5 text-left disabled:opacity-70">
          <div className="flex-1">
            <div className="text-sm font-bold">{T("ફોન નંબર બતાવવો?", "Show my phone number?")}</div>
            <div className="mt-0.5 text-[11.5px] text-[var(--faint)]">
              {T("બીજા સભ્યો ડિરેક્ટરીમાં જોઈ શકે", "Other members can see it in directory")}
            </div>
          </div>
          <span className={cn("relative h-[27px] w-[46px] rounded-2xl transition-colors", profile.showPhone ? "bg-[var(--wa)]" : "bg-[var(--scroll-thumb)]")}>
            <span className={cn("absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow transition-all", profile.showPhone ? "left-[22px]" : "left-[3px]")} />
          </span>
        </button>

        {profile.family && profile.family.familyMembers.length > 0 && (
          <>
            <div className="mb-2.5 px-0.5 text-[13px] font-extrabold tracking-wide text-[var(--ink-mid)]">{T("મારો પરિવાર", "MY FAMILY")}</div>
            {profile.family.familyMembers.map((m, i) => {
              const self = isSelfMember(m);
              const tint = MEMBER_TINTS[i % MEMBER_TINTS.length];
              const age = ageOf(m.dateOfBirth);
              const sub = [
                relationLabel(m.relation, lang),
                age != null ? `${age} ${T("વર્ષ", "yrs")}` : "",
                bloodLabel(m.bloodGroup),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div key={m.id} className="samaj-card mb-2.5 flex items-center gap-3 p-[13px]">
                  <div
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] text-base font-extrabold"
                    style={{ background: tint.bg, color: tint.fg }}
                  >
                    {pickText(m.fullNameGu, m.fullNameEn, lang).trim()[0] || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold">{pickText(m.fullNameGu, m.fullNameEn, lang)}</span>
                      {self && (
                        <span className="flex-none rounded-lg bg-[var(--brand-tint)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--brand)]">
                          {T("તમે", "You")}
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-[var(--faint)]">{sub}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => (self ? openEdit({ kind: "self" }) : openEdit({ kind: "member", member: m }))}
                    className="inline-flex flex-none items-center gap-1 rounded-full bg-[var(--brand-tint)] px-2.5 py-1.5 text-[11.5px] font-extrabold text-[var(--brand)]"
                  >
                    <PencilIcon />
                    {T("બદલો", "Edit")}
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => openEdit({ kind: "new" })}
              className="mb-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-[var(--brand-line)] bg-white text-sm font-bold text-[var(--brand)]"
            >
              <Plus className="size-4" strokeWidth={2.4} />
              {T("નવો સભ્ય ઉમેરો", "Add a member")}
            </button>

            <Link href={`/directory/family/${profile.family.id}`} className="mb-4 block text-center text-sm font-bold text-[var(--brand)]">
              {T("પરિવાર પ્રોફાઈલ જુઓ →", "View family profile →")}
            </Link>
          </>
        )}

        <div className="flex items-start gap-2.5 rounded-[13px] border border-[#D3E0EF] bg-[#F1F5FA] p-3 text-[12px] leading-relaxed text-[#3E5B7C]">
          <Info className="mt-0.5 size-4 flex-none" />
          <span>
            {T(
              "તમે કરેલા ફેરફાર એડમિન ચકાસીને મંજૂરી આપે પછી જ પ્રોફાઈલમાં અને બીજા સભ્યો માટે અપડેટ થાય. ગોપનીયતા સેટિંગ તરત લાગુ થાય.",
              "Any change you make updates in your profile and for others only after the admin verifies & approves it. Privacy settings apply instantly.",
            )}
          </span>
        </div>
      </div>
    </AppScreen>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M13.5 6.5l3 3" />
    </svg>
  );
}

function EditField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1 text-xs font-bold text-[var(--muted)]">{label}</div>
      {children}
    </div>
  );
}
