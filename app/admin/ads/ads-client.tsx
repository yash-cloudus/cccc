"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  PauseCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  ActionBtn,
  AdminBtn,
  AdminH2,
  AdminInput,
  AdminLabel,
  AdminSelect,
  AdminTable,
  AdminTd,
  AdminTh,
  FilterButton,
  LinkAction,
  SearchInput,
} from "@/components/admin/admin-ui";
import {
  AdminField,
  AdminFilePicker,
  AdminFormRow,
  AdminFormSection,
  AdminModal,
  AdminModalActions,
  AdminSegmented,
} from "@/components/admin/admin-form";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { WithTooltip } from "@/components/ui/tooltip";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import { DateField } from "@/components/ui/date-field";
import { PhoneField } from "@/components/ui/phone-field";
import { DEFAULT_ISO, digitsOf, isValidNumber } from "@/lib/phone";
import { phoneText } from "@/lib/format";
import { useAdminT, type AdminKey } from "@/lib/i18n/admin-dictionary";

export type AdStatus =
  | "PENDING"
  | "ACTIVE"
  | "EXPIRED"
  | "REJECTED"
  | "DEACTIVATED"
  | "DRAFT";

export type AdRow = {
  id: string;
  name: string;
  nameEn: string;
  nameGu: string;
  pitch: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  ownerName: string | null;
  ownerMobile: string | null;
  ownerMobileIso: string | null;
  category: string | null;
  rejectReason: string | null;
  type: "premium" | "general";
  source: "user" | "admin";
  payStatus: string;
  paymentProof: string | null;
  status: AdStatus;
  priority: number;
  views: number;
  clicks: number;
  createdAt: string;
  startDate: string;
  endDate: string;
};

export type CategoryOption = {
  value: string;
  label: string;
};

export type BusinessOption = {
  id: string;
  name: string;
  /** English category value stored on the ad. */
  category: string;
  categoryLabel: string;
  /** Dropdown display: business · category. */
  label: string;
  ownerName: string;
  ownerMobile: string;
  ownerMobileIso: string;
  description: string;
  address: string;
};

/** Status pill palette — matches Admin.dc.html `stMeta`. */
const STATUS_META: Record<AdStatus, { labelKey: AdminKey; className: string }> = {
  PENDING: { labelKey: "ads.stPending", className: "bg-[var(--gold-tint)] text-[var(--warn)]" },
  ACTIVE: { labelKey: "ads.stActive", className: "bg-[var(--success-tint)] text-[var(--success)]" },
  EXPIRED: { labelKey: "ads.stExpired", className: "bg-[var(--danger-tint)] text-[var(--danger)]" },
  REJECTED: { labelKey: "ads.stRejected", className: "bg-[var(--danger-tint)] text-[var(--danger)]" },
  DEACTIVATED: { labelKey: "ads.stDeactivated", className: "bg-[var(--line-soft)] text-[var(--muted)]" },
  DRAFT: { labelKey: "ads.stDraft", className: "bg-[#EEF1F6] text-[#4A5B72]" },
};

const STATUS_FILTER_OPTIONS: { value: "all" | AdStatus; labelKey: AdminKey }[] = [
  { value: "all", labelKey: "ads.allStatuses" },
  { value: "PENDING", labelKey: "ads.stPending" },
  { value: "ACTIVE", labelKey: "ads.stActive" },
  { value: "EXPIRED", labelKey: "ads.stExpired" },
  { value: "REJECTED", labelKey: "ads.stRejected" },
  { value: "DEACTIVATED", labelKey: "ads.stDeactivated" },
  { value: "DRAFT", labelKey: "ads.stDraft" },
];

const SOURCE_FILTER_OPTIONS: { value: "all" | "user" | "admin"; labelKey: AdminKey }[] = [
  { value: "all", labelKey: "ads.allSources" },
  { value: "user", labelKey: "ads.srcUserApp" },
  { value: "admin", labelKey: "ads.srcAdmin" },
];

const TAB_LABEL_KEYS: Record<"all" | "premium" | "general", AdminKey> = {
  all: "ads.tabAll",
  premium: "ads.typePremium",
  general: "ads.typeGeneral",
};

const PAY_OPTS: { value: string; labelKey: AdminKey }[] = [
  { value: "pending", labelKey: "ads.payPending" },
  { value: "verified", labelKey: "ads.payVerified" },
  { value: "manual", labelKey: "ads.payManual" },
  { value: "notreq", labelKey: "ads.payNotRequired" },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

const toDateInput = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
};

/** Digits only — how many are allowed depends on the country. */
function sanitizeMobile(raw: string) {
  return digitsOf(raw).slice(0, 15);
}

function isValidMobile(mobile: string, iso: string) {
  if (!mobile) return true; // optional
  return isValidNumber(mobile, iso);
}

