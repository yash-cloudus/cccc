"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Check, ChevronLeft, Clock, Droplet, Loader2, Phone, User } from "lucide-react";
import { toast } from "sonner";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { bloodLabel, bloodToEnum, formatDate, pickText, relationLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { GujaratiInput } from "@/components/ui/gujarati-keyboard";
import { CascadingOccupationFields } from "@/components/forms/cascading-occupation-fields";
import {
  type CascadingOccupationValues,
  blankCascadingOccupation,
  cascadingFromStored,
  resolveCascadingOccupationForSave,
} from "@/lib/cascading-occupation";
import type { OccupationTreeNode } from "@/lib/occupation-defaults";

type Member = {
  id: string;
  fullNameEn: string;
  fullNameGu: string | null;
  relation: string | null;
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
        currentlyAt: string | null;
        showPhone: boolean;
        family: {
          id: string;
          familyMembers: Member[];
          surnameGroup: { nameEn: string; nameGu: string | null } | null;
        } | null;
      }
    | null;
  mobile: string | null;
  pendingUpdateRequest: { id: string; submittedAt: string } | null;
};

const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

type EditForm = {
  fullNameEn: string;
  fullNameGu: string;
  mobile: string;
  currentlyAt: string;
  blood: string;
} & CascadingOccupationValues;

const blankEditForm = (): EditForm => ({
  fullNameEn: "",
  fullNameGu: "",
  mobile: "",
  currentlyAt: "",
  blood: "B+",
  ...blankCascadingOccupation(),
});

