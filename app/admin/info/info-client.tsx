"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, Mail, Pencil, Phone, PhoneOff, Plus, Trash2 } from "lucide-react";
import {
  ActionBtn,
  AdminBtn,
  AdminH2,
  AdminH3,
  AdminInfoTip,
  AdminInput,
  AdminLabel,
  AdminSelect,
  AdminTable,
  AdminTd,
  AdminTh,
  FilterButton,
  PillActive,
  PillWarning,
  SearchInput,
} from "@/components/admin/admin-ui";
import { WaIcon } from "@/components/directory/contact-card";
import {
  AdminField,
  AdminFilePicker,
  AdminFormRow,
  AdminModal,
  AdminModalActions,
  AdminSearchSelect,
  AdminSegmented,
} from "@/components/admin/admin-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GujaratiInput } from "@/components/ui/gujarati-keyboard";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SpeechTextarea } from "@/components/ui/speech-input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api } from "@/lib/http";
import { telLink, waLink } from "@/lib/format";
import { PhoneField } from "@/components/ui/phone-field";
import { DEFAULT_ISO } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import { useAdminT } from "@/lib/i18n/admin-dictionary";

type Committee = { id: string; nameEn: string; nameGu: string | null; isActive: boolean };
type InfoSection = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  bodyEn: string | null;
  bodyGu: string | null;
  sortOrder: number;
  isActive: boolean;
};
type Village = {
  id: string;
  nameEn: string;
  nameGu: string;
  showPhones: boolean;
  families: number;
};
type CMember = {
  id: string;
  profileId: string | null;
  nameOverride: string | null;
  nameGu: string | null;
  roleEn: string | null;
  roleGu: string | null;
  phoneOverride: string | null;
  phoneIso: string | null;
  whatsapp: string | null;
  whatsappIso: string | null;
  email: string | null;
  descGu: string | null;
  showContact: boolean;
  isActive: boolean;
  sortOrder: number;
};

/** A community member offered in the "Link an existing member" search. */
export type ProfileOption = {
  id: string;
  nameEn: string;
  nameGu: string;
  mobile: string;
  family: string;
};

export type BasicInfo = {
  nameEn: string;
  nameGu: string;
  estd: string;
  village: string;
  addressEn: string;
  addressGu: string;
  taluka: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  contactPhone: string;
  contactPhoneIso: string;
  whatsapp: string;
  whatsappIso: string;
  email: string;
  website: string;
  mapUrl: string;
  descGu: string;
  descEn: string;
};

type Tab = "basic" | "committee" | "sections";

type MemberDraft = {
  id: string | null;
  profileId: string | null;
  roleGu: string;
  roleEn: string;
  nameGu: string;
  nameOverride: string;
  phoneOverride: string;
  phoneIso: string;
  whatsapp: string;
  whatsappIso: string;
  sameWhatsapp: boolean;
  email: string;
  descGu: string;
  showContact: boolean;
  isActive: boolean;
  sortOrder: number;
};

