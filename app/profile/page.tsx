"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, Droplet, Loader2, Phone, User } from "lucide-react";
import { toast } from "sonner";
import { AppScreen } from "@/components/layout/app-screen";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { bloodLabel, formatDate, pickText } from "@/lib/format";
import { cn } from "@/lib/utils";

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
        familyId: string | null;
        fullNameEn: string;
        fullNameGu: string | null;
        relation: string | null;
        dateOfBirth: string | null;
        bloodGroup: string | null;
        occupation: string | null;
        currentlyAt: string | null;
        education: string | null;
        showPhone: boolean;
        family: { id: string; familyMembers: Member[] } | null;
      }
    | null;
  mobile: string | null;
};

export default function ProfilePage() {
  const { lang } = useLang();
  const router = useRouter();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const [data, setData] = useState<ProfileResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPhone, setSavingPhone] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ occupation: "", currentlyAt: "", education: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.get<ProfileResp>("/api/profile").then((res) => {
      if (!active) return;
      setLoading(false);
      if (res.ok) setData(res.data);
      else setError(res.error);
    });
    return () => {
      active = false;
    };
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
      occupation: profile.occupation ?? "",
      currentlyAt: profile.currentlyAt ?? "",
      education: profile.education ?? "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    setSaving(true);
    const res = await api.patch("/api/profile", {
      occupation: editForm.occupation.trim(),
      currentlyAt: editForm.currentlyAt.trim(),
      education: editForm.education.trim(),
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setData((prev) =>
      prev?.profile ? { ...prev, profile: { ...prev.profile, ...editForm } } : prev,
    );
    setEditOpen(false);
    toast.success(T("સાચવ્યું", "Saved"));
  }

  const title = T("મારી પ્રોફાઈલ", "My Profile");

  if (loading) {
    return (
      <AppScreen showNav={false}>
        <ProfileHeader title={title} onBack={() => router.back()} />
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-[#A62A38]" />
        </div>
      </AppScreen>
    );
  }

  if (error || !profile) {
    return (
      <AppScreen showNav={false}>
        <ProfileHeader title={title} onBack={() => router.back()} />
        <div className="px-6 py-16 text-center text-[13.5px] text-[#938C80]">
          {error
            ? error
            : T("પ્રોફાઈલ ઉપલબ્ધ નથી. કૃપા કરી લોગિન કરો.", "No profile found. Please log in.")}
          <div className="mt-4">
            <Link href="/login" className="text-sm font-bold text-[#A62A38]">
              {T("લોગિન →", "Log in →")}
            </Link>
          </div>
        </div>
      </AppScreen>
    );
  }

  const name = pickText(profile.fullNameGu, profile.fullNameEn, lang);
  const rows = [
    { label: T("મોબાઈલ", "Mobile"), value: data?.mobile || "—", bg: "#FBEDEE", fg: "#A62A38", Icon: Phone },
    { label: T("જન્મ", "DOB"), value: formatDate(profile.dateOfBirth, lang) || "—", bg: "#FEF3E0", fg: "#B26A1E", Icon: Calendar },
    { label: T("બ્લડ", "Blood"), value: bloodLabel(profile.bloodGroup) || "—", bg: "#FCE7E7", fg: "#B0303A", Icon: Droplet },
    { label: T("વ્યવસાય", "Work"), value: profile.occupation || "—", bg: "#E7F0FB", fg: "#3D6B8C", Icon: User },
  ];

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
          <div className="flex h-16 w-16 flex-none items-center justify-center rounded-[20px] bg-white text-[26px] font-extrabold text-[#A62A38]">
            {name.trim()[0] || "?"}
          </div>
          <div>
            <div className="font-[family-name:var(--font-noto-serif-gujarati)] text-[17px] font-bold">{name}</div>
            <div className="mt-0.5 text-[12.5px] text-white/72">{profile.relation || ""}</div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-8">
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <span className="text-[13px] font-extrabold tracking-wide text-[#57524A]">{T("મારી વિગતો", "MY DETAILS")}</span>
          <button type="button" onClick={openEdit} className="inline-flex items-center gap-1.5 rounded-full bg-[#FBEDEE] px-3 py-1.5 text-[12.5px] font-extrabold text-[#A62A38]">
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
                  <div className="text-[11.5px] font-semibold text-[#938C80]">{r.label}</div>
                  <div className="mt-0.5 text-[14.5px] font-bold text-[#2A2320]">{r.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-2.5 mt-5 px-0.5 text-[13px] font-extrabold tracking-wide text-[#57524A]">{T("પ્રાઈવસી", "PRIVACY")}</div>
        <button type="button" onClick={toggleShowPhone} disabled={savingPhone} className="samaj-card mb-5 flex w-full items-center gap-3 p-3.5 text-left disabled:opacity-70">
          <div className="flex-1">
            <div className="text-sm font-bold">{T("ફોન બતાવો", "Show phone")}</div>
            <div className="mt-0.5 text-[11.5px] text-[#938C80]">{T("ડિરેક્ટરીમાં ફોન બતાવો", "Show phone in directory")}</div>
          </div>
          <span className={cn("relative h-[27px] w-[46px] rounded-2xl transition-colors", profile.showPhone ? "bg-[#A62A38]" : "bg-[#D8D0C2]")}>
            <span className={cn("absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow transition-all", profile.showPhone ? "left-[22px]" : "left-[3px]")} />
          </span>
        </button>

        {profile.family && profile.family.familyMembers.length > 0 && (
          <>
            <div className="mb-2.5 px-0.5 text-[13px] font-extrabold tracking-wide text-[#57524A]">{T("પરિવાર", "FAMILY")}</div>
            {profile.family.familyMembers.map((m) => (
              <div key={m.id} className="samaj-card mb-2.5 flex items-center gap-3 p-[13px]">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#FBEDEE] text-base font-extrabold text-[#A62A38]">
                  {pickText(m.fullNameGu, m.fullNameEn, lang).trim()[0] || "?"}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">{pickText(m.fullNameGu, m.fullNameEn, lang)}</div>
                  <div className="text-[11.5px] text-[#938C80]">{m.relation || ""}</div>
                </div>
                {m.fullNameEn === profile.fullNameEn && (
                  <span className="rounded-lg bg-[#FBEDEE] px-2 py-0.5 text-[10px] font-extrabold text-[#A62A38]">{T("તમે", "You")}</span>
                )}
              </div>
            ))}
            <Link href={`/directory/family/${profile.family.id}`} className="mt-2 block text-center text-sm font-bold text-[#A62A38]">
              {T("પરિવાર પ્રોફાઈલ જુઓ →", "View family profile →")}
            </Link>
          </>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[380px] rounded-2xl sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#2A2620]">{T("વિગત ફેરફાર", "Edit details")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <EditField label={T("વ્યવસાય", "Occupation")} value={editForm.occupation} onChange={(v) => setEditForm({ ...editForm, occupation: v })} />
            <EditField label={T("હાલમાં", "Currently at")} value={editForm.currentlyAt} onChange={(v) => setEditForm({ ...editForm, currentlyAt: v })} />
            <EditField label={T("શિક્ષણ", "Education")} value={editForm.education} onChange={(v) => setEditForm({ ...editForm, education: v })} />
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving}
              className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-extrabold text-white disabled:opacity-70"
              style={{ background: "linear-gradient(135deg,#A62A38,#851F2B)" }}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : T("સાચવો", "Save")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppScreen>
  );
}

function ProfileHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="samaj-header relative flex-none overflow-hidden px-[18px] pb-[22px] pt-12 text-white">
      <div className="absolute -right-[30px] -top-10 h-[150px] w-[150px] rounded-full bg-white/5" />
      <div className="relative z-2 flex items-center gap-3">
        <button type="button" onClick={onBack} className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/14">
          <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
        </button>
        <div className="flex-1 font-[family-name:var(--font-noto-serif-gujarati)] text-xl font-bold">{title}</div>
      </div>
    </header>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold text-[#8B8375]">{label}</div>
      <input className="samaj-fld" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