function renewEndIso(currentEndIso: string, dur: "6m" | "1y") {
  const end = new Date(currentEndIso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const base = end.getTime() > today.getTime() ? end : today;
  const days = dur === "6m" ? 182 : 365;
  return new Date(base.getTime() + days * 86_400_000).toISOString();
}

type Draft = {
  /** Two-step flow: pick the ad type, then fill the form (matches prototype). */
  step: "type" | "form";
  businessMode: "existing" | "new";
  businessId: string;
  name: string;
  pitch: string;
  imageUrl: string;
  linkUrl: string;
  ownerName: string;
  ownerMobile: string;
  ownerMobileIso: string;
  category: string;
  type: "premium" | "general";
  status: AdStatus;
  startDate: string;
  endDate: string;
  priority: string;
  payStatus: string;
};

type EditForm = {
  name: string;
  pitch: string;
  imageUrl: string;
  linkUrl: string;
  ownerName: string;
  ownerMobile: string;
  ownerMobileIso: string;
  category: string;
  status: AdStatus;
  startDate: string;
  endDate: string;
  priority: string;
  payStatus: string;
};

type Modal =
  | { kind: "create"; draft: Draft }
  | { kind: "view"; ad: AdRow }
  | { kind: "edit"; ad: AdRow; form: EditForm }
  | { kind: "renew"; ad: AdRow; dur: "6m" | "1y" }
  | { kind: "review"; ad: AdRow; reason: string };

const emptyDraft = (): Draft => {
  const start = new Date();
  const end = new Date(Date.now() + 365 * 86_400_000);
  return {
    step: "type",
    businessMode: "existing",
    businessId: "",
    name: "",
    pitch: "",
    imageUrl: "",
    linkUrl: "",
    ownerName: "",
    ownerMobile: "",
    ownerMobileIso: DEFAULT_ISO,
    category: "",
    type: "premium",
    status: "ACTIVE",
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    priority: "0",
    payStatus: "notreq",
  };
};

function adDisplayName(ad: AdRow, lang: string): string {
  return lang === "en" ? ad.nameEn || ad.nameGu || ad.name : ad.nameGu || ad.nameEn || ad.name;
}

function editFormFrom(ad: AdRow): EditForm {
  return {
    name: ad.name,
    pitch: ad.pitch ?? "",
    imageUrl: ad.imageUrl ?? "",
    linkUrl: ad.linkUrl ?? "",
    ownerName: ad.ownerName ?? "",
    ownerMobile: ad.ownerMobile ?? "",
    ownerMobileIso: ad.ownerMobileIso ?? DEFAULT_ISO,
    category: ad.category ?? "",
    status: ad.status,
    startDate: toDateInput(ad.startDate),
    endDate: toDateInput(ad.endDate),
    priority: String(ad.priority),
    payStatus: ad.payStatus || "pending",
  };
}

function StatusPill({ status }: { status: AdStatus }) {
  const { t, lang } = useAdminT();
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold", meta.className)}>
      {t(meta.labelKey)}
    </span>
  );
}

