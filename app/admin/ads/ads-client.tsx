"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AdminBtn,
  AdminH2,
  AdminHint,
  AdminInput,
  AdminSelect,
  AdminTable,
  AdminTd,
  AdminTh,
  FilterChip,
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
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/admin/confirm-dialog";

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
  imageUrl: string | null;
  ownerName: string | null;
  ownerMobile: string | null;
  category: string | null;
  type: "premium" | "general";
  source: "user" | "admin";
  status: AdStatus;
  priority: number;
  views: number;
  clicks: number;
  createdAt: string;
  startDate: string;
  endDate: string;
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

const STATUS_CHIPS: { value: "all" | AdStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "REJECTED", label: "Rejected" },
  { value: "DEACTIVATED", label: "Deactivated" },
  { value: "DRAFT", label: "Draft" },
];

const SOURCE_CHIPS: { value: "all" | "user" | "admin"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "user", label: "User app" },
  { value: "admin", label: "Admin" },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

export type BusinessOption = {
  id: string;
  name: string;
  category: string;
  ownerName: string;
  ownerMobile: string;
};

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
};

const emptyDraft: Draft = {
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
  startDate: "",
  endDate: "",
  priority: "0",
};

function StatusPill({ status }: { status: AdStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold", meta.className)}>
      {meta.label}
    </span>
  );
}