export function ProfileClient({ occupationTree }: { occupationTree: OccupationTreeNode[] }) {
  const { lang } = useLang();
  const router = useRouter();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);
  const { fromEn, guInput } = useTranslitSync();

  const [data, setData] = useState<ProfileResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPhone, setSavingPhone] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(blankEditForm);
  const [saving, setSaving] = useState(false);

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

  function openEdit() {
    if (!profile) return;
    setEditForm({
      fullNameEn: profile.fullNameEn,
      fullNameGu: profile.fullNameGu ?? "",
      mobile: data?.mobile ?? "",
      currentlyAt: profile.currentlyAt ?? "",
      blood: bloodLabel(profile.bloodGroup) || "B+",
      ...cascadingFromStored(occupationTree, {
        occupation: profile.occupation,
        occupationOther: profile.occupationOther,
        education: profile.education,
        course: profile.course,
      }),
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!profile) return;
    if (editForm.fullNameEn.trim().length < 2) {
      toast.error(T("પૂરું નામ જરૂરી છે", "Full name is required"));
      return;
    }
    setSaving(true);
    const occ = await resolveCascadingOccupationForSave(occupationTree, editForm);

    // FamilyMember-sourced profiles (the OTP/registration path) go through
    // admin approval; Profile-table accounts (admin-created logins) save
    // straight through — there is no approval queue wired up for that table.
    if (profile.source === "familyMember") {
      const res = await api.post("/api/profile/update-request", {
        fullNameEn: editForm.fullNameEn.trim(),
        fullNameGu: editForm.fullNameGu.trim() || undefined,
        mobile: editForm.mobile.replace(/\D/g, "") || undefined,
        currentlyAt: editForm.currentlyAt.trim() || undefined,
        bloodGroup: bloodToEnum(editForm.blood),
        occupation: occ.occupation || undefined,
        occupationOther: occ.occupationOther || undefined,
        education: occ.education || undefined,
        course: occ.course || undefined,
      });
      setSaving(false);
      if (!res.ok) return toast.error(res.error);
      setEditOpen(false);
      toast.success(T("ફેરફાર મંજૂરી માટે મોકલ્યા", "Changes sent for approval"));
      loadProfile();
      return;
    }

    const res = await api.patch("/api/profile", {
      fullNameEn: editForm.fullNameEn.trim(),
      fullNameGu: editForm.fullNameGu.trim() || undefined,
      currentlyAt: editForm.currentlyAt.trim() || undefined,
      bloodGroup: bloodToEnum(editForm.blood),
      occupation: occ.occupation || undefined,
      occupationOther: occ.occupationOther || undefined,
      education: occ.education || undefined,
      course: occ.course || undefined,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setEditOpen(false);
    toast.success(T("સાચવ્યું", "Saved"));
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

  if (editOpen) {
    return (
      <AppScreen showNav={false}>
        <BackHeader
          title={T("મારી માહિતી બદલો", "Edit my details")}
          subtitle={T("ફેરફાર એડમિન મંજૂરી પછી લાગુ થાય", "Changes apply after admin approval")}
          onBack={() => setEditOpen(false)}
        />
        <div className="flex-1 px-4 py-[18px] pb-8">
          <div className="mb-4 rounded-[13px] border border-[var(--info-tint)] bg-[var(--info-tint)] p-3 text-[12px] leading-relaxed text-[var(--info)]">
            {T(
              "આ ફેરફાર સાચવ્યા પછી એડમિન પાસે મંજૂરી માટે જશે. મંજૂરી પછી જ પ્રોફાઈલમાં દેખાશે.",
              "After you save, this goes to the admin for approval. It appears in your profile only once approved.",
            )}
          </div>

          <EditField label={`${T("પૂરું નામ", "Full name")} (English) *`}>
            <input
              className="samaj-fld"
              value={editForm.fullNameEn}
              onChange={(e) => {
                const v = e.target.value;
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

          <div className="mb-3.5 grid grid-cols-2 gap-2.5">
            <EditField label={T("બ્લડ ગ્રુપ", "Blood group")}>
              <select
                className="samaj-fld"
                value={editForm.blood}
                onChange={(e) => setEditForm((prev) => ({ ...prev, blood: e.target.value }))}
              >
                {BLOOD.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </EditField>
            <EditField label={T("મોબાઈલ", "Mobile")}>
              <input
                className="samaj-fld"
                value={editForm.mobile}
                inputMode="numeric"
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                }
                placeholder="98765 43210"
              />
            </EditField>
          </div>

          <div className="mb-3.5">
            <CascadingOccupationFields
              tree={occupationTree}
              values={editForm}
              onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
            />
          </div>

          <EditField label={T("હાલ ક્યાં", "Currently at")}>
            <input
              className="samaj-fld"
              value={editForm.currentlyAt}
              onChange={(e) => setEditForm((prev) => ({ ...prev, currentlyAt: e.target.value }))}
            />
          </EditField>

          <button
            type="button"
            onClick={saveEdit}
            disabled={saving}
            className="mt-1 flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold text-white disabled:opacity-70"
            style={{ background: "linear-gradient(135deg,var(--brand),var(--brand-dark))" }}
          >
            {saving ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <Check className="size-[18px]" strokeWidth={2.4} />
                {profile.source === "familyMember"
                  ? T("સાચવો અને મંજૂરી માટે મોકલો", "Save & send for approval")
                  : T("સાચવો", "Save")}
              </>
            )}
          </button>
        </div>
      </AppScreen>
    );
  }

  return (
    <AppScreen showNav={false}>
      <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-[22px] pt-12 text-white">
        <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
        <div className="relative z-2 mb-4 flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/14">
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </button>
          <div className="flex-1 font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold">{title}</div>
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
          <button type="button" onClick={openEdit} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-tint)] px-3 py-1.5 text-[12.5px] font-extrabold text-[var(--brand)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M13.5 6.5l3 3" /></svg>
            {T("ફેરફાર", "Edit")}
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

        <div className="mb-2.5 mt-5 px-0.5 text-[13px] font-extrabold tracking-wide text-[var(--ink-mid)]">{T("પ્રાઈવસી", "PRIVACY")}</div>
        <button type="button" onClick={toggleShowPhone} disabled={savingPhone} className="samaj-card mb-5 flex w-full items-center gap-3 p-3.5 text-left disabled:opacity-70">
          <div className="flex-1">
            <div className="text-sm font-bold">{T("ફોન બતાવો", "Show phone")}</div>
            <div className="mt-0.5 text-[11.5px] text-[var(--faint)]">{T("ડિરેક્ટરીમાં ફોન બતાવો", "Show phone in directory")}</div>
          </div>
          <span className={cn("relative h-[27px] w-[46px] rounded-2xl transition-colors", profile.showPhone ? "bg-[var(--brand)]" : "bg-[var(--scroll-thumb)]")}>
            <span className={cn("absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow transition-all", profile.showPhone ? "left-[22px]" : "left-[3px]")} />
          </span>
        </button>

        {profile.family && profile.family.familyMembers.length > 0 && (
          <>
            <div className="mb-2.5 px-0.5 text-[13px] font-extrabold tracking-wide text-[var(--ink-mid)]">{T("પરિવાર", "FAMILY")}</div>
            {profile.family.familyMembers.map((m) => (
              <div key={m.id} className="samaj-card mb-2.5 flex items-center gap-3 p-[13px]">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--brand-tint)] text-base font-extrabold text-[var(--brand)]">
                  {pickText(m.fullNameGu, m.fullNameEn, lang).trim()[0] || "?"}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">{pickText(m.fullNameGu, m.fullNameEn, lang)}</div>
                  <div className="text-[11.5px] text-[var(--faint)]">{relationLabel(m.relation, lang)}</div>
                </div>
                {m.fullNameEn === profile.fullNameEn && (
                  <span className="rounded-lg bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--brand)]">{T("તમે", "You")}</span>
                )}
              </div>
            ))}
            <Link href={`/directory/family/${profile.family.id}`} className="mt-2 block text-center text-sm font-bold text-[var(--brand)]">
              {T("પરિવાર પ્રોફાઈલ જુઓ →", "View family profile →")}
            </Link>
          </>
        )}
      </div>
    </AppScreen>
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
