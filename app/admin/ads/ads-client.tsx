"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
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
  pitch: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  ownerName: string | null;
  ownerMobile: string | null;
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
  description: string;
  address: string;
};

/** Status pill palette — matches Admin.dc.html `stMeta`. */
const STATUS_META: Record<AdStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-[var(--gold-tint)] text-[var(--warn)]" },
  ACTIVE: { label: "Active", className: "bg-[var(--success-tint)] text-[var(--success)]" },
  EXPIRED: { label: "Expired", className: "bg-[var(--danger-tint)] text-[var(--danger)]" },
  REJECTED: { label: "Rejected", className: "bg-[var(--danger-tint)] text-[var(--danger)]" },
  DEACTIVATED: { label: "Deactivated", className: "bg-[var(--line-soft)] text-[var(--muted)]" },
  DRAFT: { label: "Draft", className: "bg-[#EEF1F6] text-[#4A5B72]" },
};

const STATUS_FILTER_OPTIONS: { value: "all" | AdStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "REJECTED", label: "Rejected" },
  { value: "DEACTIVATED", label: "Deactivated" },
  { value: "DRAFT", label: "Draft" },
];

const SOURCE_FILTER_OPTIONS: { value: "all" | "user" | "admin"; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "user", label: "User app" },
  { value: "admin", label: "Admin" },
];

const PAY_OPTS = [
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "manual", label: "Manual entry" },
  { value: "notreq", label: "Not required" },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

const toDateInput = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
};

/** Digits only, max 10 — Indian mobile UX. */
function sanitizeMobile(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function isValidMobile(mobile: string) {
  if (!mobile) return true; // optional
  return /^[6-9]\d{9}$/.test(mobile);
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
    category: "",
    type: "premium",
    status: "ACTIVE",
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    priority: "0",
    payStatus: "notreq",
  };
};

function editFormFrom(ad: AdRow): EditForm {
  return {
    name: ad.name,
    pitch: ad.pitch ?? "",
    imageUrl: ad.imageUrl ?? "",
    linkUrl: ad.linkUrl ?? "",
    ownerName: ad.ownerName ?? "",
    ownerMobile: ad.ownerMobile ?? "",
    category: ad.category ?? "",
    status: ad.status,
    startDate: toDateInput(ad.startDate),
    endDate: toDateInput(ad.endDate),
    priority: String(ad.priority),
    payStatus: ad.payStatus || "pending",
  };
}

function StatusPill({ status }: { status: AdStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold", meta.className)}>
      {meta.label}
    </span>
  );
}

function AdSummaryCard({ ad }: { ad: AdRow }) {
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
                no banner
              </span>
            )}
            <span className="text-[10px] font-bold text-[var(--faint)]">Banner</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <b className="text-[15px] text-[var(--ink)]">{ad.name}</b>
            <span className="rounded-full bg-[#EEF1F6] px-2 py-0.5 text-[10.5px] font-bold capitalize text-[#4A5B72]">
              {ad.type}
            </span>
            <span className="rounded-full bg-[var(--line-soft)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--muted)]">
              {ad.source === "user" ? "User" : "Admin"}
            </span>
          </div>
          <div className="text-[12px] text-[var(--ink-dim)]">
            {ad.ownerName || "—"} · {ad.category || "—"}
          </div>
          {ad.ownerMobile && (
            <div className="mt-0.5 text-[11.5px] text-[var(--faint)]">{ad.ownerMobile}</div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill status={ad.status} />
            {ad.type === "premium" && (
              <span className="inline-block rounded-full bg-[#EEF1F6] px-2 py-0.5 text-[10.5px] font-bold text-[#4A5B72]">
                Payment: {PAY_OPTS.find((p) => p.value === ad.payStatus)?.label ?? ad.payStatus}
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
                title="View payment screenshot"
                className="block h-14 w-[88px] overflow-hidden rounded-lg border border-[var(--line)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ad.paymentProof}
                  alt="Payment screenshot"
                  className="h-full w-full object-cover"
                />
              </a>
            ) : (
              <span className="flex h-14 w-[88px] items-center justify-center rounded-lg bg-white px-1 text-center text-[10px] font-bold text-[var(--faint)]">
                no proof
              </span>
            )}
            <span className="text-[10px] font-bold text-[var(--faint)]">Payment proof</span>
          </div>
        )}
      </div>
      {ad.type === "premium" && (
        <div className="mt-3 flex gap-5 border-t border-[var(--line-soft)] pt-3 text-[12px] text-[var(--ink)]">
          <div>
            <span className="text-[var(--faint)]">Start</span>
            <br />
            <b>{fmtDate(ad.startDate)}</b>
          </div>
          <div>
            <span className="text-[var(--faint)]">End</span>
            <br />
            <b>{fmtDate(ad.endDate)}</b>
          </div>
          <div>
            <span className="text-[var(--faint)]">Views</span>
            <br />
            <b>{ad.views.toLocaleString()}</b>
          </div>
          <div>
            <span className="text-[var(--faint)]">Clicks</span>
            <br />
            <b>{ad.clicks.toLocaleString()}</b>
          </div>
        </div>
      )}
    </div>
  );
}