function AdSummaryCard({ ad }: { ad: AdRow }) {
  const { t, lang } = useAdminT();
  const payOpt = PAY_OPTS.find((p) => p.value === ad.payStatus);
  return (
    <div className="mb-4 rounded-[14px] border border-[var(--line-admin)] bg-[var(--surface-admin)] p-3.5">
      <div className="flex gap-3">
        {ad.type === "premium" && (
          <div className="flex w-[88px] shrink-0 flex-col items-center gap-1">
            {ad.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ad.imageUrl}
                alt=""
                className="h-14 w-[88px] rounded-lg border border-[var(--line)] object-cover"
              />
            ) : (
              <span className="flex h-14 w-[88px] items-center justify-center rounded-lg bg-white text-[10px] font-bold text-[var(--faint)]">
                {t("ads.noBanner")}
              </span>
            )}
            <span className="text-[10px] font-bold text-[var(--faint)]">{t("ads.banner")}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <b className="text-[15px] text-[var(--ink)]">{adDisplayName(ad, lang)}</b>
            <span className="rounded-full bg-[#EEF1F6] px-2 py-0.5 text-[10.5px] font-bold capitalize text-[#4A5B72]">
              {t(ad.type === "premium" ? "ads.typePremium" : "ads.typeGeneral")}
            </span>
            <span className="rounded-full bg-[var(--line-soft)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--muted)]">
              {t(ad.source === "user" ? "ads.srcUser" : "ads.srcAdmin")}
            </span>
          </div>
          <div className="text-[12px] text-[var(--ink-dim)]">
            {ad.ownerName || "—"} · {ad.category || "—"}
          </div>
          {ad.ownerMobile && (
            <div className="mt-0.5 text-[11.5px] text-[var(--faint)]">{phoneText(ad.ownerMobile, ad.ownerMobileIso)}</div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill status={ad.status} />
            {ad.type === "premium" && (
              <span className="inline-block rounded-full bg-[#EEF1F6] px-2 py-0.5 text-[10.5px] font-bold text-[#4A5B72]">
                {t("ads.paymentLabel")}: {payOpt ? t(payOpt.labelKey) : ad.payStatus}
              </span>
            )}
          </div>
        </div>
        {ad.type === "premium" && (
          <div className="flex w-[88px] shrink-0 flex-col items-center gap-1">
            {ad.paymentProof ? (
              <a
                href={ad.paymentProof}
                target="_blank"
                rel="noreferrer"
                title={t("ads.viewPaymentProof")}
                className="block h-14 w-[88px] overflow-hidden rounded-lg border border-[var(--line)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ad.paymentProof}
                  alt={t("ads.paymentScreenshot")}
                  className="h-full w-full object-cover"
                />
              </a>
            ) : (
              <span className="flex h-14 w-[88px] items-center justify-center rounded-lg bg-white px-1 text-center text-[10px] font-bold text-[var(--faint)]">
                {t("ads.noProof")}
              </span>
            )}
            <span className="text-[10px] font-bold text-[var(--faint)]">{t("ads.paymentProof")}</span>
          </div>
        )}
      </div>
      {ad.type === "premium" && (
        <div className="mt-3 flex gap-5 border-t border-[var(--line-soft)] pt-3 text-[12px] text-[var(--ink)]">
          <div>
            <span className="text-[var(--faint)]">{t("ads.thStart")}</span>
            <br />
            <b>{fmtDate(ad.startDate)}</b>
          </div>
          <div>
            <span className="text-[var(--faint)]">{t("ads.thEnd")}</span>
            <br />
            <b>{fmtDate(ad.endDate)}</b>
          </div>
          <div>
            <span className="text-[var(--faint)]">{t("ads.thViews")}</span>
            <br />
            <b>{ad.views.toLocaleString()}</b>
          </div>
          <div>
            <span className="text-[var(--faint)]">{t("ads.thClicks")}</span>
            <br />
            <b>{ad.clicks.toLocaleString()}</b>
          </div>
        </div>
      )}
    </div>
  );
}

/** Read-only field grid shown under the summary in the View and Review dialogs. */
function AdDetailsCard({ ad }: { ad: AdRow }) {
  const { t, lang } = useAdminT();
  const fields: { label: string; value: string; wide?: boolean }[] = [
    { label: t("ads.fldName"), value: adDisplayName(ad, lang) },
    { label: t("ads.fldCategory"), value: ad.category || "—" },
    { label: t("ads.fldOwner"), value: ad.ownerName || "—" },
    { label: t("ads.fldMobile"), value: phoneText(ad.ownerMobile, ad.ownerMobileIso) || "—" },
    { label: t("ads.description"), value: ad.pitch || "—", wide: true },
    ...(ad.linkUrl ? [{ label: t("ads.fldLink"), value: ad.linkUrl, wide: true }] : []),
  ];
  return (
    <div className="overflow-hidden rounded-[14px] border border-[var(--line-admin)]">
      <div className="border-b border-[var(--line-admin)] bg-[var(--surface-admin)] px-3.5 py-2.5 text-[11px] font-extrabold tracking-wide text-[var(--faint)] uppercase">
        {t("ads.detailsHeading")}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3.5 text-[12px]">
        {fields.map((f) => (
          <div key={f.label} className={cn(f.wide && "col-span-2")}>
            <span className="text-[var(--faint)]">{f.label}</span>
            <br />
            <b className="break-words text-[var(--ink)]">{f.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Build category select options; keep orphan original text visible on edit. */
function categorySelectOptions(
  categories: CategoryOption[],
  current: string | null | undefined,
  placeholder: string,
): { value: string; label: string }[] {
  const opts = categories.map((c) => ({ value: c.value, label: c.label }));
  if (current && !opts.some((o) => o.value === current)) {
    opts.unshift({ value: current, label: current });
  }
  return [{ value: "", label: placeholder }, ...opts];
}

export function AdsClient({
  initialRows,
  categories,
  businesses = [],
}: {
  initialRows: AdRow[];
  categories: CategoryOption[];
  businesses?: BusinessOption[];
}) {
  const { t, lang } = useAdminT();
  const [rows, setRows] = useState<AdRow[]>(initialRows);
  const [tab, setTab] = useState<"all" | "premium" | "general">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<"all" | AdStatus>("all");
  const [source, setSource] = useState<"all" | "user" | "admin">("all");

  const [modal, setModal] = useState<Modal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      premium: rows.filter((r) => r.type === "premium").length,
      general: rows.filter((r) => r.type === "general").length,
    }),
    [rows],
  );

  const statusOptions = useMemo(
    () => STATUS_FILTER_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
    [t],
  );
  const sourceOptions = useMemo(
    () => SOURCE_FILTER_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
    [t],
  );
  const payOptions = useMemo(
    () => PAY_OPTS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
    [t],
  );

  /** Filter dropdown: master cats + any original free-text cats already on ads. */
  const filterCatOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.value, c.label);
    for (const r of rows) {
      if (r.category && !map.has(r.category)) map.set(r.category, r.category);
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [categories, rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    // `to` is inclusive — push to end of that day.
    const toTs = to ? new Date(to).getTime() + 86_400_000 - 1 : null;

    return rows.filter((r) => {
      if (tab !== "all" && r.type !== tab) return false;
      if (catFilter !== "all" && (r.category ?? "") !== catFilter) return false;
      if (status !== "all" && r.status !== status) return false;
      if (source !== "all" && r.source !== source) return false;

      if (fromTs !== null || toTs !== null) {
        const created = new Date(r.createdAt).getTime();
        if (fromTs !== null && created < fromTs) return false;
        if (toTs !== null && created > toTs) return false;
      }

      if (needle) {
        const hay = `${r.nameEn} ${r.nameGu} ${r.ownerName ?? ""} ${r.ownerMobile ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, tab, q, catFilter, from, to, status, source]);

  async function setStatusOf(id: string, next: AdStatus) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: next } : r)));
    const res = await api.patch("/api/admin/ads", { id, status: next });
    if (!res.ok) {
      setRows(prev);
      toast.error(res.error || t("ads.errStatus"));
      return;
    }
    toast.success(t(next === "ACTIVE" ? "ads.toastActivated" : "ads.toastDeactivated"));
  }

  async function approveReviewed() {
    if (!modal || modal.kind !== "review") return;
    setBusy(true);
    setError(null);
    const res = await api.patch("/api/admin/ads", { id: modal.ad.id, status: "ACTIVE" });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || t("ads.errApprove"));
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === modal.ad.id ? { ...r, status: "ACTIVE" } : r)));
    setModal(null);
    toast.success(t("ads.toastApproved"));
  }

  async function rejectReviewed() {
    if (!modal || modal.kind !== "review") return;
    const reason = modal.reason.trim();
    if (!reason) {
      setError(t("ads.errReasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await api.patch<AdRow>("/api/admin/ads", {
      id: modal.ad.id,
      status: "REJECTED",
      rejectReason: reason,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || t("ads.errReject"));
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === modal.ad.id ? { ...r, ...res.data } : r)));
    setModal(null);
    toast.success(t("ads.toastRejected"));
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: t("ads.confirmDelete"),
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    const res = await api.del(`/api/admin/ads?id=${id}`);
    if (!res.ok) {
      toast.error(res.error || t("ads.errDelete"));
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== id));
    toast.success(t("ads.toastDeleted"));
  }

  function validateDates(startDate: string, endDate: string): string | null {
    if (!startDate || !endDate) return t("ads.errDatesRequired");
    if (endDate < startDate) return t("ads.errEndBeforeStart");
    return null;
  }

  async function create() {
    if (!modal || modal.kind !== "create") return;
    const draft = modal.draft;

    if (draft.businessMode === "existing" && !draft.businessId) {
      setError(t("ads.errSelectBusiness"));
      return;
    }
    if (!draft.name.trim()) {
      setError(t("ads.errNameRequired"));
      return;
    }
    if (!draft.category.trim()) {
      setError(t("ads.errCategoryRequired"));
      return;
    }
    const dateErr = validateDates(draft.startDate, draft.endDate);
    if (dateErr) {
      setError(dateErr);
      return;
    }
    if (!isValidMobile(draft.ownerMobile, draft.ownerMobileIso)) {
      setError(t("ads.errMobile"));
      return;
    }

    setBusy(true);
    setError(null);

    const res = await api.post<{ id: string }>("/api/ads", {
      name: draft.name.trim(),
      pitch: draft.pitch || undefined,
      imageUrl: draft.imageUrl || undefined,
      linkUrl: draft.linkUrl || undefined,
      ownerName: draft.ownerName || undefined,
      ownerMobile: draft.ownerMobile || undefined,
      ownerMobileIso: draft.ownerMobileIso,
      category: draft.category || undefined,
      type: draft.type,
      source: "admin",
      startDate: new Date(draft.startDate).toISOString(),
      endDate: new Date(draft.endDate).toISOString(),
      priority: Number(draft.priority) || 0,
    });
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }

    // POST always lands as PENDING; apply the status the admin chose.
    await api.patch("/api/admin/ads", {
      id: res.data.id,
      status: draft.status,
      payStatus: draft.type === "premium" ? draft.payStatus : "notreq",
    });
    setBusy(false);
    setRows((prev) => [
      {
        id: res.data.id,
        name: draft.name.trim(),
        nameEn: draft.name.trim(),
        nameGu: draft.name.trim(),
        pitch: draft.pitch || null,
        imageUrl: draft.imageUrl || null,
        linkUrl: draft.linkUrl || null,
        ownerName: draft.ownerName || null,
        ownerMobile: draft.ownerMobile || null,
        ownerMobileIso: draft.ownerMobileIso,
        category: draft.category || null,
        rejectReason: null,
        type: draft.type,
        source: "admin",
        payStatus: draft.type === "premium" ? draft.payStatus : "notreq",
        paymentProof: null,
        status: draft.status,
        priority: Number(draft.priority) || 0,
        views: 0,
        clicks: 0,
        createdAt: new Date().toISOString(),
        startDate: new Date(draft.startDate).toISOString(),
        endDate: new Date(draft.endDate).toISOString(),
      },
      ...prev,
    ]);
    setModal(null);
    toast.success(t("ads.toastCreated"));
  }

  async function saveEdit() {
    if (!modal || modal.kind !== "edit") return;
    const { ad, form } = modal;

    if (!form.category.trim()) {
      setError(t("ads.errCategoryRequired"));
      return;
    }
    const dateErr = validateDates(form.startDate, form.endDate);
    if (dateErr) {
      setError(dateErr);
      return;
    }
    if (!isValidMobile(form.ownerMobile, form.ownerMobileIso)) {
      setError(t("ads.errMobile"));
      return;
    }

    setBusy(true);
    setError(null);
    const res = await api.patch("/api/admin/ads", {
      id: ad.id,
      name: form.name.trim() || ad.name,
      pitch: form.pitch || null,
      imageUrl: form.imageUrl || null,
      linkUrl: form.linkUrl || null,
      ownerName: form.ownerName || null,
      ownerMobile: form.ownerMobile || null,
      category: form.category,
      status: form.status,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      priority: Number(form.priority) || 0,
      payStatus: ad.type === "premium" ? form.payStatus : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || t("ads.errSave"));
      return;
    }

    setRows((rs) =>
      rs.map((r) =>
        r.id === ad.id
          ? {
              ...r,
              name: form.name.trim() || ad.name,
              nameEn: form.name.trim() || ad.nameEn,
              nameGu: form.name.trim() || ad.nameGu,
              pitch: form.pitch || null,
              imageUrl: form.imageUrl || null,
              linkUrl: form.linkUrl || null,
              ownerName: form.ownerName || null,
              ownerMobile: form.ownerMobile || null,
              category: form.category,
              status: form.status,
              startDate: new Date(form.startDate).toISOString(),
              endDate: new Date(form.endDate).toISOString(),
              priority: Number(form.priority) || 0,
              payStatus: ad.type === "premium" ? form.payStatus : r.payStatus,
            }
          : r,
      ),
    );
    setModal(null);
    toast.success(t("ads.toastUpdated"));
  }

  async function renewGo() {
    if (!modal || modal.kind !== "renew") return;
    const { ad, dur } = modal;
    const endDate = renewEndIso(ad.endDate, dur);
    setBusy(true);
    const res = await api.patch("/api/admin/ads", {
      id: ad.id,
      status: "ACTIVE",
      endDate,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || t("ads.errRenew"));
      return;
    }
    setRows((rs) =>
      rs.map((r) => (r.id === ad.id ? { ...r, status: "ACTIVE", endDate } : r)),
    );
    setModal(null);
    toast.success(t("ads.toastRenewed"));
  }

  function setDraft(updater: Draft | ((d: Draft) => Draft)) {
    setModal((m) => {
      if (!m || m.kind !== "create") return m;
      const next = typeof updater === "function" ? updater(m.draft) : updater;
      return { ...m, draft: next };
    });
  }

  function setEditForm(updater: EditForm | ((f: EditForm) => EditForm)) {
    setModal((m) => {
      if (!m || m.kind !== "edit") return m;
      const next = typeof updater === "function" ? updater(m.form) : updater;
      return { ...m, form: next };
    });
  }

  function setReviewReason(reason: string) {
    setModal((m) => (m && m.kind === "review" ? { ...m, reason } : m));
  }

  const draft = modal?.kind === "create" ? modal.draft : null;
  const renewPreview =
    modal?.kind === "renew" ? renewEndIso(modal.ad.endDate, modal.dur) : null;
  const canReject = modal?.kind === "review" && modal.reason.trim().length > 0;

  const modalTitle =
    modal?.kind === "create"
      ? modal.draft.step === "type"
        ? t("ads.newAd")
        : t(modal.draft.type === "premium" ? "ads.modalNewPremium" : "ads.modalNewGeneral")
      : modal?.kind === "view"
        ? t("ads.modalView")
        : modal?.kind === "review"
          ? t("ads.modalReview")
          : modal?.kind === "edit"
            ? t("ads.modalEdit")
            : modal?.kind === "renew"
              ? t("ads.modalRenew")
              : "";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <AdminH2
          className="mb-0"
          info={
            <>
              <p>{t("ads.infoLine1")}</p>
              <p className="mt-1.5">{t("ads.infoLine2")}</p>
            </>
          }
        >
          {t("nav.ads")}
        </AdminH2>
        <AdminBtn
          onClick={() => {
            setModal({ kind: "create", draft: emptyDraft() });
            setError(null);
          }}
        >
          <Plus className="size-4" />
          {t("ads.newAd")}
        </AdminBtn>
      </div>

      {/* Type tabs (left) · date range (middle, desktop-only) · search + filters (right) — one row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex w-full shrink-0 gap-1 overflow-x-auto rounded-xl bg-[var(--surface-admin)] p-1 md:w-auto">
          {(["all", "premium", "general"] as const).map((tb) => (
            <button
              key={tb}
              type="button"
              onClick={() => setTab(tb)}
              className={cn(
                "cursor-pointer rounded-lg px-4 py-2 text-[13px] font-bold whitespace-nowrap capitalize",
                tab === tb ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-dim)]",
              )}
            >
              {t(TAB_LABEL_KEYS[tb])} ({counts[tb]})
            </button>
          ))}
        </div>

        <div className="hidden flex-wrap items-center gap-2 text-[12px] font-bold text-[var(--muted)] md:flex">
          <span>{t("ads.from")}</span>
          <DateField variant="admin" value={from} onChange={setFrom} className="w-[148px]" />
          <span>{t("ads.to")}</span>
          <DateField variant="admin" value={to} onChange={setTo} min={from} className="w-[148px]" />
          {(from || to) && (
            <LinkAction
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              {t("ads.clearDates")}
            </LinkAction>
          )}
        </div>

        <div className="flex w-full items-center gap-2.5 md:w-auto">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={t("ads.searchPlaceholder")}
            className="min-w-0 flex-1 md:w-[210px] md:flex-none"
          />
          <FilterButton
            className="md:hidden"
            active={Boolean(from || to || catFilter !== "all" || status !== "all" || source !== "all")}
            onClick={() => setFiltersOpen(true)}
          />
          <div className="hidden items-center gap-2.5 md:flex">
            <AdminSelect
              value={catFilter}
              onChange={setCatFilter}
              ariaLabel={t("ads.filterByCategory")}
              className="w-[150px] shrink-0"
              options={[
                { value: "all", label: t("ads.allCategories") },
                ...filterCatOptions,
              ]}
            />
            <AdminSelect
              value={status}
              onChange={(v) => setStatus(v as "all" | AdStatus)}
              ariaLabel={t("ads.filterByStatus")}
              className="w-[140px] shrink-0"
              options={statusOptions}
            />
            <AdminSelect
              value={source}
              onChange={(v) => setSource(v as "all" | "user" | "admin")}
              ariaLabel={t("ads.filterBySource")}
              className="w-[140px] shrink-0"
              options={sourceOptions}
            />
          </div>
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>{t("ads.filters")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div>
              <AdminLabel>{t("ads.dateRange")}</AdminLabel>
              <div className="flex items-center gap-2">
                <DateField variant="admin" value={from} onChange={setFrom} className="min-w-0 flex-1" />
                <span className="text-[12px] font-bold text-[var(--muted)]">{t("ads.to")}</span>
                <DateField variant="admin" value={to} onChange={setTo} min={from} className="min-w-0 flex-1" />
              </div>
              {(from || to) && (
                <LinkAction
                  className="mt-1.5"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                >
                  {t("ads.clearDates")}
                </LinkAction>
              )}
            </div>
            <AdminSelect
              value={catFilter}
              onChange={setCatFilter}
              ariaLabel={t("ads.filterByCategory")}
              className="w-full"
              options={[
                { value: "all", label: t("ads.allCategories") },
                ...filterCatOptions,
              ]}
            />
            <AdminSelect
              value={status}
              onChange={(v) => setStatus(v as "all" | AdStatus)}
              ariaLabel={t("ads.filterByStatus")}
              className="w-full"
              options={statusOptions}
            />
            <AdminSelect
              value={source}
              onChange={(v) => setSource(v as "all" | "user" | "admin")}
              ariaLabel={t("ads.filterBySource")}
              className="w-full"
              options={sourceOptions}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>{t("ads.thPreview")}</AdminTh>
            <AdminTh>{t("ads.thBusiness")}</AdminTh>
            <AdminTh>{t("ads.thOwner")}</AdminTh>
            <AdminTh>{t("ads.thCategory")}</AdminTh>
            <AdminTh>{t("ads.thType")}</AdminTh>
            <AdminTh>{t("ads.thStatus")}</AdminTh>
            <AdminTh>{t("ads.thCreated")}</AdminTh>
            <AdminTh>{t("ads.thStart")}</AdminTh>
            <AdminTh>{t("ads.thEnd")}</AdminTh>
            <AdminTh>{t("ads.thViews")}</AdminTh>
            <AdminTh>{t("ads.thClicks")}</AdminTh>
            <AdminTh>{t("ads.thSource")}</AdminTh>
            <AdminTh className="text-right whitespace-nowrap">{t("ads.thActions")}</AdminTh>
          </tr>
        </thead>
        <tbody>
          {visible.map((a) => (
            <tr key={a.id}>
              <AdminTd>
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.imageUrl}
                    alt=""
                    className="h-9 w-[64px] rounded-lg border border-[var(--line)] object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-[64px] items-center justify-center rounded-lg bg-[var(--surface-admin)] text-[10px] font-bold text-[var(--faint)]">
                    {t("ads.noneImage")}
                  </span>
                )}
              </AdminTd>
              <AdminTd className="font-semibold whitespace-nowrap text-[var(--ink)]">{adDisplayName(a, lang)}</AdminTd>
              <AdminTd className="whitespace-nowrap">
                {a.ownerName || "—"}
                {a.ownerMobile && (
                  <span className="block text-[11px] text-[var(--faint)]">{a.ownerMobile}</span>
                )}
              </AdminTd>
              <AdminTd className="whitespace-nowrap">{a.category || "—"}</AdminTd>
              <AdminTd className="capitalize">
                {t(a.type === "premium" ? "ads.typePremium" : "ads.typeGeneral")}
              </AdminTd>
              <AdminTd>
                <StatusPill status={a.status} />
              </AdminTd>
              <AdminTd className="whitespace-nowrap">{fmtDate(a.createdAt)}</AdminTd>
              <AdminTd className="whitespace-nowrap">{fmtDate(a.startDate)}</AdminTd>
              <AdminTd className="whitespace-nowrap">{fmtDate(a.endDate)}</AdminTd>
              <AdminTd>{a.views.toLocaleString()}</AdminTd>
              <AdminTd>{a.clicks.toLocaleString()}</AdminTd>
              <AdminTd className="capitalize">
                {t(a.source === "user" ? "ads.srcUserApp" : "ads.srcAdmin")}
              </AdminTd>
              <AdminTd>
                {/* Buttons size to their own content — Approve/Reject, Activate,
                    Deactivate and the Rejected badge all share one spot (exactly
                    one applies per row); View/Delete stay constant on the right. */}
                <div className="flex flex-nowrap items-center justify-end gap-1.5">
                  {a.status !== "PENDING" && a.status !== "REJECTED" && (
                    <ActionBtn
                      icon={Pencil}
                      label={t("common.edit")}
                      onClick={() => {
                        setError(null);
                        setModal({ kind: "edit", ad: a, form: editFormFrom(a) });
                      }}
                    />
                  )}
                  {a.type === "premium" && (a.status === "ACTIVE" || a.status === "EXPIRED") && (
                    <ActionBtn
                      icon={RotateCw}
                      label={t("ads.renew")}
                      tone="success"
                      onClick={() => {
                        setError(null);
                        setModal({ kind: "renew", ad: a, dur: "1y" });
                      }}
                    />
                  )}
                  {a.status === "PENDING" ? (
                    <button
                      type="button"
                      title={t("ads.approveReject")}
                      aria-label={t("ads.approveReject")}
                      onClick={() => {
                        setError(null);
                        setModal({ kind: "review", ad: a, reason: "" });
                      }}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--line-admin)] bg-white px-2.5 py-[5px] text-[11.5px] font-bold whitespace-nowrap transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-admin)]"
                    >
                      <CheckCircle2 className="size-3.5 text-[var(--success)]" strokeWidth={2.3} />
                      <span className="text-[var(--success)]">{t("ads.approve")}</span>
                      <span className="text-[var(--ink-mid)]">/</span>
                      <span className="text-[var(--danger)]">{t("ads.reject")}</span>
                    </button>
                  ) : a.status === "ACTIVE" ? (
                    <ActionBtn
                      icon={PauseCircle}
                      label={t("ads.deactivate")}
                      tone="warn"
                      onClick={() => setStatusOf(a.id, "DEACTIVATED")}
                    />
                  ) : a.status === "REJECTED" ? (
                    <span className="flex cursor-default items-center gap-1.5 rounded-lg border border-[var(--danger-tint)] bg-[var(--danger-tint)] px-2.5 py-[5px] text-[11.5px] font-bold whitespace-nowrap text-[var(--danger)]">
                      <XCircle className="size-3.5" strokeWidth={2.3} />
                      {t("ads.stRejected")}
                    </span>
                  ) : (
                    <ActionBtn
                      icon={CheckCircle2}
                      label={t("ads.activate")}
                      tone="success"
                      onClick={() => setStatusOf(a.id, "ACTIVE")}
                    />
                  )}
                  <ActionBtn
                    icon={Eye}
                    label={t("common.view")}
                    onClick={() => {
                      setError(null);
                      setModal({ kind: "view", ad: a });
                    }}
                  />
                  <ActionBtn
                    icon={Trash2}
                    label={t("common.delete")}
                    tone="danger"
                    onClick={() => remove(a.id)}
                  />
                </div>
              </AdminTd>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <AdminTd colSpan={13} className="py-8 text-center text-[var(--faint)]">
                {rows.length === 0 ? t("ads.emptyNone") : t("ads.emptyFiltered")}
              </AdminTd>
            </tr>
          )}
        </tbody>
      </AdminTable>

      <AdminModal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modalTitle}
        subtitle={draft?.step === "type" ? t("ads.typeStepSubtitle") : undefined}
        width={draft?.step === "form" && draft.type === "premium" ? "xl" : "md"}
        icon={
          draft?.step === "form" ? (
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, step: "type" }))}
              aria-label={t("ads.changeType")}
              title={t("ads.changeType")}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--line-admin)] bg-white text-[var(--brand)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-tint)]"
            >
              <ChevronLeft className="size-[18px]" strokeWidth={2.4} />
            </button>
          ) : undefined
        }
        footer={
          draft?.step === "form" ? (
            <AdminModalActions
              onSave={create}
              onCancel={() => setModal(null)}
              saveLabel={t("ads.createSave")}
              busy={busy}
            />
          ) : modal?.kind === "edit" ? (
            <AdminModalActions
              onSave={saveEdit}
              onCancel={() => setModal(null)}
              saveLabel={t("ads.saveChanges")}
              busy={busy}
            />
          ) : modal?.kind === "renew" ? (
            <AdminModalActions
              onSave={renewGo}
              onCancel={() => setModal(null)}
              saveLabel={t("ads.modalRenew")}
              busy={busy}
            />
          ) : modal?.kind === "view" ? (
            <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setModal(null)}>
              {t("common.close")}
            </AdminBtn>
          ) : modal?.kind === "review" ? (
            <>
              <AdminBtn
                variant="success"
                className="flex-1 justify-center"
                onClick={approveReviewed}
                disabled={busy}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : t("ads.approve")}
              </AdminBtn>
              <WithTooltip label={t("ads.needReasonTooltip")} disabled={canReject}>
                <button
                  type="button"
                  onClick={() => {
                    if (canReject) void rejectReviewed();
                  }}
                  disabled={busy}
                  className={cn(
                    "inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-[var(--danger)] to-[#8A1F28] px-[18px] py-[11px] text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60",
                    !canReject && "cursor-not-allowed opacity-50",
                  )}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : t("ads.reject")}
                </button>
              </WithTooltip>
              <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setModal(null)}>
                {t("common.cancel")}
              </AdminBtn>
            </>
          ) : undefined
        }
      >
        {/* ── Create: type step ── */}
        {draft?.step === "type" && (
          <div className="flex flex-col gap-2.5">
            {(
              [
                {
                  t: "premium" as const,
                  title: t("ads.premiumTitle"),
                  desc: t("ads.premiumDesc"),
                },
                {
                  t: "general" as const,
                  title: t("ads.generalTitle"),
                  desc: t("ads.generalDesc"),
                },
              ]
            ).map((o) => (
              <button
                key={o.t}
                type="button"
                onClick={() => setDraft({ ...draft, step: "form", type: o.t })}
                className="cursor-pointer rounded-2xl border-[1.5px] border-[var(--line-admin)] bg-white p-4 text-left hover:border-[var(--brand)]"
              >
                <div className="text-[14px] font-extrabold text-[var(--ink)]">{o.title}</div>
                <div className="mt-0.5 text-[12.5px] text-[var(--faint)]">{o.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* ── Create: form step ── */}
        {draft?.step === "form" && (
          <>
            {/* Premium carries enough fields to split: business details on the
                left, banner + schedule on the right. General has too few, so it
                stays a single column. Both collapse to one below `lg`. */}
            <div className={cn("grid gap-x-6", draft.type === "premium" && "lg:grid-cols-2")}>
              <div className="min-w-0">
                <AdminFormSection title={t("ads.thBusiness")} />
                <AdminField>
              <AdminSegmented
                value={draft.businessMode}
                onChange={(v) => setDraft({ ...draft, businessMode: v })}
                options={[
                  { value: "existing", label: t("ads.existingBusiness") },
                  { value: "new", label: t("ads.createNew") },
                ]}
              />
            </AdminField>

            {draft.businessMode === "existing" ? (
              <AdminField label={t("ads.thBusiness")} required>
                <AdminSelect
                  value={draft.businessId}
                  onChange={(v) => {
                    const b = businesses.find((x) => x.id === v);
                    setDraft({
                      ...draft,
                      businessId: v,
                      name: b?.name ?? draft.name,
                      category: b?.category ?? draft.category,
                      ownerName: b?.ownerName ?? draft.ownerName,
                      ownerMobile: sanitizeMobile(b?.ownerMobile ?? draft.ownerMobile),
                    });
                  }}
                  className="w-full"
                  options={[
                    { value: "", label: t("ads.selectBusiness") },
                    ...businesses.map((b) => ({ value: b.id, label: b.label })),
                  ]}
                />
              </AdminField>
            ) : (
              <>
                <AdminField label={t("ads.adName")} required>
                  <AdminInput
                    gujarati
                    value={draft.name}
                    onChange={(v) => setDraft({ ...draft, name: v })}
                  />
                </AdminField>
                <AdminFormRow>
                  <AdminField label={t("ads.ownerName")}>
                    <AdminInput
                      gujarati
                      value={draft.ownerName}
                      onChange={(v) => setDraft({ ...draft, ownerName: v })}
                    />
                  </AdminField>
                  <AdminField label={t("ads.ownerMobile")} hint={t("ads.ownerMobileHint")}>
                    <PhoneField
                      variant="admin"
                      value={{ iso: draft.ownerMobileIso, digits: draft.ownerMobile }}
                      onChange={(v) =>
                        setDraft({ ...draft, ownerMobile: v.digits, ownerMobileIso: v.iso })
                      }
                      t={(gu, en) => (lang === "en" ? en : gu)}
                    />
                  </AdminField>
                </AdminFormRow>
              </>
            )}

            <AdminField label={t("ads.thCategory")} required>
              <AdminSelect
                value={draft.category}
                onChange={(v) => setDraft({ ...draft, category: v })}
                className="w-full"
                options={categorySelectOptions(categories, draft.category, t("ads.selectCategory"))}
              />
            </AdminField>

            <AdminField label={t("ads.description")} hint={t("ads.descriptionHint")}>
              <AdminInput
                gujarati
                multiline
                value={draft.pitch}
                placeholder={t("ads.descriptionPlaceholder")}
                onChange={(v) => setDraft({ ...draft, pitch: v })}
              />
            </AdminField>
              </div>

              <div className="min-w-0">
            {draft.type === "premium" && (
              <>
                <AdminField label={t("ads.bannerImage")}>
                  <AdminFilePicker
                    value={draft.imageUrl}
                    folder="ads"
                    hint={t("ads.bannerHint")}
                    onChange={(url) => setDraft((d) => ({ ...d, imageUrl: url }))}
                  />
                </AdminField>
                <AdminField label={t("ads.linkUrl")}>
                  <AdminInput
                    value={draft.linkUrl}
                    onChange={(v) => setDraft({ ...draft, linkUrl: v })}
                  />
                </AdminField>
                <AdminFormRow>
                  <AdminField label={t("ads.startDate")} required>
                    <DateField
                      variant="admin"
                      value={draft.startDate}
                      onChange={(v) => setDraft({ ...draft, startDate: v })}
                    />
                  </AdminField>
                  <AdminField label={t("ads.endDate")} required>
                    <DateField
                      variant="admin"
                      value={draft.endDate}
                      min={draft.startDate}
                      onChange={(v) => setDraft({ ...draft, endDate: v })}
                    />
                  </AdminField>
                </AdminFormRow>
                <AdminField label={t("ads.paymentStatus")}>
                  <AdminSelect
                    value={draft.payStatus}
                    onChange={(v) => setDraft({ ...draft, payStatus: v })}
                    className="w-full"
                    options={payOptions}
                  />
                </AdminField>
              </>
            )}

            {draft.type === "general" && (
              <AdminFormRow>
                <AdminField label={t("ads.startDate")} required>
                  <DateField
                    variant="admin"
                    value={draft.startDate}
                    onChange={(v) => setDraft({ ...draft, startDate: v })}
                  />
                </AdminField>
                <AdminField label={t("ads.endDate")} required>
                  <DateField
                    variant="admin"
                    value={draft.endDate}
                    min={draft.startDate}
                    onChange={(v) => setDraft({ ...draft, endDate: v })}
                  />
                </AdminField>
              </AdminFormRow>
            )}

            <AdminFormRow>
              <AdminField label={t("ads.thStatus")}>
                <AdminSelect
                  value={draft.status}
                  onChange={(v) => setDraft({ ...draft, status: v as AdStatus })}
                  className="w-full"
                  options={
                    draft.type === "premium"
                      ? [
                          { value: "ACTIVE", label: t("ads.stActive") },
                          { value: "PENDING", label: t("ads.stPending") },
                          { value: "DRAFT", label: t("ads.stDraft") },
                        ]
                      : [
                          { value: "ACTIVE", label: t("ads.stActive") },
                          { value: "DEACTIVATED", label: t("ads.stDeactivated") },
                        ]
                  }
                />
              </AdminField>
              <AdminField label={t("ads.priority")}>
                <AdminInput
                  type="number"
                  value={draft.priority}
                  onChange={(v) => setDraft({ ...draft, priority: v })}
                />
              </AdminField>
            </AdminFormRow>

            {error && (
              <p className="mt-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>
            )}
              </div>
            </div>
          </>
        )}

        {/* ── View ── */}
        {modal?.kind === "view" && (
          <>
            <AdSummaryCard ad={modal.ad} />
            <AdDetailsCard ad={modal.ad} />
            {modal.ad.status === "REJECTED" && modal.ad.rejectReason && (
              <div className="mt-3.5 rounded-[11px] border border-[var(--danger-tint)] bg-[var(--danger-tint)] px-3.5 py-2.5">
                <div className="text-[11px] font-extrabold tracking-wide text-[var(--danger)] uppercase">
                  {t("ads.rejectReason")}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink)]">
                  {modal.ad.rejectReason}
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Review (approve / reject a pending submission) ── */}
        {modal?.kind === "review" && (
          <>
            <AdSummaryCard ad={modal.ad} />
            <AdDetailsCard ad={modal.ad} />

            <AdminField
              label={t("ads.rejectReason")}
              required
              hint={t("ads.rejectReasonHint")}
              className="mt-3.5"
            >
              <Textarea
                value={modal.reason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder={t("ads.rejectReasonPlaceholder")}
                className="min-h-[70px] resize-none border-[var(--line-field)] bg-[var(--field)] text-[13px]"
              />
            </AdminField>

            {error && (
              <p className="mt-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>
            )}
          </>
        )}

        {/* ── Edit ── */}
        {modal?.kind === "edit" && (
          <>
            <AdSummaryCard ad={modal.ad} />

            {modal.ad.type === "premium" ? (
              <>
                <AdminField label={t("ads.bannerImage")}>
                  <AdminFilePicker
                    value={modal.form.imageUrl}
                    folder="ads"
                    hint={t("ads.bannerHint")}
                    onChange={(url) => setEditForm((f) => ({ ...f, imageUrl: url }))}
                  />
                </AdminField>
                <AdminFormRow>
                  <AdminField label={t("ads.startDate")} required>
                    <DateField
                      variant="admin"
                      value={modal.form.startDate}
                      onChange={(v) => setEditForm({ ...modal.form, startDate: v })}
                    />
                  </AdminField>
                  <AdminField label={t("ads.endDate")} required>
                    <DateField
                      variant="admin"
                      value={modal.form.endDate}
                      min={modal.form.startDate}
                      onChange={(v) => setEditForm({ ...modal.form, endDate: v })}
                    />
                  </AdminField>
                </AdminFormRow>
                <AdminField label={t("ads.paymentStatus")}>
                  <AdminSelect
                    value={modal.form.payStatus}
                    onChange={(v) => setEditForm({ ...modal.form, payStatus: v })}
                    className="w-full"
                    options={payOptions}
                  />
                </AdminField>
              </>
            ) : (
              <>
                <div className="mb-3.5 rounded-[11px] border border-[#CFE0EC] bg-[#E7F0FB] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#3D6B8C]">
                  {t("ads.generalEditNote")}
                </div>
                <AdminField label={t("ads.category")} required>
                  <AdminSelect
                    value={modal.form.category}
                    onChange={(v) => setEditForm({ ...modal.form, category: v })}
                    className="w-full"
                    options={categorySelectOptions(
                      categories,
                      modal.form.category,
                      t("ads.selectCategory"),
                    )}
                  />
                </AdminField>
              </>
            )}

            <AdminField label={t("ads.status")}>
              <AdminSelect
                value={modal.form.status}
                onChange={(v) => setEditForm({ ...modal.form, status: v as AdStatus })}
                className="w-full"
                options={
                  modal.ad.type === "premium"
                    ? [
                        { value: "ACTIVE", label: t("ads.stActive") },
                        { value: "PENDING", label: t("ads.stPending") },
                        { value: "DRAFT", label: t("ads.stDraft") },
                        { value: "DEACTIVATED", label: t("ads.stDeactivated") },
                        { value: "EXPIRED", label: t("ads.stExpired") },
                      ]
                    : [
                        { value: "ACTIVE", label: t("ads.stActive") },
                        { value: "DEACTIVATED", label: t("ads.stDeactivated") },
                      ]
                }
              />
            </AdminField>

            {error && (
              <p className="mt-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>
            )}
          </>
        )}

        {/* ── Renew ── */}
        {modal?.kind === "renew" && renewPreview && (
          <>
            <AdSummaryCard ad={modal.ad} />
            <div className="mb-3.5 flex justify-between text-[13px] text-[var(--ink)]">
              <span className="text-[var(--faint)]">{t("ads.currentExpiry")}</span>
              <b>{fmtDate(modal.ad.endDate)}</b>
            </div>
            <AdminField label={t("ads.renewDuration")}>
              <div className="flex gap-2.5">
                {(
                  [
                    { v: "6m" as const, label: t("ads.dur6m") },
                    { v: "1y" as const, label: t("ads.dur1y") },
                  ]
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setModal({ ...modal, dur: o.v })}
                    className={cn(
                      "flex-1 cursor-pointer rounded-[11px] border-[1.5px] px-3 py-2.5 text-[13px] font-bold",
                      modal.dur === o.v
                        ? "border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]"
                        : "border-[var(--line-field)] bg-[var(--field)] text-[var(--ink-dim)]",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </AdminField>
            <div className="mb-1 flex items-center justify-between rounded-[11px] border border-[#B7E6C6] bg-[#F0FBF3] px-3.5 py-3 text-[13px]">
              <span className="font-bold text-[#1E7A44]">{t("ads.newExpiryDate")}</span>
              <b className="text-[#1E7A44]">{fmtDate(renewPreview)}</b>
            </div>
          </>
        )}
      </AdminModal>
    </>
  );
}
