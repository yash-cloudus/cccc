"use client";

import { useMemo, useState } from "react";
import { Check, Eye, Loader2, X } from "lucide-react";
import {
  ActionBtn,
  AdminBtn,
  AdminH2,
  AdminTable,
  AdminTd,
  FilterChip,
  QStat,
  StatusPill,
} from "@/components/admin/admin-ui";
import { AdminModal } from "@/components/admin/admin-form";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { WithTooltip } from "@/components/ui/tooltip";
import { storedOccupationPath } from "@/lib/cascading-occupation";
import { REJECT_REASONS } from "@/lib/constants";
import { api } from "@/lib/http";
import { useAdminT, type AdminKey } from "@/lib/i18n/admin-dictionary";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/ui/person-avatar";

/** Chip labels for the stored (English) reject reasons — the value sent to the
 *  API stays the English constant, only the label is translated. */
const REJECT_REASON_KEY: Record<string, AdminKey> = {
  "Incomplete form": "queue.reasonIncomplete",
  "Duplicate family": "queue.reasonDuplicate",
  "Invalid phone": "queue.reasonInvalidPhone",
  "Needs verification": "queue.reasonNeedsVerification",
};

export type QueueRow = {
  id: string;
  headEn: string;
  headGu: string | null;
  /** The head's photo, uploaded on the registration form. */
  photoUrl: string | null;
  surnameEn: string;
  surnameGu: string | null;
  city: string;
  members: number;
  /** ISO timestamp — formatted client-side, in the admin's language. */
  submitted: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectReason?: string | null;
};

export type FieldChange = {
  field: string;
  label?: string;
  from?: string | null;
  to?: string | null;
};

export type UpdateRequestRow = {
  id: string;
  memberEn: string;
  memberGu: string | null;
  surnameEn: string;
  surnameGu: string | null;
  changes: FieldChange[];
  /** ISO timestamp — formatted client-side, in the admin's language. */
  submitted: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectReason: string | null;
};

type FamilyDetail = {
  id: string;
  addressEn: string;
  addressGu: string | null;
  businessGu: string | null;
  nativeElderNameGu: string | null;
  nativeElderNameEn: string | null;
  nativeElderPhone: string | null;
  familyMembers: {
    id: string;
    fullNameEn: string;
    fullNameGu: string | null;
    relation: string | null;
    mobile: string | null;
    isHead: boolean;
    occupation: string | null;
    occupationOther: string | null;
    education: string | null;
    course: string | null;
    specialization: string | null;
  }[];
};

const lower = (s: QueueRow["status"]) => s.toLowerCase() as "pending" | "approved" | "rejected";