export function InfoClient({
  upiId: initialUpi,
  logoUrl: initialLogo,
  bannerUrl: initialBanner,
  basic: initialBasic,
  committee: initialCommittee,
  members: initialMembers,
  infoSections: initialInfo,
  villages: initialVillages,
  memberOptions,
}: {
  upiId: string;
  logoUrl: string;
  bannerUrl: string;
  basic: BasicInfo;
  committee: Committee;
  members: CMember[];
  infoSections: InfoSection[];
  villages: Village[];
  memberOptions: ProfileOption[];
}) {
  const { t, tf, lang } = useAdminT();
  const { fromEn, guInput } = useTranslitSync();

  const TABS: { key: Tab; label: string }[] = [
    { key: "basic", label: t("nav.info") },
    { key: "committee", label: t("info.tabCommittee") },
    { key: "sections", label: t("info.tabSections") },
  ];

  /** The "Basic information" grid, in the order the prototype lists them. */
  const BASIC_FIELDS: { key: keyof BasicInfo; label: string; gujarati?: boolean; speech?: boolean }[] = [
    { key: "nameGu", label: t("info.fldNameGu"), gujarati: true },
    { key: "nameEn", label: t("info.fldNameEn"), speech: true },
    { key: "estd", label: t("info.fldEstd") },
    { key: "village", label: t("info.fldVillage"), gujarati: true },
    { key: "addressEn", label: t("info.fldAddress"), gujarati: true },
    { key: "taluka", label: t("info.fldTaluka"), gujarati: true },
    { key: "district", label: t("info.fldDistrict"), gujarati: true },
    { key: "state", label: t("info.fldState"), gujarati: true },
    { key: "country", label: t("info.fldCountry"), gujarati: true },
    { key: "pincode", label: t("info.fldPincode") },
    { key: "contactPhone", label: t("info.fldPhone") },
    { key: "whatsapp", label: t("info.whatsapp") },
    { key: "email", label: t("info.fldEmail") },
    { key: "website", label: t("info.fldWebsite") },
    { key: "mapUrl", label: t("info.fldMapUrl") },
  ];

  const SECTION_STATUS_OPTIONS = [
    { value: "all", label: t("info.allSections") },
    { value: "active", label: t("info.active") },
    { value: "inactive", label: t("info.hidden") },
  ];

  const MEMBER_STATUS_OPTIONS: { value: "all" | "active" | "inactive"; label: string }[] = [
    { value: "all", label: t("info.allMembers") },
    { value: "active", label: t("info.active") },
    { value: "inactive", label: t("info.inactive") },
  ];

  const [logoUrl, setLogoUrl] = useState(initialLogo);
  const [bannerUrl, setBannerUrl] = useState(initialBanner);
  const [brandBusy, setBrandBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("basic");
  const [basic, setBasic] = useState<BasicInfo>(initialBasic);
  const [basicBusy, setBasicBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const setField = (key: keyof BasicInfo, value: string) =>
    setBasic((b) => ({ ...b, [key]: value }));

  async function saveBranding() {
    setBrandBusy(true);
    setError(null);
    const res = await api.patch("/api/admin/settings", {
      logoUrl: logoUrl.trim(),
      bannerUrl: bannerUrl.trim(),
    });
    setBrandBusy(false);
    if (!res.ok) return setError(res.error);
    flash(t("info.brandSaved"));
  }

  /** Brief confirmation under the header, like the prototype's toast. */
  function flash(message: string) {
    setSaved(message);
    setTimeout(() => setSaved(null), 2600);
  }

  async function saveBasic() {
    if (!basic.nameEn.trim() && !basic.nameGu.trim()) {
      return setError(t("info.errNameRequired"));
    }
    setBasicBusy(true);
    setError(null);
    const res = await api.patch("/api/admin/settings", {
      ...basic,
      // The API requires a non-empty English name; fall back to the Gujarati one.
      nameEn: basic.nameEn.trim() || basic.nameGu.trim(),
    });
    setBasicBusy(false);
    if (!res.ok) return setError(res.error);
    flash(t("info.basicSaved"));
  }

  /** Swap a section with its neighbour and persist both sortOrders. */
  async function moveSection(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= info.length) return;
    const next = [...info];
    [next[index], next[target]] = [next[target], next[index]];
    setInfo(next);
    const results = await Promise.all(
      next.map((s, i) => api.patch("/api/admin/info-sections", { id: s.id, sortOrder: i })),
    );
    if (results.some((r) => !r.ok)) {
      setInfo(info);
      toast.error(t("info.errReorderSections"));
    }
  }

  async function toggleSectionActive(section: InfoSection) {
    const next = !section.isActive;
    setInfo((prev) => prev.map((s) => (s.id === section.id ? { ...s, isActive: next } : s)));
    const res = await api.patch("/api/admin/info-sections", { id: section.id, isActive: next });
    if (!res.ok) {
      setInfo((prev) => prev.map((s) => (s.id === section.id ? { ...s, isActive: !next } : s)));
      toast.error(res.error || t("info.errUpdateSection"));
      return;
    }
    toast.success(next ? t("info.sectionShown") : t("info.sectionHidden"));
  }

  const [upiId, setUpiId] = useState(initialUpi);
  const [upiDraft, setUpiDraft] = useState(initialUpi);
  const committee = initialCommittee;
  const [members, setMembers] = useState<CMember[]>(initialMembers);
  const [info, setInfo] = useState<InfoSection[]>(initialInfo);
  const [villages, setVillages] = useState<Village[]>(initialVillages);
  const [error, setError] = useState<string | null>(null);

  const [memberQ, setMemberQ] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [memberFiltersOpen, setMemberFiltersOpen] = useState(false);
  const [memberDraft, setMemberDraft] = useState<MemberDraft | null>(null);
  const [memberBusy, setMemberBusy] = useState(false);
  const [memberFormError, setMemberFormError] = useState<string | null>(null);

  const [secQ, setSecQ] = useState("");
  const [secStatusFilter, setSecStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [secFiltersOpen, setSecFiltersOpen] = useState(false);

  const filteredMembers = useMemo(() => {
    const term = memberQ.trim().toLowerCase();
    return members
      .map((m, index) => ({ m, index }))
      .filter(({ m }) => {
        if (memberStatusFilter === "active" && !m.isActive) return false;
        if (memberStatusFilter === "inactive" && m.isActive) return false;
        if (!term) return true;
        return (
          (m.nameOverride || "").toLowerCase().includes(term) ||
          (m.nameGu || "").toLowerCase().includes(term) ||
          (m.roleGu || "").toLowerCase().includes(term) ||
          (m.roleEn || "").toLowerCase().includes(term)
        );
      });
  }, [members, memberQ, memberStatusFilter]);

  const selectedProfile = memberDraft?.profileId
    ? memberOptions.find((p) => p.id === memberDraft.profileId) ?? null
    : null;

  const filteredInfo = useMemo(() => {
    const term = secQ.trim().toLowerCase();
    return info
      .map((s, index) => ({ s, index }))
      .filter(({ s }) => {
        if (secStatusFilter === "active" && !s.isActive) return false;
        if (secStatusFilter === "inactive" && s.isActive) return false;
        if (!term) return true;
        return s.titleEn.toLowerCase().includes(term) || (s.titleGu || "").toLowerCase().includes(term);
      });
  }, [info, secQ, secStatusFilter]);

  /* ---- Info dialog ---- */
  const [infoEdit, setInfoEdit] = useState<{
    id: string | null;
    titleEn: string;
    titleGu: string;
    bodyEn: string;
    bodyGu: string;
    isActive: boolean;
  } | null>(null);

  /* ---- Village dialog ---- */
  const [villageAdd, setVillageAdd] = useState<{ nameEn: string; nameGu: string } | null>(null);

  const [busy, setBusy] = useState(false);

  async function saveUpi() {
    setBusy(true);
    setError(null);
    const value = upiDraft.trim();
    const res = await api.patch(`/api/admin/settings`, { settings: { upiId: value } });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setUpiId(value);
  }

  /* ============ Committee members ============ */
  function openNewMember() {
    setMemberFormError(null);
    setMemberDraft({
      id: null,
      profileId: null,
      roleGu: "",
      roleEn: "",
      nameGu: "",
      nameOverride: "",
      phoneOverride: "",
      phoneIso: DEFAULT_ISO,
      whatsapp: "",
      whatsappIso: DEFAULT_ISO,
      sameWhatsapp: true,
      email: "",
      descGu: "",
      showContact: true,
      isActive: true,
      sortOrder: members.length + 1,
    });
  }

  function editMember(m: CMember) {
    setMemberFormError(null);
    setMemberDraft({
      id: m.id,
      profileId: m.profileId,
      roleGu: m.roleGu || "",
      roleEn: m.roleEn || "",
      nameGu: m.nameGu || "",
      nameOverride: m.nameOverride || "",
      phoneOverride: m.phoneOverride || "",
      phoneIso: m.phoneIso || DEFAULT_ISO,
      whatsapp: m.whatsapp || "",
      whatsappIso: m.whatsappIso || DEFAULT_ISO,
      sameWhatsapp: !!m.phoneOverride && m.whatsapp === m.phoneOverride,
      email: m.email || "",
      descGu: m.descGu || "",
      showContact: m.showContact,
      isActive: m.isActive,
      sortOrder: m.sortOrder,
    });
  }

  async function moveMember(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= members.length) return;
    const next = [...members];
    [next[index], next[target]] = [next[target], next[index]];
    setMembers(next);
    const results = await Promise.all(
      next.map((m, i) => api.patch("/api/admin/committee-members", { id: m.id, sortOrder: i })),
    );
    if (results.some((r) => !r.ok)) {
      setMembers(members);
      toast.error(t("info.errReorderMembers"));
    }
  }

  async function saveMember() {
    if (!memberDraft) return;
    if (!memberDraft.profileId && !memberDraft.nameOverride.trim()) {
      return setMemberFormError(t("info.errMemberName"));
    }
    setMemberBusy(true);
    setMemberFormError(null);

    // When "same as mobile" is on, the WhatsApp field is hidden and stale — the
    // mobile number is the actual value to persist.
    const effectiveWhatsapp = memberDraft.sameWhatsapp
      ? memberDraft.phoneOverride.trim()
      : memberDraft.whatsapp.trim();

    if (memberDraft.id) {
      // Sent as-is, not `|| undefined`: a blank field is the admin clearing it.
      const res = await api.patch<CMember>(`/api/admin/committee-members`, {
        id: memberDraft.id,
        profileId: memberDraft.profileId || undefined,
        roleGu: memberDraft.roleGu.trim(),
        roleEn: memberDraft.roleEn.trim(),
        nameGu: memberDraft.nameGu.trim(),
        nameOverride: memberDraft.nameOverride.trim(),
        phoneOverride: memberDraft.phoneOverride.trim(),
        phoneIso: memberDraft.phoneIso,
        whatsapp: effectiveWhatsapp,
        whatsappIso: memberDraft.sameWhatsapp ? memberDraft.phoneIso : memberDraft.whatsappIso,
        email: memberDraft.email.trim(),
        descGu: memberDraft.descGu,
        showContact: memberDraft.showContact,
        isActive: memberDraft.isActive,
        sortOrder: memberDraft.sortOrder,
      });
      setMemberBusy(false);
      if (!res.ok) return setMemberFormError(res.error);
      setMembers((prev) => prev.map((m) => (m.id === memberDraft.id ? res.data : m)));
      toast.success(t("info.memberUpdated"));
    } else {
      const res = await api.post<CMember>(`/api/admin/committee-members`, {
        committeeId: committee.id,
        profileId: memberDraft.profileId || undefined,
        roleGu: memberDraft.roleGu.trim() || undefined,
        roleEn: memberDraft.roleEn.trim() || undefined,
        nameGu: memberDraft.nameGu.trim() || undefined,
        nameOverride: memberDraft.nameOverride.trim() || undefined,
        phoneOverride: memberDraft.phoneOverride.trim() || undefined,
        phoneIso: memberDraft.phoneIso,
        whatsappIso: memberDraft.sameWhatsapp ? memberDraft.phoneIso : memberDraft.whatsappIso,
        whatsapp: effectiveWhatsapp || undefined,
        email: memberDraft.email.trim() || undefined,
        descGu: memberDraft.descGu || undefined,
        showContact: memberDraft.showContact,
        isActive: memberDraft.isActive,
        sortOrder: memberDraft.sortOrder,
      });
      setMemberBusy(false);
      if (!res.ok) return setMemberFormError(res.error);
      setMembers((prev) => [...prev, res.data]);
      toast.success(t("info.memberAdded"));
    }
    setMemberDraft(null);
  }

  async function toggleMemberActive(m: CMember) {
    const next = !m.isActive;
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, isActive: next } : x)));
    const res = await api.patch(`/api/admin/committee-members`, { id: m.id, isActive: next });
    if (!res.ok) {
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, isActive: !next } : x)));
      toast.error(res.error || t("info.errUpdateMember"));
      return;
    }
    toast.success(next ? t("info.memberActivated") : t("info.memberDeactivated"));
  }

  async function toggleShowContact(m: CMember) {
    const next = !m.showContact;
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, showContact: next } : x)));
    const res = await api.patch(`/api/admin/committee-members`, { id: m.id, showContact: next });
    if (!res.ok) {
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, showContact: !next } : x)));
      toast.error(res.error || t("info.errUpdateMember"));
      return;
    }
    toast.success(next ? t("info.contactShown") : t("info.contactHidden"));
  }

  async function removeMember(id: string) {
    const ok = await confirmDialog({
      title: t("info.confirmRemoveMember"),
      confirmLabel: t("info.remove"),
      tone: "danger",
    });
    if (!ok) return;
    const res = await api.del(`/api/admin/committee-members?id=${id}`);
    if (!res.ok) {
      toast.error(res.error || t("info.errRemoveMember"));
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== id));
    if (memberDraft?.id === id) setMemberDraft(null);
    toast.success(t("info.memberRemoved"));
  }

  /* ============ Info sections ============ */
  async function saveInfo() {
    if (!infoEdit) return;
    if (!infoEdit.titleEn.trim()) return setError(t("info.errTitleRequired"));
    setBusy(true);
    setError(null);
    const payload = {
      titleEn: infoEdit.titleEn.trim(),
      titleGu: infoEdit.titleGu.trim() || undefined,
      bodyEn: infoEdit.bodyEn || undefined,
      bodyGu: infoEdit.bodyGu || undefined,
      isActive: infoEdit.isActive,
    };
    const res = infoEdit.id
      ? await api.patch<InfoSection>(`/api/admin/info-sections`, { id: infoEdit.id, ...payload })
      : await api.post<InfoSection>(`/api/admin/info-sections`, payload);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setInfo((prev) =>
      infoEdit.id ? prev.map((s) => (s.id === infoEdit.id ? { ...s, ...res.data } : s)) : [...prev, res.data],
    );
    toast.success(infoEdit.id ? t("info.pageUpdated") : t("info.pageAdded"));
    setInfoEdit(null);
  }

  async function deleteInfo(id: string) {
    const ok = await confirmDialog({
      title: t("info.confirmDeletePage"),
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    const res = await api.del(`/api/admin/info-sections?id=${id}`);
    if (!res.ok) return toast.error(res.error || t("info.errDeletePage"));
    setInfo((prev) => prev.filter((s) => s.id !== id));
    toast.success(t("info.pageDeleted"));
  }

  /* ============ Villages ============ */
  async function toggleVillage(v: Village) {
    const next = !v.showPhones;
    setVillages((prev) => prev.map((x) => (x.id === v.id ? { ...x, showPhones: next } : x)));
    const res = await api.patch(`/api/admin/villages`, { id: v.id, showPhones: next });
    if (!res.ok) {
      setVillages((prev) => prev.map((x) => (x.id === v.id ? { ...x, showPhones: !next } : x)));
      setError(res.error);
    }
  }

  async function addVillage() {
    if (!villageAdd) return;
    if (!villageAdd.nameEn.trim() || !villageAdd.nameGu.trim()) return setError(t("info.errBothNames"));
    setBusy(true);
    setError(null);
    const res = await api.post<Village>(`/api/admin/villages`, {
      nameEn: villageAdd.nameEn.trim(),
      nameGu: villageAdd.nameGu.trim(),
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setVillages((prev) => [...prev, { ...res.data, families: 0 }]);
    setVillageAdd(null);
  }

  return (
    <>
      <AdminH2 info={t("info.pageHint")}>{t("nav.info")}</AdminH2>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setTab(x.key)}
            className={cn(
              "cursor-pointer rounded-xl border px-4 py-2 text-[13px] font-bold transition-colors",
              tab === x.key
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[var(--line-admin)] bg-[var(--surface-admin)] text-[var(--ink-dim)]",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      {saved && (
        <p className="mb-4 rounded-xl border border-[var(--success-tint)] bg-[var(--success-tint)] px-3.5 py-2.5 text-[12.5px] font-bold text-[var(--success)]">
          ✓ {saved}
        </p>
      )}

      <section
        className={cn(
          "mb-6 rounded-2xl border border-[var(--line-admin)] bg-white p-5 max-md:p-4",
          tab === "basic" ? "" : "hidden",
        )}
      >
        <AdminH3>{t("info.brandHeading")}</AdminH3>

        <div className="relative mb-3 h-[132px] overflow-hidden rounded-xl bg-[var(--brand)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl || "/images/banners/common-banner.webp"}
            alt=""
            className="size-full object-cover"
          />
          {!bannerUrl && (
            <p className="absolute top-2 right-2 rounded-md bg-black/45 px-2 py-1 text-[10.5px] font-bold text-white">
              {t("info.defaultBanner")}
            </p>
          )}
          <span className="absolute bottom-3 left-3">
            <AdminFilePicker
              value={bannerUrl}
              folder="community"
              label={t("info.uploadBanner")}
              preview={false}
              onChange={setBannerUrl}
            />
          </span>
        </div>
        <p className="mb-3 text-[11px] text-[var(--faint)]">{t("info.bannerSize")}</p>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-14 flex-none items-center justify-center overflow-hidden rounded-[14px] border-2 border-[var(--gold-border)] bg-[var(--brand)] text-[17px] font-extrabold text-white">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-full object-cover" />
            ) : (
              (basic.nameGu || basic.nameEn || "?").trim().charAt(0)
            )}
          </span>
          <AdminFilePicker
            value={logoUrl}
            folder="community"
            label={t("info.uploadLogo")}
            preview={false}
            onChange={setLogoUrl}
          />
          <AdminBtn onClick={saveBranding} disabled={brandBusy}>
            {brandBusy ? <Loader2 className="size-4 animate-spin" /> : t("info.saveBranding")}
          </AdminBtn>
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--faint)]">{t("info.logoSize")}</p>
      </section>


      <section
        className={cn(
          "mb-6 rounded-2xl border border-[var(--line-admin)] bg-white p-5 max-md:p-4",
          tab === "basic" ? "" : "hidden",
        )}
      >
        <AdminH3>{t("info.basicHeading")}</AdminH3>
        <div className="grid gap-x-4 gap-y-3 md:grid-cols-2">
          {BASIC_FIELDS.map((f) => (
            <div key={f.key}>
              <AdminLabel>{f.label}</AdminLabel>
              {/* The two phone rows get the flag picker; everything else is a
                  plain text field. */}
              {f.key === "contactPhone" || f.key === "whatsapp" ? (
                <PhoneField
                  variant="admin"
                  value={{
                    iso: (f.key === "contactPhone" ? basic.contactPhoneIso : basic.whatsappIso) || DEFAULT_ISO,
                    digits: basic[f.key],
                  }}
                  onChange={(v) => {
                    setField(f.key, v.digits);
                    setField(f.key === "contactPhone" ? "contactPhoneIso" : "whatsappIso", v.iso);
                  }}
                  t={(gu, en) => (lang === "en" ? en : gu)}
                />
              ) : (
                <AdminInput
                  gujarati={f.gujarati}
                  speech={f.speech}
                  value={basic[f.key]}
                  onChange={(v) => {
                    setField(f.key, v);
                    if (f.key === "nameEn") {
                      fromEn(v, (gu) => setField("nameGu", gu), "basic-name");
                    } else if (f.key === "nameGu") {
                      guInput(v, (gu) => setField("nameGu", gu), "basic-name:gu");
                    }
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4">
          <AdminLabel>{t("info.descGu")}</AdminLabel>
          <GujaratiInput
            multiline
            rows={4}
            value={basic.descGu}
            onChange={(v) => {
              setField("descGu", v);
              guInput(v, (gu) => setField("descGu", gu), "desc:gu");
            }}
            inputClassName="flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent pl-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm min-h-[90px] border-[var(--line-field)] bg-[var(--field)] text-[13px] font-[family-name:var(--font-manrope),var(--font-noto-sans-gujarati),sans-serif]"
          />
        </div>
        <div className="mt-3">
          <AdminLabel>{t("info.descEn")}</AdminLabel>
          <SpeechTextarea
            value={basic.descEn}
            onChange={(v) => {
              setField("descEn", v);
              fromEn(v, (gu) => setField("descGu", gu), "desc");
            }}
            textareaClassName="flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent pl-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm min-h-[90px] border-[var(--line-field)] bg-[var(--field)] text-[13px]"
          />
        </div>

        <AdminBtn className="mt-4" onClick={saveBasic} disabled={basicBusy}>
          {basicBusy ? <Loader2 className="size-4 animate-spin" /> : t("info.saveBasic")}
        </AdminBtn>
      </section>

      {error && <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>}

      <div className="grid grid-cols-1 gap-6">
        <div className={tab === "committee" ? "" : "hidden"}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <AdminH3 className="mb-0" info={t("info.committeeHint")}>
                {t("info.committeeHeading")}
              </AdminH3>
              <p className="mt-1 text-[12px] text-[var(--faint)]">
                {tf(
                  members.length === 1 ? "info.committeeCountOne" : "info.committeeCountMany",
                  { n: members.length },
                )}
              </p>
            </div>

            <div className="flex w-full items-center gap-3 md:w-auto">
              <SearchInput
                value={memberQ}
                onChange={setMemberQ}
                placeholder={t("info.searchMember")}
                className="min-w-0 flex-1 md:w-[220px] md:flex-none"
              />
              <FilterButton
                className="md:hidden"
                active={memberStatusFilter !== "all"}
                onClick={() => setMemberFiltersOpen(true)}
              />
              <div className="hidden items-center gap-3 md:flex">
                <AdminSelect
                  value={memberStatusFilter}
                  onChange={(v) => setMemberStatusFilter(v as "all" | "active" | "inactive")}
                  options={MEMBER_STATUS_OPTIONS}
                  className="w-[150px] shrink-0"
                  ariaLabel={t("info.filterByStatus")}
                />
                <AdminBtn className="shrink-0" onClick={openNewMember}>
                  <Plus className="size-4" />
                  {t("info.addMember")}
                </AdminBtn>
              </div>
            </div>
            <AdminBtn className="w-full justify-center md:hidden" onClick={openNewMember}>
              <Plus className="size-4" />
              {t("info.addMember")}
            </AdminBtn>
          </div>

          <Sheet open={memberFiltersOpen} onOpenChange={setMemberFiltersOpen}>
            <SheetContent side="bottom" className="md:hidden">
              <SheetHeader>
                <SheetTitle>{t("info.filters")}</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4 pb-4">
                <div>
                  <AdminLabel>{t("info.status")}</AdminLabel>
                  <AdminSelect
                    value={memberStatusFilter}
                    onChange={(v) => setMemberStatusFilter(v as "all" | "active" | "inactive")}
                    options={MEMBER_STATUS_OPTIONS}
                    className="w-full"
                    ariaLabel={t("info.filterByStatus")}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <AdminTable>
            <thead>
              <tr>
                <AdminTh>{t("info.thMember")}</AdminTh>
                <AdminTh>{t("info.thContact")}</AdminTh>
                <AdminTh>{t("info.status")}</AdminTh>
                <AdminTh>
                  <span className="flex items-center gap-1.5">
                    {t("info.thShowContact")}
                    <AdminInfoTip side="top">{t("info.showContactTip")}</AdminInfoTip>
                  </span>
                </AdminTh>
                <AdminTh className="text-right">{t("info.thActions")}</AdminTh>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map(({ m, index }) => {
                const showWhatsapp = !!m.whatsapp && m.whatsapp !== m.phoneOverride;
                const hasContact = !!m.phoneOverride || showWhatsapp || !!m.email;

                return (
                <tr key={m.id}>
                  <AdminTd>
                    <span className="flex items-center gap-2.5">
                      <span className="flex flex-none flex-col leading-none">
                        <button
                          type="button"
                          aria-label={t("info.moveUp")}
                          disabled={index === 0}
                          onClick={() => moveMember(index, -1)}
                          className="cursor-pointer px-1 text-[10px] text-[var(--faint)] disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          aria-label={t("info.moveDown")}
                          disabled={index === members.length - 1}
                          onClick={() => moveMember(index, 1)}
                          className="cursor-pointer px-1 text-[10px] text-[var(--faint)] disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </span>
                      <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-[var(--brand-tint)] text-[13px] font-extrabold text-[var(--brand)]">
                        {(m.nameGu || m.nameOverride || "?").trim().charAt(0).toUpperCase() || "?"}
                      </span>
                      <span className="min-w-0">
                        {(m.roleGu || m.roleEn) && (
                          <span className="block text-[11px] font-extrabold text-[var(--brand)]">
                            {m.roleGu || m.roleEn}
                          </span>
                        )}
                        <span className="block font-semibold whitespace-nowrap text-[var(--ink)]">
                          {m.nameGu || m.nameOverride || "—"}
                        </span>
                      </span>
                    </span>
                  </AdminTd>
                  <AdminTd>
                    {hasContact ? (
                      <div className="flex flex-col gap-1.5 text-[12.5px]">
                        {m.phoneOverride && (
                          <a
                            href={telLink(m.phoneOverride, m.phoneIso)}
                            className="inline-flex w-fit items-center gap-2.5 text-[var(--ink-mid)] hover:text-[var(--brand)]"
                          >
                            <Phone className="size-3.5 flex-none text-[var(--faint)]" strokeWidth={2} />
                            {m.phoneOverride}
                          </a>
                        )}
                        {showWhatsapp && (
                          <a
                            href={waLink(m.whatsapp, m.whatsappIso)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-fit items-center gap-2.5 text-[var(--ink-mid)] hover:text-[var(--brand)]"
                          >
                            <span className="flex-none text-[var(--faint)]">
                              <WaIcon size={14} />
                            </span>
                            {m.whatsapp}
                          </a>
                        )}
                        {m.email && (
                          <a
                            href={`mailto:${m.email}`}
                            className="inline-flex w-fit items-center gap-2.5 text-[var(--ink-mid)] hover:text-[var(--brand)]"
                          >
                            <Mail className="size-3.5 flex-none text-[var(--faint)]" strokeWidth={2} />
                            {m.email}
                          </a>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </AdminTd>
                  <AdminTd>
                    {m.isActive ? (
                      <PillActive>{t("info.active")}</PillActive>
                    ) : (
                      <PillWarning>{t("info.inactive")}</PillWarning>
                    )}
                  </AdminTd>
                  <AdminTd>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={m.showContact}
                      aria-label={m.showContact ? t("info.clickHideContact") : t("info.clickShowContact")}
                      title={m.showContact ? t("info.clickHideContact") : t("info.clickShowContact")}
                      onClick={() => toggleShowContact(m)}
                      className={cn(
                        "relative inline-flex h-5 w-9 flex-none cursor-pointer items-center rounded-full transition-colors",
                        m.showContact ? "bg-[var(--wa)]" : "bg-[var(--scroll-thumb)]",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-[2px] flex size-4 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left]",
                          m.showContact ? "left-[18px]" : "left-[2px]",
                        )}
                      >
                        {m.showContact ? (
                          <Phone className="size-2.5 text-[var(--wa)]" strokeWidth={2.5} />
                        ) : (
                          <PhoneOff className="size-2.5 text-[var(--faint)]" strokeWidth={2.5} />
                        )}
                      </span>
                    </button>
                  </AdminTd>
                  <AdminTd className="text-right">
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      <ActionBtn icon={Pencil} label={t("common.edit")} onClick={() => editMember(m)} />
                      <ActionBtn
                        icon={m.isActive ? EyeOff : Eye}
                        label={m.isActive ? t("info.deactivate") : t("info.activate")}
                        tone={m.isActive ? "warn" : "success"}
                        onClick={() => toggleMemberActive(m)}
                      />
                      <ActionBtn
                        icon={Trash2}
                        label={t("info.remove")}
                        tone="danger"
                        onClick={() => removeMember(m.id)}
                      />
                    </span>
                  </AdminTd>
                </tr>
                );
              })}
            </tbody>
          </AdminTable>
          {filteredMembers.length === 0 && (
            <p className="py-6 text-center text-[11.5px] text-[var(--faint)]">
              {members.length === 0 ? t("info.noMembers") : t("info.noMatchingMembers")}
            </p>
          )}
        </div>

        <div className={tab === "sections" ? "" : "hidden"}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <AdminH3 className="mb-0 shrink-0">{t("info.sectionsHeading")}</AdminH3>

            <div className="flex w-full items-center gap-3 md:w-auto">
              <SearchInput
                value={secQ}
                onChange={setSecQ}
                placeholder={t("info.searchSection")}
                className="min-w-0 flex-1 md:w-[220px] md:flex-none"
              />
              <FilterButton
                className="md:hidden"
                active={secStatusFilter !== "all"}
                onClick={() => setSecFiltersOpen(true)}
              />
              <div className="hidden items-center gap-3 md:flex">
                <AdminSelect
                  value={secStatusFilter}
                  onChange={(v) => setSecStatusFilter(v as "all" | "active" | "inactive")}
                  options={SECTION_STATUS_OPTIONS}
                  className="w-[150px] shrink-0"
                  ariaLabel={t("info.filterByStatus")}
                />
                <AdminBtn
                  className="shrink-0"
                  onClick={() =>
                    setInfoEdit({ id: null, titleEn: "", titleGu: "", bodyEn: "", bodyGu: "", isActive: true })
                  }
                >
                  <Plus className="size-4" />
                  {t("info.newPage")}
                </AdminBtn>
              </div>
            </div>
            <AdminBtn
              className="w-full justify-center md:hidden"
              onClick={() =>
                setInfoEdit({ id: null, titleEn: "", titleGu: "", bodyEn: "", bodyGu: "", isActive: true })
              }
            >
              <Plus className="size-4" />
              {t("info.newPage")}
            </AdminBtn>
          </div>

          <Sheet open={secFiltersOpen} onOpenChange={setSecFiltersOpen}>
            <SheetContent side="bottom" className="md:hidden">
              <SheetHeader>
                <SheetTitle>{t("info.filters")}</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4 pb-4">
                <div>
                  <AdminLabel>{t("info.status")}</AdminLabel>
                  <AdminSelect
                    value={secStatusFilter}
                    onChange={(v) => setSecStatusFilter(v as "all" | "active" | "inactive")}
                    options={SECTION_STATUS_OPTIONS}
                    className="w-full"
                    ariaLabel={t("info.filterByStatus")}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <AdminTable>
            <thead>
              <tr>
                <AdminTh>{t("info.thSection")}</AdminTh>
                <AdminTh>{t("info.status")}</AdminTh>
                <AdminTh className="text-right">{t("info.thActions")}</AdminTh>
              </tr>
            </thead>
            <tbody>
              {filteredInfo.map(({ s, index }) => (
                <tr key={s.id}>
                  <AdminTd>
                    <span className="flex items-start gap-2.5">
                      <span className="flex flex-none flex-col leading-none pt-0.5">
                        <button
                          type="button"
                          aria-label={t("info.moveUp")}
                          disabled={index === 0}
                          onClick={() => moveSection(index, -1)}
                          className="cursor-pointer px-1 text-[10px] text-[var(--faint)] disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          aria-label={t("info.moveDown")}
                          disabled={index === info.length - 1}
                          onClick={() => moveSection(index, 1)}
                          className="cursor-pointer px-1 text-[10px] text-[var(--faint)] disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-[var(--ink)]">{s.titleGu || s.titleEn}</span>
                        {(s.bodyGu || s.bodyEn) && (
                          <span className="mt-0.5 line-clamp-1 block text-[11.5px] text-[var(--faint)]">
                            {s.bodyGu || s.bodyEn}
                          </span>
                        )}
                      </span>
                    </span>
                  </AdminTd>
                  <AdminTd>
                    {s.isActive ? (
                      <PillActive>{t("info.active")}</PillActive>
                    ) : (
                      <PillWarning>{t("info.hidden")}</PillWarning>
                    )}
                  </AdminTd>
                  <AdminTd className="text-right">
                    <span className="flex flex-wrap justify-end gap-1.5">
                      <ActionBtn
                        icon={Pencil}
                        label={t("common.edit")}
                        onClick={() =>
                          setInfoEdit({
                            id: s.id,
                            titleEn: s.titleEn,
                            titleGu: s.titleGu || "",
                            bodyEn: s.bodyEn || "",
                            bodyGu: s.bodyGu || "",
                            isActive: s.isActive,
                          })
                        }
                      />
                      <ActionBtn
                        icon={s.isActive ? EyeOff : Eye}
                        label={s.isActive ? t("info.hide") : t("info.show")}
                        tone={s.isActive ? "warn" : "success"}
                        onClick={() => toggleSectionActive(s)}
                      />
                      <ActionBtn
                        icon={Trash2}
                        label={t("common.delete")}
                        tone="danger"
                        onClick={() => deleteInfo(s.id)}
                      />
                    </span>
                  </AdminTd>
                </tr>
              ))}
            </tbody>
          </AdminTable>
          {filteredInfo.length === 0 && (
            <p className="py-6 text-center text-[11.5px] text-[var(--faint)]">
              {info.length === 0 ? t("info.noPages") : t("info.noMatchingSections")}
            </p>
          )}
        </div>
      </div>

      <div
        className={cn(
          "mt-[26px] rounded-[14px] border border-[var(--line-field)] bg-[var(--field)] p-4",
          tab === "basic" ? "" : "hidden",
        )}
      >
        <AdminH3 info={t("info.upiHint")}>{t("info.upiHeading")}</AdminH3>
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="min-w-[220px] flex-1">
            <AdminLabel>{t("info.upiLabel")}</AdminLabel>
            <AdminInput
              value={upiDraft}
              onChange={setUpiDraft}
              placeholder={t("info.upiPlaceholder")}
            />
          </div>
          <AdminBtn onClick={saveUpi} disabled={busy || upiDraft.trim() === upiId}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : t("info.saveUpi")}
          </AdminBtn>
        </div>
        {upiId ? (
          <p className="mt-2 text-[12px] font-semibold text-[var(--success)]">
            {tf("info.upiActive", { id: upiId })}
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-[var(--faint)]">{t("info.noUpi")}</p>
        )}
      </div>

      <div
        className={cn(
          "mt-[26px] mb-3 flex flex-wrap items-center justify-between gap-3",
          tab === "basic" ? "" : "hidden",
        )}
      >
        <AdminH3 className="mb-0" info={t("info.villageHint")}>
          {t("info.villageHeading")}
        </AdminH3>
      </div>

      <AdminTable className={tab === "basic" ? "" : "hidden"}>
        <thead>
          <tr>
            <AdminTh>{t("info.thVillage")}</AdminTh>
            <AdminTh>{t("info.thFamilies")}</AdminTh>
            <AdminTh>{t("info.thShowNumbers")}</AdminTh>
          </tr>
        </thead>
        <tbody>
          {villages.map((v) => (
            <tr key={v.id}>
              <AdminTd>
                <b>
                  {v.nameGu} / {v.nameEn}
                </b>
              </AdminTd>
              <AdminTd>{v.families}</AdminTd>
              <AdminTd>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={v.showPhones}
                    onCheckedChange={() => toggleVillage(v)}
                    className={cn(
                      "h-[27px] w-[46px] data-checked:bg-[var(--wa)] data-unchecked:bg-[var(--scroll-thumb)]",
                      "[&_[data-slot=switch-thumb]]:size-[21px]",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[11.5px] font-bold",
                      v.showPhones ? "text-[var(--success)]" : "text-[var(--danger)]",
                    )}
                  >
                    {v.showPhones ? t("info.onShown") : t("info.offHidden")}
                  </span>
                </div>
              </AdminTd>
            </tr>
          ))}
          <tr>
            <AdminTd colSpan={3}>
              <button
                type="button"
                onClick={() => setVillageAdd({ nameEn: "", nameGu: "" })}
                className="cursor-pointer font-bold text-[var(--brand)]"
              >
                + {t("info.addVillage")}
              </button>
            </AdminTd>
          </tr>
        </tbody>
      </AdminTable>

      {/* Info edit dialog */}
      <Dialog open={infoEdit !== null} onOpenChange={(o) => !o && setInfoEdit(null)}>
        <DialogContent className="max-h-[88vh] max-w-[460px] overflow-y-auto rounded-2xl sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              {infoEdit?.id ? t("info.editPage") : t("info.newPageTitle")}
            </DialogTitle>
          </DialogHeader>
          {infoEdit && (
            <div>
              <AdminLabel>{t("info.titleEnLabel")}</AdminLabel>
              <AdminInput
                speech
                value={infoEdit.titleEn}
                onChange={(v) => {
                  setInfoEdit((prev) => (prev ? { ...prev, titleEn: v } : prev));
                  fromEn(v, (gu) => setInfoEdit((prev) => (prev ? { ...prev, titleGu: gu } : prev)), "title");
                }}
              />
              <AdminLabel>{t("info.titleGuLabel")}</AdminLabel>
              <AdminInput
                gujarati
                value={infoEdit.titleGu}
                onChange={(v) => {
                  setInfoEdit((prev) => (prev ? { ...prev, titleGu: v } : prev));
                  guInput(v, (gu) => setInfoEdit((prev) => (prev ? { ...prev, titleGu: gu } : prev)), "title:gu");
                }}
              />
              <AdminLabel>{t("info.bodyEnLabel")}</AdminLabel>
              <Textarea
                value={infoEdit.bodyEn}
                onChange={(e) => {
                  const v = e.target.value;
                  setInfoEdit((prev) => (prev ? { ...prev, bodyEn: v } : prev));
                  fromEn(v, (gu) => setInfoEdit((prev) => (prev ? { ...prev, bodyGu: gu } : prev)), "body");
                }}
                className="mb-2 min-h-[80px] border-[var(--line-field)] bg-[var(--field)] text-[13px]"
              />
              <AdminLabel>{t("info.bodyGuLabel")}</AdminLabel>
              <Textarea
                value={infoEdit.bodyGu}
                onChange={(e) => {
                  const v = e.target.value;
                  setInfoEdit((prev) => (prev ? { ...prev, bodyGu: v } : prev));
                  guInput(v, (gu) => setInfoEdit((prev) => (prev ? { ...prev, bodyGu: gu } : prev)), "body:gu");
                }}
                className="mb-2 min-h-[80px] border-[var(--line-field)] bg-[var(--field)] text-[13px]"
              />
              <AdminLabel>{t("info.visibility")}</AdminLabel>
              <AdminSegmented
                value={infoEdit.isActive ? "active" : "hidden"}
                onChange={(v) => setInfoEdit((prev) => (prev ? { ...prev, isActive: v === "active" } : prev))}
                options={[
                  { value: "active", label: t("info.active") },
                  { value: "hidden", label: t("info.hidden") },
                ]}
              />
              {error && <p className="mt-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
              <div className="mt-3 flex gap-2.5">
                <AdminBtn className="flex-1 justify-center" onClick={saveInfo}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : t("common.save")}
                </AdminBtn>
                <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setInfoEdit(null)}>
                  {t("common.cancel")}
                </AdminBtn>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Village add dialog */}
      <Dialog open={villageAdd !== null} onOpenChange={(o) => !o && setVillageAdd(null)}>
        <DialogContent className="max-w-[360px] rounded-2xl sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              {t("info.addVillage")}
            </DialogTitle>
          </DialogHeader>
          {villageAdd && (
            <div>
              <AdminLabel>{t("info.nameEnReq")}</AdminLabel>
              <AdminInput
                speech
                value={villageAdd.nameEn}
                onChange={(v) => {
                  setVillageAdd((prev) => (prev ? { ...prev, nameEn: v } : prev));
                  fromEn(v, (gu) => setVillageAdd((prev) => (prev ? { ...prev, nameGu: gu } : prev)));
                }}
              />
              <AdminLabel>{t("info.nameGuReq")}</AdminLabel>
              <AdminInput
                gujarati
                value={villageAdd.nameGu}
                onChange={(v) => {
                  setVillageAdd((prev) => (prev ? { ...prev, nameGu: v } : prev));
                  guInput(v, (gu) => setVillageAdd((prev) => (prev ? { ...prev, nameGu: gu } : prev)), "gu");
                }}
              />
              <div className="mt-4 flex gap-2.5">
                <AdminBtn className="flex-1 justify-center" onClick={addVillage}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : t("common.add")}
                </AdminBtn>
                <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setVillageAdd(null)}>
                  {t("common.cancel")}
                </AdminBtn>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / edit committee member modal */}
      <AdminModal
        open={memberDraft !== null}
        onClose={() => setMemberDraft(null)}
        title={memberDraft?.id ? t("info.editMember") : t("info.addMember")}
        subtitle={t("info.memberModalSub")}
        footer={
          <AdminModalActions
            onSave={saveMember}
            onCancel={() => setMemberDraft(null)}
            busy={memberBusy}
            saveLabel={memberDraft?.id ? t("info.saveChanges") : t("info.addMemberShort")}
          />
        }
      >
        {memberDraft && (
          <>
            <AdminField
              label={t("info.linkMember")}
              hint={t("info.linkMemberHint")}
            >
              <AdminSearchSelect
                items={memberOptions}
                value={selectedProfile}
                placeholder={t("info.searchDirectory")}
                renderLabel={(p) => p.nameGu || p.nameEn}
                renderMeta={(p) => [p.mobile, p.family].filter(Boolean).join(" · ")}
                emptyText={t("info.noMemberFound")}
                onChange={(p) =>
                  setMemberDraft((d) =>
                    d
                      ? {
                          ...d,
                          profileId: p?.id ?? null,
                          nameOverride: p ? p.nameEn : d.nameOverride,
                          nameGu: p ? p.nameGu : d.nameGu,
                          phoneOverride: p ? p.mobile : d.phoneOverride,
                        }
                      : d,
                  )
                }
              />
            </AdminField>
            <p className="-mt-2 mb-3 text-[11px] text-[var(--faint)]">{t("info.orManual")}</p>

            <AdminFormRow>
              <AdminField label={t("info.roleGu")} required>
                <AdminInput
                  gujarati
                  value={memberDraft.roleGu}
                  placeholder={t("info.rolePlaceholder")}
                  onChange={(v) => {
                    setMemberDraft((d) => (d ? { ...d, roleGu: v } : d));
                    guInput(v, (gu) => setMemberDraft((d) => (d ? { ...d, roleGu: gu } : d)), "member-role:gu");
                  }}
                />
              </AdminField>
              <AdminField label={t("info.roleEn")}>
                <AdminInput
                  value={memberDraft.roleEn}
                  placeholder={t("info.rolePlaceholder")}
                  onChange={(v) => {
                    setMemberDraft((d) => (d ? { ...d, roleEn: v } : d));
                    fromEn(v, (gu) => setMemberDraft((d) => (d ? { ...d, roleGu: gu } : d)), "member-role");
                  }}
                />
              </AdminField>
            </AdminFormRow>

            <AdminFormRow>
              <AdminField label={t("info.nameGu")} required>
                <AdminInput
                  gujarati
                  value={memberDraft.nameGu}
                  onChange={(v) => {
                    setMemberDraft((d) => (d ? { ...d, nameGu: v } : d));
                    guInput(v, (gu) => setMemberDraft((d) => (d ? { ...d, nameGu: gu } : d)), "member-name:gu");
                  }}
                />
              </AdminField>
              <AdminField label={t("info.nameEn")}>
                <AdminInput
                  speech
                  value={memberDraft.nameOverride}
                  onChange={(v) => {
                    setMemberDraft((d) => (d ? { ...d, nameOverride: v } : d));
                    fromEn(v, (gu) => setMemberDraft((d) => (d ? { ...d, nameGu: gu } : d)), "member-name");
                  }}
                />
              </AdminField>
            </AdminFormRow>

            <AdminFormRow>
              <AdminField label={t("info.mobile")}>
                <PhoneField
                  variant="admin"
                  value={{ iso: memberDraft.phoneIso, digits: memberDraft.phoneOverride }}
                  onChange={(v) =>
                    setMemberDraft((d) =>
                      d
                        ? {
                            ...d,
                            phoneOverride: v.digits,
                            phoneIso: v.iso,
                            ...(d.sameWhatsapp ? { whatsappIso: v.iso } : {}),
                          }
                        : d,
                    )
                  }
                  t={(gu, en) => (lang === "en" ? en : gu)}
                />
              </AdminField>
              {memberDraft.sameWhatsapp ? (
                <AdminField label={t("info.whatsapp")}>
                  <button
                    type="button"
                    onClick={() => setMemberDraft((d) => (d ? { ...d, sameWhatsapp: false } : d))}
                    className="flex h-[42px] w-full cursor-pointer items-center justify-between rounded-[11px] border-[1.5px] border-[var(--line-field)] bg-[var(--field)] px-3.5 text-[13px] font-semibold text-[var(--ink)]"
                  >
                    <span>{t("info.sameAsMobileFull")}</span>
                    <span className="relative h-[22px] w-[38px] flex-none rounded-2xl bg-[var(--wa)]">
                      <span className="absolute top-[2.5px] left-[18px] size-[17px] rounded-full bg-white shadow" />
                    </span>
                  </button>
                </AdminField>
              ) : (
                <AdminField
                  label={
                    <span className="flex items-center justify-between gap-2">
                      <span>{t("info.whatsapp")}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setMemberDraft((d) => (d ? { ...d, sameWhatsapp: true, whatsapp: "" } : d))
                        }
                        className="cursor-pointer text-[10.5px] font-bold text-[var(--brand)] underline"
                      >
                        {t("info.sameAsMobile")}
                      </button>
                    </span>
                  }
                >
                  <PhoneField
                    variant="admin"
                    value={{ iso: memberDraft.whatsappIso, digits: memberDraft.whatsapp }}
                    onChange={(v) =>
                      setMemberDraft((d) => (d ? { ...d, whatsapp: v.digits, whatsappIso: v.iso } : d))
                    }
                    t={(gu, en) => (lang === "en" ? en : gu)}
                  />
                </AdminField>
              )}
            </AdminFormRow>

            <AdminFormRow>
              <AdminField label={t("info.email")}>
                <AdminInput
                  type="email"
                  value={memberDraft.email}
                  onChange={(v) => setMemberDraft((d) => (d ? { ...d, email: v } : d))}
                />
              </AdminField>
              <AdminField label={t("info.displayOrder")}>
                <AdminInput
                  type="number"
                  value={String(memberDraft.sortOrder)}
                  onChange={(v) => setMemberDraft((d) => (d ? { ...d, sortOrder: Number(v) || 0 } : d))}
                />
              </AdminField>
            </AdminFormRow>

            <AdminField label={t("info.shortDesc")}>
              <Textarea
                value={memberDraft.descGu}
                onChange={(e) => {
                  const v = e.target.value;
                  setMemberDraft((d) => (d ? { ...d, descGu: v } : d));
                }}
                className="min-h-[70px] border-[var(--line-field)] bg-[var(--field)] text-[13px]"
              />
            </AdminField>

            <div className="mb-3 flex items-center gap-3 rounded-xl border border-[var(--line-admin)] bg-[#FBFAF7] p-3">
              <div className="flex-1">
                <div className="text-[12.5px] font-bold text-[var(--ink)]">{t("info.showContactApp")}</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--faint)]">
                  {t("info.showContactOffHint")}
                </div>
              </div>
              <Switch
                checked={memberDraft.showContact}
                onCheckedChange={(v) => setMemberDraft((d) => (d ? { ...d, showContact: v } : d))}
                className="h-[27px] w-[46px] data-checked:bg-[var(--wa)] data-unchecked:bg-[var(--scroll-thumb)] [&_[data-slot=switch-thumb]]:size-[21px]"
              />
            </div>

            <AdminField label={t("info.status")}>
              <AdminSegmented
                value={memberDraft.isActive ? "active" : "inactive"}
                onChange={(v) => setMemberDraft((d) => (d ? { ...d, isActive: v === "active" } : d))}
                options={[
                  { value: "active", label: t("info.active"), tone: "success" },
                  { value: "inactive", label: t("info.inactive"), tone: "danger" },
                ]}
              />
            </AdminField>

            {memberFormError && (
              <p className="mt-1 text-[12.5px] font-semibold text-[var(--danger)]">{memberFormError}</p>
            )}
          </>
        )}
      </AdminModal>
    </>
  );
}