export function AdsClient({
  initialRows,
  categories,
  businesses = [],
}: {
  initialRows: AdRow[];
  categories: string[];
  businesses?: BusinessOption[];
}) {
  const [rows, setRows] = useState<AdRow[]>(initialRows);
  const [tab, setTab] = useState<"all" | "premium" | "general">("all");
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<"all" | AdStatus>("all");
  const [source, setSource] = useState<"all" | "user" | "admin">("all");

  const [draft, setDraft] = useState<Draft | null>(null);
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

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    // `to` is inclusive — push to end of that day.
    const toTs = to ? new Date(to).getTime() + 86_400_000 - 1 : null;

    return rows.filter((r) => {
      if (tab !== "all" && r.type !== tab) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
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
  }, [rows, tab, q, typeFilter, catFilter, from, to, status, source]);

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

  async function create() {
    if (!draft) return;
    if (!draft.name.trim() || !draft.startDate || !draft.endDate) {
      setError("Name, start and end dates are required");
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
    await api.patch("/api/admin/ads", { id: res.data.id, status: draft.status });
    setBusy(false);
    setRows((prev) => [
      {
        id: res.data.id,
        name: draft.name.trim(),
        imageUrl: draft.imageUrl || null,
        ownerName: draft.ownerName || null,
        ownerMobile: draft.ownerMobile || null,
        category: draft.category || null,
        type: draft.type,
        source: "admin",
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
    setDraft(null);
    toast.success("Advertisement created");
  }

  return (
    <>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <AdminH2 className="mb-0">Advertisements</AdminH2>
        <AdminBtn
          onClick={() => {
            setDraft({ ...emptyDraft });
            setError(null);
          }}
        >
          <Plus className="size-4" />
          New advertisement
        </AdminBtn>
      </div>

      <AdminHint className="mt-0 mb-4 max-w-3xl text-[12.5px]">
        General ads are auto-created when a business is approved (or added here) · Premium ads are
        paid banner requests.
      </AdminHint>

      {/* type tabs */}
      <div className="mb-4 inline-flex gap-1 rounded-xl bg-[var(--surface-admin)] p-1">
        {(["all", "premium", "general"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "cursor-pointer rounded-lg px-4 py-2 text-[13px] font-bold capitalize",
              tab === t ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-dim)]",
            )}
          >
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search business, owner or mobile…"
          className="min-w-[260px] flex-1"
        />
        <AdminSelect
          value={typeFilter}
          onChange={setTypeFilter}
          ariaLabel="Filter by type"
          options={[
            { value: "all", label: "All types" },
            { value: "premium", label: "Premium" },
            { value: "general", label: "General" },
          ]}
        />
        <AdminSelect
          value={catFilter}
          onChange={setCatFilter}
          ariaLabel="Filter by category"
          options={[
            { value: "all", label: "All categories" },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2.5 text-[12px] font-bold text-[var(--muted)]">
        <span>From</span>
        <AdminInput type="date" value={from} onChange={setFrom} className="w-[168px]" />
        <span>To</span>
        <AdminInput type="date" value={to} onChange={setTo} className="w-[168px]" />
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

      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-bold tracking-wide text-[var(--faint)] uppercase">
          Status
        </span>
        {STATUS_CHIPS.map((c) => (
          <FilterChip
            key={c.value}
            label={c.label}
            active={status === c.value}
            onClick={() => setStatus(c.value)}
          />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-bold tracking-wide text-[var(--faint)] uppercase">
          Created by
        </span>
        {SOURCE_CHIPS.map((c) => (
          <FilterChip
            key={c.value}
            label={c.label}
            active={source === c.value}
            onClick={() => setSource(c.value)}
          />
        ))}
      </div>

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
            <AdminTh className="text-right">Actions</AdminTh>
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
              <AdminTd className="font-semibold text-[var(--ink)] whitespace-nowrap">{a.name}</AdminTd>
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
              <AdminTd className="text-right">
                <span className="flex flex-wrap justify-end gap-2">
                  {a.status !== "ACTIVE" && (
                    <LinkAction onClick={() => setStatusOf(a.id, "ACTIVE")}>Activate</LinkAction>
                  )}
                  {a.status === "ACTIVE" && (
                    <LinkAction onClick={() => setStatusOf(a.id, "DEACTIVATED")}>
                      Deactivate
                    </LinkAction>
                  )}
                  {a.status === "PENDING" && (
                    <LinkAction danger onClick={() => setStatusOf(a.id, "REJECTED")}>
                      Reject
                    </LinkAction>
                  )}
                  <LinkAction danger onClick={() => remove(a.id)}>
                    Delete
                  </LinkAction>
                </span>
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

      <AdminHint>
        Auto-expiry on end date · renew = extend date · views/clicks help renewal conversations.
      </AdminHint>

      <AdminModal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={
          draft?.step === "type"
            ? "New advertisement"
            : `New ${draft?.type ?? "general"} advertisement`
        }
        subtitle={
          draft?.step === "type" ? "Which kind of advertisement is this?" : undefined
        }
        footer={
          draft?.step === "form" ? (
            <AdminModalActions
              onSave={create}
              onCancel={() => setDraft(null)}
              saveLabel="Create advertisement"
              busy={busy}
            />
          ) : undefined
        }
      >
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
              <AdminField>
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
                      ownerMobile: b?.ownerMobile ?? draft.ownerMobile,
                    });
                  }}
                  className="w-full"
                  options={[
                    { value: "", label: "— Select business —" },
                    ...businesses.map((b) => ({ value: b.id, label: b.name })),
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
                  <AdminField label="Owner mobile">
                    <AdminInput
                      value={draft.ownerMobile}
                      onChange={(v) => setDraft({ ...draft, ownerMobile: v })}
                    />
                  </AdminField>
                </AdminFormRow>
              </>
            )}

            <AdminField label="Category">
              <AdminSelect
                value={draft.category}
                onChange={(v) => setDraft({ ...draft, category: v })}
                className="w-full"
                options={[
                  { value: "", label: "—" },
                  ...categories.map((c) => ({ value: c, label: c })),
                ]}
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
              <AdminField label="Banner image" hint="1200 × 600 px (2:1) recommended">
                <AdminFilePicker
                  value={draft.imageUrl}
                  folder="ads"
                  onChange={(url) => setDraft((d) => (d ? { ...d, imageUrl: url } : d))}
                />
              </AdminField>
            )}

            <AdminField label="Link URL">
              <AdminInput
                value={draft.linkUrl}
                onChange={(v) => setDraft({ ...draft, linkUrl: v })}
              />
            </AdminField>

            <AdminFormRow>
              <AdminField label="Start date" required>
                <AdminInput
                  type="date"
                  value={draft.startDate}
                  onChange={(v) => setDraft({ ...draft, startDate: v })}
                />
              </AdminField>
              <AdminField label="End date" required>
                <AdminInput
                  type="date"
                  value={draft.endDate}
                  onChange={(v) => setDraft({ ...draft, endDate: v })}
                />
              </AdminField>
            </AdminFormRow>

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
      </AdminModal>
    </>
  );
}