export function QueueClient({
  initialRows,
  cities,
  updateRequests,
}: {
  initialRows: QueueRow[];
  cities: string[];
  updateRequests: UpdateRequestRow[];
}) {
  const { t, tf, lang, locale } = useAdminT();
  /** Pick the reader's language out of a bilingual DB value. */
  const bi = (gu: string | null | undefined, en: string | null | undefined) =>
    (lang === "en" ? en || gu : gu || en) || "";
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  const [rows, setRows] = useState<QueueRow[]>(initialRows);
  const [tab, setTab] = useState<"new" | "updates">("new");
  const [updates, setUpdates] = useState<UpdateRequestRow[]>(updateRequests);
  const [diff, setDiff] = useState<UpdateRequestRow | null>(null);
  const [updateBusy, setUpdateBusy] = useState<string | null>(null);

  /** Apply writes the allow-listed fields onto the member/family; reject asks for a reason. */
  async function reviewUpdate(row: UpdateRequestRow, action: "apply" | "reject") {
    let rejectReasonText: string | undefined;
    if (action === "reject") {
      const input = window.prompt(t("queue.promptUpdateReject"));
      if (input === null) return;
      rejectReasonText = input.trim() || undefined;
    }
    setUpdateBusy(row.id);
    const res = await api.patch<{ status: UpdateRequestRow["status"] }>(
      "/api/admin/update-requests",
      { id: row.id, action, rejectReason: rejectReasonText },
    );
    setUpdateBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setUpdates((prev) =>
      prev.map((u) =>
        u.id === row.id
          ? {
              ...u,
              status: action === "apply" ? "APPROVED" : "REJECTED",
              rejectReason: rejectReasonText ?? u.rejectReason,
            }
          : u,
      ),
    );
    setDiff(null);
  }
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<QueueRow["status"] | "all">("all");
  const [city, setCity] = useState<string>("all");

  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detail, setDetail] = useState<FamilyDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qc = useMemo(
    () => ({
      pending: rows.filter((f) => f.status === "PENDING").length,
      approved: rows.filter((f) => f.status === "APPROVED").length,
      rejected: rows.filter((f) => f.status === "REJECTED").length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (f) =>
        (status === "all" ? f.status !== "APPROVED" : f.status === status) &&
        (city === "all" || f.city === city) &&
        (!q ||
          (f.headEn + (f.headGu ?? "") + f.surnameEn + (f.surnameGu ?? "") + f.city)
            .toLowerCase()
            .includes(q)),
    );
  }, [rows, query, status, city]);

  const approveRow = approveId ? rows.find((f) => f.id === approveId) : null;
  // The family's "business" is whatever the head does — registration collects it
  // per member now, so the old family-level column is usually empty.
  const headOccupation = storedOccupationPath(
    detail?.familyMembers.find((m) => m.isHead) ?? {},
  );
  const rejectRow = rejectId ? rows.find((f) => f.id === rejectId) : null;

  async function openApprove(id: string) {
    setApproveId(id);
    setError(null);
    setDetail(null);
    setLoadingDetail(true);
    const res = await api.get<FamilyDetail>(`/api/families/${id}`);
    setLoadingDetail(false);
    if (res.ok) setDetail(res.data);
    else setError(res.error);
  }

  async function confirmApprove(next = false) {
    if (!approveId) return;
    setBusy(true);
    setError(null);
    const res = await api.patch(`/api/families`, { id: approveId, status: "APPROVED" });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRows((prev) => prev.map((f) => (f.id === approveId ? { ...f, status: "APPROVED" } : f)));
    if (next) {
      const nextPending = rows.find((f) => f.status === "PENDING" && f.id !== approveId);
      if (nextPending) return openApprove(nextPending.id);
    }
    setApproveId(null);
    setDetail(null);
  }

  async function confirmReject() {
    const id = rejectId ?? approveId;
    if (!id) return;
    if (!rejectReason.trim()) {
      setError(t("queue.errReasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await api.patch(`/api/families`, { id, status: "REJECTED", rejectReason });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRows((prev) => prev.map((f) => (f.id === id ? { ...f, status: "REJECTED", rejectReason } : f)));
    setRejectId(null);
    setApproveId(null);
    setDetail(null);
    setRejectReason("");
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <AdminH2
          className="mb-0"
          info={
            <>
              <p>{t("queue.info1")}</p>
              <p className="mt-1.5">{t("queue.info2")}</p>
            </>
          }
        >
          {t("nav.queue")}
        </AdminH2>
        <div className="flex gap-2.5">
          <QStat count={qc.pending} color="#B0801E" label={t("queue.pending")} />
          <QStat count={qc.approved} color="#1E9E52" label={t("queue.approved")} />
          <QStat count={qc.rejected} color="#B0303A" label={t("queue.rejected")} />
        </div>
      </div>

      {/* Tabs (left) · search + filters (right, "New registrations" only) — one row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl bg-[var(--surface-admin)] p-1">
          {(
            [
              { key: "new" as const, label: tf("queue.tabNew", { n: qc.pending + qc.rejected }) },
              {
                key: "updates" as const,
                label: tf("queue.tabUpdates", {
                  n: updates.filter((u) => u.status === "PENDING").length,
                }),
              },
            ]
          ).map((tabItem) => (
            <button
              key={tabItem.key}
              type="button"
              onClick={() => setTab(tabItem.key)}
              className={cn(
                "cursor-pointer rounded-lg px-4 py-2 text-[13px] font-bold",
                tab === tabItem.key
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--ink-dim)] hover:text-[var(--ink)]",
              )}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {tab === "new" && (
          <AdminFilterBar
            className="w-full md:w-auto"
            search={{
              value: query,
              onChange: setQuery,
              placeholder: t("queue.searchPlaceholder"),
            }}
            filters={[
              {
                key: "status",
                label: t("queue.status"),
                value: status,
                onChange: (v) => setStatus(v as "all" | QueueRow["status"]),
                width: "w-[140px]",
                options: [
                  { value: "all", label: t("queue.allStatuses") },
                  { value: "PENDING", label: t("queue.pending") },
                  { value: "APPROVED", label: t("queue.approved") },
                  { value: "REJECTED", label: t("queue.rejected") },
                ],
              },
              ...(cities.length > 0
                ? [
                    {
                      key: "city",
                      label: t("queue.city"),
                      value: city,
                      onChange: setCity,
                      options: [
                        { value: "all", label: t("queue.allCities") },
                        ...cities.map((c) => ({ value: c, label: c })),
                      ],
                    },
                  ]
                : []),
            ]}
          />
        )}
      </div>

      {tab === "new" && (
      <>

      <AdminDataTable
        rows={filtered}
        rowKey={(r) => r.id}
        empty={
          <p className="py-6 text-center text-[11.5px] text-[var(--faint)]">
            {t("queue.emptyFamilies")}
          </p>
        }
        columns={[
          {
            key: "head",
            header: t("queue.colFamily"),
            primary: true,
            cell: (r) => (
              <div className="flex items-center gap-2.5">
                <PersonAvatar name={r.headGu || r.headEn} photoUrl={r.photoUrl} />
                <div className="min-w-0">
                  <b>{r.headEn}</b>
                  {r.headGu && r.headGu !== r.headEn ? (
                    <div className="mt-0.5 text-[12px] font-medium text-[var(--ink-dim)]">{r.headGu}</div>
                  ) : null}
                </div>
              </div>
            ),
          },
          {
            key: "surname",
            header: t("queue.colSurname"),
            cell: (r) => (
              <>
                {r.surnameEn}
                {r.surnameGu && r.surnameGu !== r.surnameEn ? (
                  <div className="mt-0.5 text-[12px] font-medium text-[var(--ink-dim)]">{r.surnameGu}</div>
                ) : null}
              </>
            ),
          },
          { key: "city", header: t("queue.city"), cell: (r) => r.city },
          { key: "members", header: t("queue.colMembers"), cell: (r) => r.members },
          { key: "submitted", header: t("queue.colSubmitted"), cell: (r) => fmtDate(r.submitted) },
          {
            key: "status",
            header: t("queue.status"),
            badge: true,
            cell: (r) => (
              <>
                <StatusPill status={lower(r.status)} />
                {r.status === "REJECTED" && r.rejectReason && (
                  <WithTooltip label={r.rejectReason} side="top">
                    <div className="mt-1 line-clamp-1 max-w-[250px] text-[11px] text-[var(--faint)]">
                      {r.rejectReason}
                    </div>
                  </WithTooltip>
                )}
              </>
            ),
          },
          {
            key: "action",
            header: t("queue.colAction"),
            actions: true,
            thClassName: "whitespace-nowrap",
            cell: (r) =>
              r.status === "PENDING" ? (
                <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                  <ActionBtn
                    icon={Eye}
                    label={t("common.view")}
                    onClick={() => { window.location.href = `/admin/queue/${r.id}`; }}
                  />
                  <ActionBtn
                    icon={Check}
                    label={t("queue.approve")}
                    tone="success"
                    onClick={() => openApprove(r.id)}
                  />
                  <ActionBtn
                    icon={X}
                    label={t("queue.reject")}
                    tone="danger"
                    onClick={() => {
                      setRejectId(r.id);
                      setRejectReason("");
                      setError(null);
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                  <ActionBtn
                    icon={Eye}
                    label={t("common.view")}
                    onClick={() => { window.location.href = `/admin/queue/${r.id}`; }}
                  />
                </div>
              ),
          },
        ]}
      />

      </>
      )}

      {/* ── Profile update requests ─────────────────────────────────── */}
      {tab === "updates" && (
      <>
      <AdminDataTable
        rows={updates}
        rowKey={(u) => u.id}
        empty={
          <p className="py-8 text-center text-[13px] text-[var(--faint)]">
            {t("queue.emptyUpdates")}
          </p>
        }
        columns={[
          {
            key: "member",
            header: t("queue.colMember"),
            primary: true,
            tdClassName: "font-semibold text-[var(--ink)]",
            cell: (u) => (
              <>
                {u.memberEn}
                {u.memberGu && u.memberGu !== u.memberEn ? (
                  <div className="mt-0.5 text-[12px] font-medium text-[var(--ink-dim)]">{u.memberGu}</div>
                ) : null}
              </>
            ),
          },
          {
            key: "surname",
            header: t("queue.colSurname"),
            cell: (u) => (
              <>
                {u.surnameEn}
                {u.surnameGu && u.surnameGu !== u.surnameEn ? (
                  <div className="mt-0.5 text-[12px] font-medium text-[var(--ink-dim)]">{u.surnameGu}</div>
                ) : null}
              </>
            ),
          },
          { key: "changes", header: t("queue.colChanges"), cell: (u) => u.changes.length },
          {
            key: "submitted",
            header: t("queue.colSubmitted"),
            tdClassName: "whitespace-nowrap",
            cell: (u) => fmtDate(u.submitted),
          },
          {
            key: "status",
            header: t("queue.status"),
            badge: true,
            cell: (u) => (
              <>
                <StatusPill
                  status={
                    u.status === "APPROVED"
                      ? "approved"
                      : u.status === "REJECTED"
                        ? "rejected"
                        : "pending"
                  }
                />
                {u.status === "REJECTED" && u.rejectReason && (
                  <div className="mt-1 text-[11px] text-[var(--faint)]">{u.rejectReason}</div>
                )}
              </>
            ),
          },
          {
            key: "action",
            header: t("queue.colAction"),
            actions: true,
            cell: (u) => (
              <span className="flex flex-wrap gap-2 md:justify-end">
                <AdminBtn variant="ghost" onClick={() => setDiff(u)}>
                  {t("queue.viewChanges")}
                </AdminBtn>
                {u.status === "PENDING" && (
                  <>
                    <AdminBtn
                      variant="success"
                      disabled={updateBusy === u.id}
                      onClick={() => reviewUpdate(u, "apply")}
                    >
                      {updateBusy === u.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="size-4" /> {t("queue.apply")}
                        </>
                      )}
                    </AdminBtn>
                    <AdminBtn
                      variant="danger"
                      disabled={updateBusy === u.id}
                      onClick={() => reviewUpdate(u, "reject")}
                    >
                      <X className="size-4" /> {t("queue.reject")}
                    </AdminBtn>
                  </>
                )}
              </span>
            ),
          },
        ]}
      />
      </>
      )}

      {/* Diff modal */}
      <Dialog open={diff !== null} onOpenChange={(o) => !o && setDiff(null)}>
        <DialogContent className="max-h-[85vh] max-w-[520px] overflow-y-auto rounded-2xl sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              {diff ? tf("queue.diffTitle", { name: bi(diff.memberGu, diff.memberEn) }) : ""}
            </DialogTitle>
          </DialogHeader>
          {diff && (
            <div>
              {diff.changes.length === 0 ? (
                <p className="py-4 text-[13px] text-[var(--faint)]">
                  {t("queue.noChanges")}
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {diff.changes.map((c, i) => (
                    <div
                      key={`${c.field}-${i}`}
                      className="rounded-xl border border-[var(--line-admin)] p-3"
                    >
                      <div className="text-[11.5px] font-bold tracking-wide text-[var(--faint)] uppercase">
                        {c.label || c.field}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                        <span className="rounded-lg bg-[var(--danger-tint)] px-2 py-0.5 text-[var(--danger)] line-through">
                          {c.from || "—"}
                        </span>
                        <span className="text-[var(--faint)]">→</span>
                        <span className="rounded-lg bg-[var(--success-tint)] px-2 py-0.5 font-semibold text-[var(--success)]">
                          {c.to || "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {diff.status === "PENDING" && (
                <div className="mt-4 flex gap-2.5">
                  <AdminBtn
                    variant="success"
                    className="flex-1 justify-center"
                    onClick={() => reviewUpdate(diff, "apply")}
                  >
                    {t("queue.applyChanges")}
                  </AdminBtn>
                  <AdminBtn
                    variant="danger"
                    className="flex-1 justify-center"
                    onClick={() => reviewUpdate(diff, "reject")}
                  >
                    {t("queue.reject")}
                  </AdminBtn>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve modal */}
      <AdminModal
        open={approveId !== null}
        onClose={() => {
          setApproveId(null);
          setDetail(null);
          setError(null);
        }}
        title={t("queue.approveTitle")}
        subtitle={t("queue.approveSubtitle")}
        icon={
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--success-tint)] text-[var(--success)]">
            <Check className="size-[22px]" strokeWidth={2.2} />
          </span>
        }
        footer={
          approveRow ? (
            <>
              <AdminBtn
                variant="success"
                className="flex-1 justify-center"
                onClick={() => confirmApprove(false)}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : `✓ ${t("queue.approve")}`}
              </AdminBtn>
              <AdminBtn
                variant="success"
                className="flex-1 justify-center"
                onClick={() => confirmApprove(true)}
              >
                ✓ {t("queue.approveNext")}
              </AdminBtn>
              <AdminBtn
                variant="ghost"
                className="text-[var(--danger)]! border-[var(--brand-border)]!"
                onClick={() => {
                  setRejectId(approveId);
                  setApproveId(null);
                  setRejectReason("");
                }}
              >
                ✕ {t("queue.reject")}
              </AdminBtn>
            </>
          ) : undefined
        }
      >
        {approveRow && (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-extrabold text-[var(--ink)]">
                {bi(approveRow.headGu, approveRow.headEn)} —{" "}
                {bi(approveRow.surnameGu, approveRow.surnameEn)}
              </h4>
              <ActionBtn
                icon={Eye}
                label={t("common.view")}
                onClick={() => {
                  window.location.href = `/admin/queue/${approveRow.id}`;
                }}
              />
            </div>

            {loadingDetail ? (
              <div className="flex items-center gap-2 py-6 text-[13px] text-[var(--faint)]">
                <Loader2 className="size-4 animate-spin" /> {t("queue.loadingDetails")}
              </div>
            ) : detail ? (
              <>
                <AdminTable className="mb-4">
                  <tbody>
                    <tr>
                      <AdminTd className="w-[120px] text-[var(--faint)]">{t("queue.city")}</AdminTd>
                      <AdminTd>{approveRow.city}</AdminTd>
                    </tr>
                    <tr>
                      <AdminTd className="text-[var(--faint)]">{t("queue.address")}</AdminTd>
                      <AdminTd>{bi(detail.addressGu, detail.addressEn) || "—"}</AdminTd>
                    </tr>
                    <tr>
                      <AdminTd className="text-[var(--faint)]">{t("queue.business")}</AdminTd>
                      <AdminTd>{headOccupation || detail.businessGu || "—"}</AdminTd>
                    </tr>
                    <tr>
                      <AdminTd className="text-[var(--faint)]">{t("queue.nativeElder")}</AdminTd>
                      <AdminTd>
                        {bi(detail.nativeElderNameGu, detail.nativeElderNameEn) || "—"}
                        {detail.nativeElderPhone ? ` · ${detail.nativeElderPhone}` : ""}
                      </AdminTd>
                    </tr>
                    <tr>
                      <AdminTd className="text-[var(--faint)]">{t("queue.colSubmitted")}</AdminTd>
                      <AdminTd>{fmtDate(approveRow.submitted)}</AdminTd>
                    </tr>
                  </tbody>
                </AdminTable>

                <h4 className="mb-2 text-sm font-extrabold text-[var(--ink)]">
                  {tf("queue.membersCount", { n: detail.familyMembers.length })}
                </h4>
                {detail.familyMembers.map((m) => {
                  const name = bi(m.fullNameGu, m.fullNameEn);
                  const work = storedOccupationPath(m);
                  return (
                    <div key={m.id} className="flex items-center gap-3 border-t border-[var(--cream)] py-2">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--danger-tint)] text-sm font-extrabold text-[var(--danger)]">
                        {name.trim()[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold text-[var(--ink)]">{name}</div>
                        <div className="text-[11.5px] text-[var(--faint)]">
                          {m.isHead ? t("queue.head") : m.relation || t("queue.member")}
                          {work ? ` · ${work}` : ""}
                        </div>
                      </div>
                      <span className="text-xs text-[var(--ink-mid)]">{m.mobile || t("queue.noLogin")}</span>
                    </div>
                  );
                })}
              </>
            ) : null}

            {error && <p className="mt-3 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
          </div>
        )}
      </AdminModal>

      {/* Reject modal */}
      <Dialog
        open={rejectId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectId(null);
            setRejectReason("");
            setError(null);
          }
        }}
      >
        <DialogContent className="max-w-[380px] rounded-2xl sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              {t("queue.rejectTitle")}
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-[var(--faint)]">
              {tf("queue.rejectDesc", {
                name: rejectRow ? bi(rejectRow.headGu, rejectRow.headEn) : "",
              })}
            </DialogDescription>
          </DialogHeader>

          <div>
            <div className="mb-1 text-[11.5px] font-bold text-[var(--muted)]">{t("queue.reasonRequired")}</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((reason) => (
                <FilterChip
                  key={reason}
                  label={t(REJECT_REASON_KEY[reason])}
                  active={rejectReason === reason}
                  onClick={() => setRejectReason(reason)}
                />
              ))}
            </div>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("queue.addNote")}
              className="mb-2 min-h-[70px] resize-none border-[var(--line-field)] bg-[var(--field)] text-[13px]"
            />
            {error && <p className="mb-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
            <div className="flex gap-2.5">
              <AdminBtn variant="danger" className="flex-1 justify-center" onClick={confirmReject}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : t("queue.confirmReject")}
              </AdminBtn>
              <AdminBtn
                variant="ghost"
                className="flex-1 justify-center"
                onClick={() => setRejectId(null)}
              >
                {t("common.cancel")}
              </AdminBtn>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