/** Build category select options; keep orphan original text visible on edit. */
function categorySelectOptions(
  categories: CategoryOption[],
  current?: string | null,
): { value: string; label: string }[] {
  const opts = categories.map((c) => ({ value: c.value, label: c.label }));
  if (current && !opts.some((o) => o.value === current)) {
    opts.unshift({ value: current, label: current });
  }
  return [{ value: "", label: "— Select category —" }, ...opts];
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
        const hay = `${r.name} ${r.ownerName ?? ""} ${r.ownerMobile ?? ""}`.toLowerCase();
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
      toast.error(res.error || "Could not update status");
      return;
    }
    toast.success(`Advertisement ${STATUS_META[next].label.toLowerCase()}`);
  }

  async function approveReviewed() {
    if (!modal || modal.kind !== "review") return;
    setBusy(true);
    setError(null);
    const res = await api.patch("/api/admin/ads", { id: modal.ad.id, status: "ACTIVE" });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Could not approve");
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === modal.ad.id ? { ...r, status: "ACTIVE" } : r)));
    setModal(null);
    toast.success("Approved");
  }

  async function rejectReviewed() {
    if (!modal || modal.kind !== "review") return;
    const reason = modal.reason.trim();
    if (!reason) {
      setError("Reject reason is required");
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
      setError(res.error || "Could not reject");
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === modal.ad.id ? { ...r, ...res.data } : r)));
    setModal(null);
    toast.success("Rejected");
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: "Delete this advertisement?",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await api.del(`/api/admin/ads?id=${id}`);
    if (!res.ok) {
      toast.error(res.error || "Could not delete");
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== id));
    toast.success("Advertisement deleted");
  }

  function validateDates(startDate: string, endDate: string): string | null {
    if (!startDate || !endDate) return "Start and end dates are required";
    if (endDate < startDate) return "End date must be on or after the start date";
    return null;
  }

  async function create() {
    if (!modal || modal.kind !== "create") return;
    const draft = modal.draft;

    if (draft.businessMode === "existing" && !draft.businessId) {
      setError("Select a business");
      return;
    }
    if (!draft.name.trim()) {
      setError("Business / ad name is required");
      return;
    }
    if (!draft.category.trim()) {
      setError("Category is required");
      return;
    }
    const dateErr = validateDates(draft.startDate, draft.endDate);
    if (dateErr) {
      setError(dateErr);
      return;
    }
    if (!isValidMobile(draft.ownerMobile)) {
      setError("Owner mobile must be a 10-digit number starting with 6–9");
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
        pitch: draft.pitch || null,
        imageUrl: draft.imageUrl || null,
        linkUrl: draft.linkUrl || null,
        ownerName: draft.ownerName || null,
        ownerMobile: draft.ownerMobile || null,
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
    toast.success("Advertisement created");
  }

  async function saveEdit() {
    if (!modal || modal.kind !== "edit") return;
    const { ad, form } = modal;

    if (!form.category.trim()) {
      setError("Category is required");
      return;
    }
    const dateErr = validateDates(form.startDate, form.endDate);
    if (dateErr) {
      setError(dateErr);
      return;
    }
    if (!isValidMobile(form.ownerMobile)) {
      setError("Owner mobile must be a 10-digit number starting with 6–9");
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
      setError(res.error || "Could not save");
      return;
    }

    setRows((rs) =>
      rs.map((r) =>
        r.id === ad.id
          ? {
              ...r,
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
              payStatus: ad.type === "premium" ? form.payStatus : r.payStatus,
            }
          : r,
      ),
    );
    setModal(null);
    toast.success("Advertisement updated");
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
      toast.error(res.error || "Could not renew");
      return;
    }
    setRows((rs) =>
      rs.map((r) => (r.id === ad.id ? { ...r, status: "ACTIVE", endDate } : r)),
    );
    setModal(null);
    toast.success("Advertisement renewed");
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
        ? "New advertisement"
        : `New ${modal.draft.type} advertisement`
      : modal?.kind === "view"
        ? "View advertisement"
        : modal?.kind === "review"
          ? "Review submission"
          : modal?.kind === "edit"
            ? "Edit advertisement"
            : modal?.kind === "renew"
              ? "Renew advertisement"
              : "";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <AdminH2
          className="mb-0"
          info={
            <>
              <p>
                General ads are auto-created when a business is approved (or added here) · Premium ads are
                paid banner requests.
              </p>
              <p className="mt-1.5">
                Auto-expiry on end date · renew = extend date · views/clicks help renewal conversations.
              </p>
            </>
          }
        >
          Advertisements
        </AdminH2>
        <AdminBtn
          onClick={() => {
            setModal({ kind: "create", draft: emptyDraft() });
            setError(null);
          }}
        >
          <Plus className="size-4" />
          New advertisement
        </AdminBtn>
      </div>

      {/* Type tabs (left) · date range (middle, desktop-only) · search + filters (right) — one row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex w-full shrink-0 gap-1 overflow-x-auto rounded-xl bg-[var(--surface-admin)] p-1 md:w-auto">
          {(["all", "premium", "general"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "cursor-pointer rounded-lg px-4 py-2 text-[13px] font-bold whitespace-nowrap capitalize",
                tab === t ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-dim)]",
              )}
            >
              {t} ({counts[t]})
            </button>
          ))}
        </div>

        <div className="hidden flex-wrap items-center gap-2 text-[12px] font-bold text-[var(--muted)] md:flex">
          <span>From</span>
          <DateField variant="admin" value={from} onChange={setFrom} className="w-[148px]" />
          <span>To</span>
          <DateField variant="admin" value={to} onChange={setTo} min={from} className="w-[148px]" />
          {(from || to) && (
            <LinkAction
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              clear dates
            </LinkAction>
          )}
        </div>

        <div className="flex w-full items-center gap-2.5 md:w-auto">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search business, owner or mobile…"
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
              ariaLabel="Filter by category"
              className="w-[150px] shrink-0"
              options={[
                { value: "all", label: "All categories" },
                ...filterCatOptions,
              ]}
            />
            <AdminSelect
              value={status}
              onChange={(v) => setStatus(v as "all" | AdStatus)}
              ariaLabel="Filter by status"
              className="w-[140px] shrink-0"
              options={STATUS_FILTER_OPTIONS}
            />
            <AdminSelect
              value={source}
              onChange={(v) => setSource(v as "all" | "user" | "admin")}
              ariaLabel="Filter by created by"
              className="w-[140px] shrink-0"
              options={SOURCE_FILTER_OPTIONS}
            />
          </div>
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div>
              <AdminLabel>Date range</AdminLabel>
              <div className="flex items-center gap-2">
                <DateField variant="admin" value={from} onChange={setFrom} className="min-w-0 flex-1" />
                <span className="text-[12px] font-bold text-[var(--muted)]">to</span>
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
                  clear dates
                </LinkAction>
              )}
            </div>
            <AdminSelect
              value={catFilter}
              onChange={setCatFilter}
              ariaLabel="Filter by category"
              className="w-full"
              options={[
                { value: "all", label: "All categories" },
                ...filterCatOptions,
              ]}
            />
            <AdminSelect
              value={status}
              onChange={(v) => setStatus(v as "all" | AdStatus)}
              ariaLabel="Filter by status"
              className="w-full"
              options={STATUS_FILTER_OPTIONS}
            />
            <AdminSelect
              value={source}
              onChange={(v) => setSource(v as "all" | "user" | "admin")}
              ariaLabel="Filter by created by"
              className="w-full"
              options={SOURCE_FILTER_OPTIONS}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Preview</AdminTh>
            <AdminTh>Business</AdminTh>
            <AdminTh>Owner</AdminTh>
            <AdminTh>Category</AdminTh>
            <AdminTh>Type</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh>Created</AdminTh>
            <AdminTh>Start</AdminTh>
            <AdminTh>End</AdminTh>
            <AdminTh>Views</AdminTh>
            <AdminTh>Clicks</AdminTh>
            <AdminTh>Source</AdminTh>
            <AdminTh className="text-right whitespace-nowrap">Actions</AdminTh>
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
                    none
                  </span>
                )}
              </AdminTd>
              <AdminTd className="font-semibold whitespace-nowrap text-[var(--ink)]">{a.name}</AdminTd>
              <AdminTd className="whitespace-nowrap">
                {a.ownerName || "—"}
                {a.ownerMobile && (
                  <span className="block text-[11px] text-[var(--faint)]">{a.ownerMobile}</span>
                )}
              </AdminTd>
              <AdminTd className="whitespace-nowrap">{a.category || "—"}</AdminTd>
              <AdminTd className="capitalize">{a.type}</AdminTd>
              <AdminTd>
                <StatusPill status={a.status} />
              </AdminTd>
              <AdminTd className="whitespace-nowrap">{fmtDate(a.createdAt)}</AdminTd>
              <AdminTd className="whitespace-nowrap">{fmtDate(a.startDate)}</AdminTd>
              <AdminTd className="whitespace-nowrap">{fmtDate(a.endDate)}</AdminTd>
              <AdminTd>{a.views.toLocaleString()}</AdminTd>
              <AdminTd>{a.clicks.toLocaleString()}</AdminTd>
              <AdminTd className="capitalize">{a.source === "user" ? "User app" : "Admin"}</AdminTd>
              <AdminTd>
                {/* Buttons size to their own content — Approve/Reject, Activate,
                    Deactivate and the Rejected badge all share one spot (exactly
                    one applies per row); View/Delete stay constant on the right. */}
                <div className="flex flex-nowrap items-center justify-end gap-1.5">
                  {a.status !== "PENDING" && a.status !== "REJECTED" && (
                    <ActionBtn
                      icon={Pencil}
                      label="Edit"
                      onClick={() => {
                        setError(null);
                        setModal({ kind: "edit", ad: a, form: editFormFrom(a) });
                      }}
                    />
                  )}
                  {a.type === "premium" && (a.status === "ACTIVE" || a.status === "EXPIRED") && (
                    <ActionBtn
                      icon={RotateCw}
                      label="Renew"
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
                      title="Approve/Reject"
                      aria-label="Approve/Reject"
                      onClick={() => {
                        setError(null);
                        setModal({ kind: "review", ad: a, reason: "" });
                      }}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--line-admin)] bg-white px-2.5 py-[5px] text-[11.5px] font-bold whitespace-nowrap transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-admin)]"
                    >
                      <CheckCircle2 className="size-3.5 text-[var(--success)]" strokeWidth={2.3} />
                      <span className="text-[var(--success)]">Approve</span>
                      <span className="text-[var(--ink-mid)]">/</span>
                      <span className="text-[var(--danger)]">Reject</span>
                    </button>
                  ) : a.status === "ACTIVE" ? (
                    <ActionBtn
                      icon={PauseCircle}
                      label="Deactivate"
                      tone="warn"
                      onClick={() => setStatusOf(a.id, "DEACTIVATED")}
                    />
                  ) : a.status === "REJECTED" ? (
                    <span className="flex cursor-default items-center gap-1.5 rounded-lg border border-[var(--danger-tint)] bg-[var(--danger-tint)] px-2.5 py-[5px] text-[11.5px] font-bold whitespace-nowrap text-[var(--danger)]">
                      <XCircle className="size-3.5" strokeWidth={2.3} />
                      Rejected
                    </span>
                  ) : (
                    <ActionBtn
                      icon={CheckCircle2}
                      label="Activate"
                      tone="success"
                      onClick={() => setStatusOf(a.id, "ACTIVE")}
                    />
                  )}
                  <ActionBtn
                    icon={Eye}
                    label="View"
                    onClick={() => {
                      setError(null);
                      setModal({ kind: "view", ad: a });
                    }}
                  />
                  <ActionBtn icon={Trash2} label="Delete" tone="danger" onClick={() => remove(a.id)} />
                </div>
              </AdminTd>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <AdminTd colSpan={13} className="py-8 text-center text-[var(--faint)]">
                {rows.length === 0
                  ? "No advertisements yet."
                  : "No advertisement matches these filters."}
              </AdminTd>
            </tr>
          )}
        </tbody>
      </AdminTable>

      <AdminModal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modalTitle}
        subtitle={
          draft?.step === "type" ? "Which kind of advertisement is this?" : undefined
        }
        footer={
          draft?.step === "form" ? (
            <AdminModalActions
              onSave={create}
              onCancel={() => setModal(null)}
              saveLabel="Create advertisement"
              busy={busy}
            />
          ) : modal?.kind === "edit" ? (
            <AdminModalActions
              onSave={saveEdit}
              onCancel={() => setModal(null)}
              saveLabel="Save changes"
              busy={busy}
            />
          ) : modal?.kind === "renew" ? (
            <AdminModalActions
              onSave={renewGo}
              onCancel={() => setModal(null)}
              saveLabel="Renew advertisement"
              busy={busy}
            />
          ) : modal?.kind === "view" ? (
            <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setModal(null)}>
              Close
            </AdminBtn>
          ) : modal?.kind === "review" ? (
            <>
              <AdminBtn
                variant="success"
                className="flex-1 justify-center"
                onClick={approveReviewed}
                disabled={busy}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Approve"}
              </AdminBtn>
              <WithTooltip label="Add a reason to reject" disabled={canReject}>
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
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Reject"}
                </button>
              </WithTooltip>
              <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setModal(null)}>
                Cancel
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
                  title: "Premium advertisement",
                  desc: "Paid banner shown in the app's home carousel.",
                },
                {
                  t: "general" as const,
                  title: "General advertisement",
                  desc: "Free listing linked to an approved business.",
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
            <button
              type="button"
              onClick={() => setDraft({ ...draft, step: "type" })}
              className="mb-3 cursor-pointer text-[12.5px] font-bold text-[var(--brand)]"
            >
              ‹ Change type
            </button>

            <AdminFormSection title="Business" />
            <AdminField>
              <AdminSegmented
                value={draft.businessMode}
                onChange={(v) => setDraft({ ...draft, businessMode: v })}
                options={[
                  { value: "existing", label: "Existing business" },
                  { value: "new", label: "Create new" },
                ]}
              />
            </AdminField>

            {draft.businessMode === "existing" ? (
              <AdminField label="Business" required>
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
                    { value: "", label: "— Select business —" },
                    ...businesses.map((b) => ({ value: b.id, label: b.label })),
                  ]}
                />
              </AdminField>
            ) : (
              <>
                <AdminField label="Business / ad name" required>
                  <AdminInput
                    value={draft.name}
                    onChange={(v) => setDraft({ ...draft, name: v })}
                  />
                </AdminField>
                <AdminFormRow>
                  <AdminField label="Owner name">
                    <AdminInput
                      value={draft.ownerName}
                      onChange={(v) => setDraft({ ...draft, ownerName: v })}
                    />
                  </AdminField>
                  <AdminField label="Owner mobile" hint="10-digit mobile · numbers only">
                    <AdminInput
                      type="tel"
                      value={draft.ownerMobile}
                      placeholder="98XXXXXXXX"
                      onChange={(v) =>
                        setDraft({ ...draft, ownerMobile: sanitizeMobile(v) })
                      }
                    />
                  </AdminField>
                </AdminFormRow>
              </>
            )}

            <AdminField label="Category" required>
              <AdminSelect
                value={draft.category}
                onChange={(v) => setDraft({ ...draft, category: v })}
                className="w-full"
                options={categorySelectOptions(categories, draft.category)}
              />
            </AdminField>

            <AdminField label="Description">
              <AdminInput
                value={draft.pitch}
                placeholder="Short description…"
                onChange={(v) => setDraft({ ...draft, pitch: v })}
              />
            </AdminField>

            {draft.type === "premium" && (
              <>
                <AdminField label="Banner image">
                  <AdminFilePicker
                    value={draft.imageUrl}
                    folder="ads"
                    hint="1200 × 600 px (2:1) recommended"
                    onChange={(url) => setDraft((d) => ({ ...d, imageUrl: url }))}
                  />
                </AdminField>
                <AdminField label="Link URL">
                  <AdminInput
                    value={draft.linkUrl}
                    onChange={(v) => setDraft({ ...draft, linkUrl: v })}
                  />
                </AdminField>
                <AdminFormRow>
                  <AdminField label="Start date" required>
                    <DateField
                      variant="admin"
                      value={draft.startDate}
                      onChange={(v) => setDraft({ ...draft, startDate: v })}
                    />
                  </AdminField>
                  <AdminField label="End date" required>
                    <DateField
                      variant="admin"
                      value={draft.endDate}
                      min={draft.startDate}
                      onChange={(v) => setDraft({ ...draft, endDate: v })}
                    />
                  </AdminField>
                </AdminFormRow>
                <AdminField label="Payment status">
                  <AdminSelect
                    value={draft.payStatus}
                    onChange={(v) => setDraft({ ...draft, payStatus: v })}
                    className="w-full"
                    options={PAY_OPTS}
                  />
                </AdminField>
              </>
            )}

            {draft.type === "general" && (
              <AdminFormRow>
                <AdminField label="Start date" required>
                  <DateField
                    variant="admin"
                    value={draft.startDate}
                    onChange={(v) => setDraft({ ...draft, startDate: v })}
                  />
                </AdminField>
                <AdminField label="End date" required>
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
              <AdminField label="Status">
                <AdminSelect
                  value={draft.status}
                  onChange={(v) => setDraft({ ...draft, status: v as AdStatus })}
                  className="w-full"
                  options={
                    draft.type === "premium"
                      ? [
                          { value: "ACTIVE", label: "Active" },
                          { value: "PENDING", label: "Pending" },
                          { value: "DRAFT", label: "Draft" },
                        ]
                      : [
                          { value: "ACTIVE", label: "Active" },
                          { value: "DEACTIVATED", label: "Deactivated" },
                        ]
                  }
                />
              </AdminField>
              <AdminField label="Priority">
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
          </>
        )}

        {/* ── View ── */}
        {modal?.kind === "view" && (
          <>
            <AdSummaryCard ad={modal.ad} />
            <div className="rounded-[14px] border border-[var(--line-admin)] overflow-hidden">
              <div className="border-b border-[var(--line-admin)] bg-[var(--surface-admin)] px-3.5 py-2.5 text-[11px] font-extrabold tracking-wide text-[var(--faint)] uppercase">
                Advertisement details
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3.5 text-[12px]">
                <div>
                  <span className="text-[var(--faint)]">Name</span>
                  <br />
                  <b className="text-[var(--ink)]">{modal.ad.name}</b>
                </div>
                <div>
                  <span className="text-[var(--faint)]">Category</span>
                  <br />
                  <b className="text-[var(--ink)]">{modal.ad.category || "—"}</b>
                </div>
                <div>
                  <span className="text-[var(--faint)]">Owner</span>
                  <br />
                  <b className="text-[var(--ink)]">{modal.ad.ownerName || "—"}</b>
                </div>
                <div>
                  <span className="text-[var(--faint)]">Mobile</span>
                  <br />
                  <b className="text-[var(--ink)]">{modal.ad.ownerMobile || "—"}</b>
                </div>
                <div className="col-span-2">
                  <span className="text-[var(--faint)]">Description</span>
                  <br />
                  <span className="text-[var(--ink-soft)]">{modal.ad.pitch || "—"}</span>
                </div>
                {modal.ad.linkUrl && (
                  <div className="col-span-2">
                    <span className="text-[var(--faint)]">Link</span>
                    <br />
                    <b className="break-all text-[var(--ink)]">{modal.ad.linkUrl}</b>
                  </div>
                )}
              </div>
            </div>
            {modal.ad.status === "REJECTED" && modal.ad.rejectReason && (
              <div className="mt-3.5 rounded-[11px] border border-[var(--danger-tint)] bg-[var(--danger-tint)] px-3.5 py-2.5">
                <div className="text-[11px] font-extrabold tracking-wide text-[var(--danger)] uppercase">
                  Reject reason
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
            <div className="rounded-[14px] border border-[var(--line-admin)] overflow-hidden">
              <div className="border-b border-[var(--line-admin)] bg-[var(--surface-admin)] px-3.5 py-2.5 text-[11px] font-extrabold tracking-wide text-[var(--faint)] uppercase">
                Advertisement details
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3.5 text-[12px]">
                <div>
                  <span className="text-[var(--faint)]">Name</span>
                  <br />
                  <b className="text-[var(--ink)]">{modal.ad.name}</b>
                </div>
                <div>
                  <span className="text-[var(--faint)]">Category</span>
                  <br />
                  <b className="text-[var(--ink)]">{modal.ad.category || "—"}</b>
                </div>
                <div>
                  <span className="text-[var(--faint)]">Owner</span>
                  <br />
                  <b className="text-[var(--ink)]">{modal.ad.ownerName || "—"}</b>
                </div>
                <div>
                  <span className="text-[var(--faint)]">Mobile</span>
                  <br />
                  <b className="text-[var(--ink)]">{modal.ad.ownerMobile || "—"}</b>
                </div>
                <div className="col-span-2">
                  <span className="text-[var(--faint)]">Description</span>
                  <br />
                  <span className="text-[var(--ink-soft)]">{modal.ad.pitch || "—"}</span>
                </div>
                {modal.ad.linkUrl && (
                  <div className="col-span-2">
                    <span className="text-[var(--faint)]">Link</span>
                    <br />
                    <b className="break-all text-[var(--ink)]">{modal.ad.linkUrl}</b>
                  </div>
                )}
              </div>
            </div>

            <AdminField
              label="Reject reason"
              required
              hint="Required to reject — the submitter sees this reason."
              className="mt-3.5"
            >
              <Textarea
                value={modal.reason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder="Why is this being rejected…"
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
                <AdminField label="Banner image">
                  <AdminFilePicker
                    value={modal.form.imageUrl}
                    folder="ads"
                    hint="1200 × 600 px (2:1) recommended"
                    onChange={(url) => setEditForm((f) => ({ ...f, imageUrl: url }))}
                  />
                </AdminField>
                <AdminFormRow>
                  <AdminField label="Start date" required>
                    <DateField
                      variant="admin"
                      value={modal.form.startDate}
                      onChange={(v) => setEditForm({ ...modal.form, startDate: v })}
                    />
                  </AdminField>
                  <AdminField label="End date" required>
                    <DateField
                      variant="admin"
                      value={modal.form.endDate}
                      min={modal.form.startDate}
                      onChange={(v) => setEditForm({ ...modal.form, endDate: v })}
                    />
                  </AdminField>
                </AdminFormRow>
                <AdminField label="Payment status">
                  <AdminSelect
                    value={modal.form.payStatus}
                    onChange={(v) => setEditForm({ ...modal.form, payStatus: v })}
                    className="w-full"
                    options={PAY_OPTS}
                  />
                </AdminField>
              </>
            ) : (
              <>
                <div className="mb-3.5 rounded-[11px] border border-[#CFE0EC] bg-[#E7F0FB] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#3D6B8C]">
                  General ads pull their info from the Business module. Edit category &amp; status
                  here; other details are managed under Families / Business.
                </div>
                <AdminField label="Category" required>
                  <AdminSelect
                    value={modal.form.category}
                    onChange={(v) => setEditForm({ ...modal.form, category: v })}
                    className="w-full"
                    options={categorySelectOptions(categories, modal.form.category)}
                  />
                </AdminField>
              </>
            )}

            <AdminField label="Status">
              <AdminSelect
                value={modal.form.status}
                onChange={(v) => setEditForm({ ...modal.form, status: v as AdStatus })}
                className="w-full"
                options={
                  modal.ad.type === "premium"
                    ? [
                        { value: "ACTIVE", label: "Active" },
                        { value: "PENDING", label: "Pending" },
                        { value: "DRAFT", label: "Draft" },
                        { value: "DEACTIVATED", label: "Deactivated" },
                        { value: "EXPIRED", label: "Expired" },
                      ]
                    : [
                        { value: "ACTIVE", label: "Active" },
                        { value: "DEACTIVATED", label: "Deactivated" },
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
              <span className="text-[var(--faint)]">Current expiry</span>
              <b>{fmtDate(modal.ad.endDate)}</b>
            </div>
            <AdminField label="Renew duration">
              <div className="flex gap-2.5">
                {(
                  [
                    { v: "6m" as const, label: "6 Months" },
                    { v: "1y" as const, label: "1 Year" },
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
              <span className="font-bold text-[#1E7A44]">New expiry date</span>
              <b className="text-[#1E7A44]">{fmtDate(renewPreview)}</b>
            </div>
          </>
        )}
      </AdminModal>
    </>
  );
}
