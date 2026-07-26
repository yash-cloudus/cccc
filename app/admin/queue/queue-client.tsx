"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import {
  AdminBtn,
  AdminH2,
  AdminHint,
  AdminTable,
  AdminTd,
  AdminTh,
  FilterChip,
  QStat,
  SearchInput,
  StatusPill,
} from "@/components/admin/admin-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { REJECT_REASONS } from "@/lib/constants";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";

export type QueueRow = {
  id: string;
  head: string;
  surname: string;
  city: string;
  members: number;
  submitted: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

export type FieldChange = {
  field: string;
  label?: string;
  from?: string | null;
  to?: string | null;
};

export type UpdateRequestRow = {
  id: string;
  member: string;
  surname: string;
  changes: FieldChange[];
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
  const [rows, setRows] = useState<QueueRow[]>(initialRows);
  const [tab, setTab] = useState<"new" | "updates">("new");
  const [updates, setUpdates] = useState<UpdateRequestRow[]>(updateRequests);
  const [diff, setDiff] = useState<UpdateRequestRow | null>(null);
  const [updateBusy, setUpdateBusy] = useState<string | null>(null);

  /** Apply writes the allow-listed fields onto the member/family; reject asks for a reason. */
  async function reviewUpdate(row: UpdateRequestRow, action: "apply" | "reject") {
    let rejectReasonText: string | undefined;
    if (action === "reject") {
      const input = window.prompt("Reason for rejecting this update request?");
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
        (status === "all" || f.status === status) &&
        (city === "all" || f.city === city) &&
        (!q || (f.head + f.surname + f.city).toLowerCase().includes(q)),
    );
  }, [rows, query, status, city]);

  const approveRow = approveId ? rows.find((f) => f.id === approveId) : null;
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
      setError("Reject reason is required");
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
    setRows((prev) => prev.map((f) => (f.id === id ? { ...f, status: "REJECTED" } : f)));
    setRejectId(null);
    setApproveId(null);
    setDetail(null);
    setRejectReason("");
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <AdminH2 className="mb-0">Registration queue</AdminH2>
        <div className="flex gap-2.5">
          <QStat count={qc.pending} color="#B0801E" label="Pending" />
          <QStat count={qc.approved} color="#1E9E52" label="Approved" />
          <QStat count={qc.rejected} color="#B0303A" label="Rejected" />
        </div>
      </div>

      {/* Prototype tabs: New registrations / Update requests */}
      <div className="mb-4 inline-flex gap-1 rounded-xl bg-[var(--surface-admin)] p-1">
        {(
          [
            { key: "new" as const, label: `New registrations (${rows.length})` },
            {
              key: "updates" as const,
              label: `Update requests (${updates.filter((u) => u.status === "PENDING").length})`,
            },
          ]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "cursor-pointer rounded-lg px-4 py-2 text-[13px] font-bold",
              tab === t.key
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--ink-dim)] hover:text-[var(--ink)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "new" && (
      <>
      <div className="mb-3.5">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search family / surname / city…"
          className="max-w-full"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] font-bold text-[var(--faint)]">Status:</span>
          {(["all", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
            <FilterChip
              key={s}
              label={s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              active={status === s}
              onClick={() => setStatus(s)}
            />
          ))}
        </div>
        {cities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] font-bold text-[var(--faint)]">City:</span>
            {["all", ...cities].map((c) => (
              <FilterChip
                key={c}
                label={c === "all" ? "All" : c}
                active={city === c}
                onClick={() => setCity(c)}
              />
            ))}
          </div>
        )}
      </div>

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Family (head)</AdminTh>
            <AdminTh>Surname</AdminTh>
            <AdminTh>City</AdminTh>
            <AdminTh>Members</AdminTh>
            <AdminTh>Submitted</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh>Action</AdminTh>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <AdminTd>
                <b>{r.head}</b>
              </AdminTd>
              <AdminTd>{r.surname}</AdminTd>
              <AdminTd>{r.city}</AdminTd>
              <AdminTd>{r.members}</AdminTd>
              <AdminTd>{r.submitted}</AdminTd>
              <AdminTd>
                <StatusPill status={lower(r.status)} />
              </AdminTd>
              <AdminTd>
                {r.status === "PENDING" ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/admin/queue/${r.id}`}
                      className="text-xs font-bold text-[#3D7BC4] underline"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => openApprove(r.id)}
                      className="cursor-pointer rounded-[9px] bg-[var(--success-tint)] px-[11px] py-[5px] text-[11.5px] font-extrabold text-[var(--success)]"
                    >
                      <Check className="mr-0.5 inline size-3" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectId(r.id);
                        setRejectReason("");
                        setError(null);
                      }}
                      className="cursor-pointer rounded-[9px] bg-[var(--danger-tint)] px-[11px] py-[5px] text-[11.5px] font-extrabold text-[var(--danger)]"
                    >
                      <X className="mr-0.5 inline size-3" />
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-[11.5px] text-[var(--faint)]">
                    {r.status === "APPROVED" ? "Approved" : "Rejected"}
                  </span>
                )}
              </AdminTd>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      {filtered.length === 0 && (
        <p className="py-6 text-center text-[11.5px] text-[var(--faint)]">
          No families match the current filters.
        </p>
      )}

      <AdminHint>
        Approve → family&apos;s phone numbers can log in · Reject requires a reason.
      </AdminHint>
      </>
      )}

      {/* ── Profile update requests ─────────────────────────────────── */}
      {tab === "updates" && (
      <>
      <AdminHint className="mt-0 mb-4 max-w-3xl text-[12.5px]">
        Members edited their profile in the app. Review what changed, then apply or reject.
      </AdminHint>

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Member</AdminTh>
            <AdminTh>Surname</AdminTh>
            <AdminTh>Changes</AdminTh>
            <AdminTh>Submitted</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh className="text-right">Action</AdminTh>
          </tr>
        </thead>
        <tbody>
          {updates.map((u) => (
            <tr key={u.id}>
              <AdminTd className="font-semibold text-[var(--ink)]">{u.member}</AdminTd>
              <AdminTd>{u.surname}</AdminTd>
              <AdminTd>{u.changes.length}</AdminTd>
              <AdminTd className="whitespace-nowrap">{u.submitted}</AdminTd>
              <AdminTd>
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
              </AdminTd>
              <AdminTd className="text-right">
                <span className="flex flex-wrap justify-end gap-2">
                  <AdminBtn variant="ghost" onClick={() => setDiff(u)}>
                    View changes
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
                            <Check className="size-4" /> Apply
                          </>
                        )}
                      </AdminBtn>
                      <AdminBtn
                        variant="danger"
                        disabled={updateBusy === u.id}
                        onClick={() => reviewUpdate(u, "reject")}
                      >
                        <X className="size-4" /> Reject
                      </AdminBtn>
                    </>
                  )}
                </span>
              </AdminTd>
            </tr>
          ))}
          {updates.length === 0 && (
            <tr>
              <AdminTd colSpan={6} className="py-8 text-center text-[var(--faint)]">
                No pending update requests.
              </AdminTd>
            </tr>
          )}
        </tbody>
      </AdminTable>
      </>
      )}

      {/* Diff modal */}
      <Dialog open={diff !== null} onOpenChange={(o) => !o && setDiff(null)}>
        <DialogContent className="max-h-[85vh] max-w-[520px] overflow-y-auto rounded-2xl sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              {diff?.member} — requested changes
            </DialogTitle>
          </DialogHeader>
          {diff && (
            <div>
              {diff.changes.length === 0 ? (
                <p className="py-4 text-[13px] text-[var(--faint)]">
                  This request carries no readable changes.
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
                    Apply changes
                  </AdminBtn>
                  <AdminBtn
                    variant="danger"
                    className="flex-1 justify-center"
                    onClick={() => reviewUpdate(diff, "reject")}
                  >
                    Reject
                  </AdminBtn>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve modal */}
      <Dialog
        open={approveId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setApproveId(null);
            setDetail(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="max-w-[440px] rounded-2xl p-0 sm:max-w-[440px]" showCloseButton={false}>
          <div className="sticky top-0 flex items-center gap-3 border-b border-[var(--line-soft)] bg-white px-6 py-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--success-tint)] text-[var(--success)]">
              <Check className="size-[22px]" strokeWidth={2.2} />
            </span>
            <div>
              <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
                Approve family?
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--faint)]">
                Review all details before approving.
              </DialogDescription>
            </div>
          </div>

          {approveRow && (
            <div className="px-6 py-5">
              <h4 className="mb-3 text-sm font-extrabold text-[var(--ink)]">
                {approveRow.head} — {approveRow.surname}
              </h4>

              {loadingDetail ? (
                <div className="flex items-center gap-2 py-6 text-[13px] text-[var(--faint)]">
                  <Loader2 className="size-4 animate-spin" /> Loading details…
                </div>
              ) : detail ? (
                <>
                  <AdminTable className="mb-4">
                    <tbody>
                      <tr>
                        <AdminTd className="w-[120px] text-[var(--faint)]">City</AdminTd>
                        <AdminTd>{approveRow.city}</AdminTd>
                      </tr>
                      <tr>
                        <AdminTd className="text-[var(--faint)]">Address</AdminTd>
                        <AdminTd>{detail.addressGu || detail.addressEn || "—"}</AdminTd>
                      </tr>
                      <tr>
                        <AdminTd className="text-[var(--faint)]">Business</AdminTd>
                        <AdminTd>{detail.businessGu || "—"}</AdminTd>
                      </tr>
                      <tr>
                        <AdminTd className="text-[var(--faint)]">Native elder</AdminTd>
                        <AdminTd>
                          {detail.nativeElderNameGu || detail.nativeElderNameEn || "—"}
                          {detail.nativeElderPhone ? ` · ${detail.nativeElderPhone}` : ""}
                        </AdminTd>
                      </tr>
                      <tr>
                        <AdminTd className="text-[var(--faint)]">Submitted</AdminTd>
                        <AdminTd>{approveRow.submitted}</AdminTd>
                      </tr>
                    </tbody>
                  </AdminTable>

                  <h4 className="mb-2 text-sm font-extrabold text-[var(--ink)]">
                    Members ({detail.familyMembers.length})
                  </h4>
                  {detail.familyMembers.map((m) => {
                    const name = m.fullNameGu || m.fullNameEn;
                    return (
                      <div key={m.id} className="flex items-center gap-3 border-t border-[var(--cream)] py-2">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--danger-tint)] text-sm font-extrabold text-[var(--danger)]">
                          {name.trim()[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold text-[var(--ink)]">{name}</div>
                          <div className="text-[11.5px] text-[var(--faint)]">
                            {m.isHead ? "Head" : m.relation || "Member"}
                          </div>
                        </div>
                        <span className="text-xs text-[var(--ink-mid)]">{m.mobile || "— no login"}</span>
                      </div>
                    );
                  })}
                </>
              ) : null}

              {error && <p className="mt-3 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}

              <div className="mt-4 flex flex-wrap gap-2.5">
                <AdminBtn
                  variant="success"
                  className="flex-1 justify-center"
                  onClick={() => confirmApprove(false)}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "✓ Approve"}
                </AdminBtn>
                <AdminBtn
                  variant="success"
                  className="flex-1 justify-center"
                  onClick={() => confirmApprove(true)}
                >
                  ✓ Approve &amp; Next
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
                  ✕ Reject
                </AdminBtn>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              Reject registration
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-[var(--faint)]">
              {rejectRow?.head} — the family will be notified with the reason.
            </DialogDescription>
          </DialogHeader>

          <div>
            <div className="mb-1 text-[11.5px] font-bold text-[var(--muted)]">Reason *</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((reason) => (
                <FilterChip
                  key={reason}
                  label={reason}
                  active={rejectReason === reason}
                  onClick={() => setRejectReason(reason)}
                />
              ))}
            </div>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Add a note…"
              className="mb-2 min-h-[70px] resize-none border-[var(--line-field)] bg-[var(--field)] text-[13px]"
            />
            {error && <p className="mb-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
            <div className="flex gap-2.5">
              <AdminBtn variant="danger" className="flex-1 justify-center" onClick={confirmReject}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Confirm reject"}
              </AdminBtn>
              <AdminBtn
                variant="ghost"
                className="flex-1 justify-center"
                onClick={() => setRejectId(null)}
              >
                Cancel
              </AdminBtn>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
