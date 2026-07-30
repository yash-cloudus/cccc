"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import {
  AdminBtn,
  AdminH2,
  AdminH3,
  AdminInput,
  AdminLabel,
  AdminSelect,
  AdminTable,
  AdminTd,
  AdminTh,
  PillActive,
  PillExpired,
  SearchInput,
} from "@/components/admin/admin-ui";
import {
  RejectResultModal,
  UploadResultModal,
  VerifyResultModal,
  openWhatsAppNotify,
} from "@/components/admin/result-drive-modals";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/http";
import { EDUCATION_LEVELS } from "@/lib/occupation-defaults";
import {
  STREAM_STANDARDS,
  meritGroups,
  rankApproved,
  rosterKey,
  rosterStatusMeta,
  streamColors,
  type MeritGroup,
  type RosterRow,
} from "@/lib/result-drive";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { formatDate } from "@/lib/format";

export type DriveInfo = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  year: number;
  isOpen: boolean;
  isPublished: boolean;
  entries: number;
};

const LEVELS = EDUCATION_LEVELS.map((l) => l.nameEn);

/**
 * Ranked merit tables — one per stream for Std 11/12, one overall otherwise.
 * Shared by the per-standard merit list and the whole-drive final report so the
 * two can never disagree about who ranked where.
 */
function MeritSections({ groups }: { groups: MeritGroup[] }) {
  const split = groups.length > 1 || groups[0]?.stream != null;
  return (
    <>
      {groups.map((g) => (
        <section key={g.stream ?? "unassigned"} className={split ? "mb-4 last:mb-0" : undefined}>
          {split && (
            <div className="mb-1.5 text-[13px] font-extrabold text-[var(--ink)]">
              {g.stream ?? "Stream not recorded"}
            </div>
          )}
          <AdminTable bordered={false}>
            <thead>
              <tr>
                <AdminTh>Rank</AdminTh>
                <AdminTh>Student name</AdminTh>
                <AdminTh>Percentage</AdminTh>
                <AdminTh>School / College</AdminTh>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((m) => (
                <tr key={rosterKey(m)}>
                  <AdminTd className="font-extrabold text-[var(--brand)]">{m.rank}</AdminTd>
                  <AdminTd className="font-semibold text-[var(--ink)]">{m.studentName}</AdminTd>
                  <AdminTd>{m.percentage?.toFixed(2)}%</AdminTd>
                  <AdminTd>{m.schoolName || "—"}</AdminTd>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        </section>
      ))}
    </>
  );
}

export function ResultsClient({
  drives,
  currentDrive,
  roster: initialRoster,
  adminUploadEnabled,
}: {
  drives: DriveInfo[];
  currentDrive: DriveInfo | null;
  roster: RosterRow[];
  adminUploadEnabled: boolean;
}) {
  const router = useRouter();
  const { fromEn, guInput } = useTranslitSync();
  const [roster, setRoster] = useState<RosterRow[]>(initialRoster);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({ titleEn: "", titleGu: "", year: String(new Date().getFullYear()) });
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [streamFilter, setStreamFilter] = useState("all");
  const [verify, setVerify] = useState<{ row: RosterRow; viewOnly: boolean } | null>(null);
  const [rejectRow, setRejectRow] = useState<RosterRow | null>(null);
  const [uploadRow, setUploadRow] = useState<RosterRow | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");

  const params = useSearchParams();
  const activeStd = params.get("std");
  const viewParam = params.get("view");
  const view: "overview" | "standard" | "merit" | "final" =
    viewParam === "final" ? "final" : viewParam === "merit" ? "merit" : activeStd ? "standard" : "overview";

  const go = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null) sp.delete(k);
        else sp.set(k, v);
      }
      router.push(`/admin/results?${sp.toString()}`);
    },
    [params, router],
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      roster.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (q && ![r.studentName, r.familyLabel, r.mobile, r.schoolName].some((v) => v?.toLowerCase().includes(q))) {
          return false;
        }
        return true;
      }),
    [roster, statusFilter, q],
  );

  const standards = useMemo(() => {
    const map = new Map<string, { total: number; approved: number; pending: number; rejected: number; uploaded: number }>();
    for (const r of filtered) {
      const row = map.get(r.standard) ?? { total: 0, approved: 0, pending: 0, rejected: 0, uploaded: 0 };
      row.total += 1;
      if (r.status !== "none") row.uploaded += 1;
      if (r.status === "APPROVED") row.approved += 1;
      else if (r.status === "REJECTED" || r.status === "RESUBMIT") row.rejected += 1;
      else if (r.status === "PENDING") row.pending += 1;
      map.set(r.standard, row);
    }
    const extra = [...map.keys()].filter((s) => !LEVELS.includes(s)).sort();
    return [...LEVELS, ...extra]
      .filter((s) => levelFilter === "all" || s === levelFilter)
      .map((standard) => ({
        standard,
        ...(map.get(standard) ?? { total: 0, approved: 0, pending: 0, rejected: 0, uploaded: 0 }),
      }));
  }, [filtered, levelFilter]);

  const stdRows = useMemo(() => {
    if (!activeStd) return [];
    let rows = filtered.filter((r) => r.standard === activeStd);
    if (STREAM_STANDARDS.has(activeStd) && streamFilter !== "all") {
      rows = rows.filter((r) => (r.stream || "") === streamFilter);
    }
    return rows;
  }, [filtered, activeStd, streamFilter]);

  const ranks = useMemo(() => (activeStd ? rankApproved(roster, activeStd) : new Map()), [roster, activeStd]);

  const stdSummary = useMemo(() => {
    const all = activeStd ? roster.filter((r) => r.standard === activeStd) : [];
    const uploaded = all.filter((r) => r.status !== "none").length;
    const pending = all.filter((r) => r.status === "PENDING").length;
    return {
      total: all.length,
      uploaded,
      pending,
      approved: all.filter((r) => r.status === "APPROVED").length,
      rejected: all.filter((r) => r.status === "REJECTED" || r.status === "RESUBMIT").length,
      allDone: all.length > 0 && uploaded > 0 && pending === 0,
    };
  }, [roster, activeStd]);

  const meritOf = useCallback((std: string) => meritGroups(roster, std), [roster]);

  const finalStandards = useMemo(
    () => standards.map((s) => s.standard).filter((s) => meritOf(s).length > 0),
    [standards, meritOf],
  );

  const merit = activeStd ? meritOf(activeStd) : [];
  const pending = roster.filter((r) => r.status === "PENDING").length;

  const driveOptions = useMemo(() => {
    const perYear = new Map<number, number>();
    for (const d of drives) perYear.set(d.year, (perYear.get(d.year) ?? 0) + 1);
    return [...drives]
      .sort((a, b) => b.year - a.year)
      .map((d) => ({
        value: d.id,
        label: (perYear.get(d.year) ?? 0) > 1 ? `${d.year} — ${d.titleEn}` : String(d.year),
      }));
  }, [drives]);

  function patchRoster(updated: RosterRow) {
    setRoster((prev) => {
      const idx = prev.findIndex(
        (r) =>
          (updated.memberId && r.memberId === updated.memberId) ||
          (updated.entryId && r.entryId === updated.entryId) ||
          (r.studentName === updated.studentName && r.standard === updated.standard),
      );
      if (idx < 0) return [...prev, updated];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }

  async function approveRow(row: RosterRow, andNext = false) {
    if (!row.entryId) return;
    setBusyAction(true);
    setError(null);
    const res = await api.patch<{ notify: { mobile: string; message: string } | null }>(
      "/api/results",
      {
        id: row.entryId,
        status: "APPROVED",
        rejectReason: null,
      },
    );
    setBusyAction(false);
    if (!res.ok) return setError(res.error);
    if (res.data.notify) openWhatsAppNotify(res.data.notify.mobile, res.data.notify.message);
    const updated: RosterRow = {
      ...row,
      status: "APPROVED",
      rejectReason: null,
      updatedAt: new Date().toISOString(),
    };
    patchRoster(updated);
    if (andNext) {
      const pendingRows = stdRows.filter((r) => r.status === "PENDING" && r.entryId !== row.entryId);
      if (pendingRows[0]) setVerify({ row: pendingRows[0], viewOnly: false });
      else setVerify(null);
    } else {
      setVerify(null);
    }
  }

  async function rejectConfirm(reason: string) {
    if (!rejectRow?.entryId) return;
    setBusyAction(true);
    const res = await api.patch<{ notify: { mobile: string; message: string } | null }>("/api/results", {
      id: rejectRow.entryId,
      status: "REJECTED",
      rejectReason: reason,
    });
    setBusyAction(false);
    if (!res.ok) return setError(res.error);
    if (res.data.notify) openWhatsAppNotify(res.data.notify.mobile, res.data.notify.message);
    patchRoster({
      ...rejectRow,
      status: "REJECTED",
      rejectReason: reason,
      updatedAt: new Date().toISOString(),
    });
    setRejectRow(null);
    setVerify(null);
  }

  async function toggleDrive(field: "isOpen" | "isPublished") {
    if (!currentDrive) return;
    const res = await api.patch(`/api/admin/result-drives`, {
      id: currentDrive.id,
      [field]: !currentDrive[field],
    });
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  async function createDrive() {
    if (!draft.titleEn.trim()) return setError("Title is required");
    setBusy(true);
    setError(null);
    const res = await api.post<{ id: string }>(`/api/admin/result-drives`, {
      titleEn: draft.titleEn.trim(),
      titleGu: draft.titleGu.trim() || undefined,
      year: Number(draft.year),
      isOpen: true,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setNewOpen(false);
    router.push(`/admin/results?drive=${res.data.id}`);
    router.refresh();
  }

  function verifyNav(delta: number) {
    if (!verify || !activeStd) return;
    const same = stdRows.filter((r) => r.status !== "none");
    const idx = same.findIndex((r) => r.entryId === verify.row.entryId);
    if (idx < 0) return;
    const next = same[(idx + delta + same.length) % same.length];
    if (next) setVerify({ row: next, viewOnly: verify.viewOnly });
  }

  const streamTabs = useMemo(() => {
    if (!activeStd || !STREAM_STANDARDS.has(activeStd)) return [];
    return (["all", "Science", "Commerce"] as const).map((v) => ({
      value: v,
      label: v === "all" ? "All" : v,
      count: roster.filter(
        (r) => r.standard === activeStd && (v === "all" || (r.stream || "") === v),
      ).length,
    }));
  }, [activeStd, roster]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminH2 className="mb-0">
          Result drive{" "}
          {currentDrive ? (
            <>
              — {currentDrive.titleGu || currentDrive.titleEn}{" "}
              {currentDrive.isOpen ? <PillActive>Open</PillActive> : <PillExpired>Closed</PillExpired>}
            </>
          ) : null}
        </AdminH2>
        <span className="flex gap-2">
          <AdminBtn variant="ghost" onClick={() => { setNewOpen(true); setError(null); }}>
            <Plus className="size-4" />
            New drive
          </AdminBtn>
          <AdminBtn onClick={() => go({ view: "final", std: null })}>🏆 Final result</AdminBtn>
        </span>
      </div>

      {currentDrive && view === "overview" && (
        <div className="mb-5 flex flex-wrap items-center gap-2.5">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search student / mobile / family…"
            className="min-w-[240px] flex-1"
          />
          <AdminSelect
            value={currentDrive.id}
            onChange={(v) => router.push(`/admin/results?drive=${v}`)}
            className="w-auto"
            options={driveOptions}
          />
          <AdminSelect
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-auto"
            options={[
              { value: "all", label: "All status" },
              { value: "none", label: "Not uploaded" },
              { value: "PENDING", label: "Pending" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
            ]}
          />
          <AdminSelect
            value={levelFilter}
            onChange={setLevelFilter}
            className="w-auto"
            options={[{ value: "all", label: "All education levels" }, ...LEVELS.map((l) => ({ value: l, label: l }))]}
          />
        </div>
      )}

      {error && <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>}

      {!currentDrive ? (
        <p className="py-8 text-center text-[13px] text-[var(--faint)]">
          No result drive yet. Create one to start collecting student results.
        </p>
      ) : (
        <>
          <div className={view === "overview" ? "mb-5 flex flex-wrap gap-2" : "hidden"}>
            <AdminBtn variant="ghost" onClick={() => toggleDrive("isOpen")}>
              {currentDrive.isOpen ? "Close drive" : "Reopen drive"}
            </AdminBtn>
            <AdminBtn variant="ghost" onClick={() => toggleDrive("isPublished")}>
              {currentDrive.isPublished ? "Unpublish toppers" : "Publish toppers"}
            </AdminBtn>
          </div>

          {view === "overview" && (
            <>
              <AdminH3>
                Standards — {pending} pending / {roster.filter((r) => r.status !== "none").length} uploaded
              </AdminH3>
              {standards.length === 0 ? (
                <p className="py-6 text-[13px] text-[var(--faint)]">No standards match your filters.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
                  {standards.map((s) => {
                    const completion = s.uploaded
                      ? Math.round(((s.approved + s.rejected) / s.uploaded) * 100)
                      : 0;
                    return (
                      <button
                        key={s.standard}
                        type="button"
                        onClick={() => go({ std: s.standard, view: null })}
                        className="cursor-pointer rounded-2xl border border-[var(--line-admin)] bg-white p-4 text-left hover:border-[var(--brand-border)]"
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-[15px] font-extrabold text-[var(--ink)]">{s.standard}</span>
                          <span className="text-[11.5px] font-semibold text-[var(--faint)]">
                            {s.total} student{s.total === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
                          <span className="rounded-full bg-[var(--success-tint)] px-2 py-0.5 text-[var(--success)]">
                            ✓ {s.approved}
                          </span>
                          <span className="rounded-full bg-[var(--gold-tint)] px-2 py-0.5 text-[var(--warn)]">
                            ⧗ {s.pending}
                          </span>
                          <span className="rounded-full bg-[var(--danger-tint)] px-2 py-0.5 text-[var(--danger)]">
                            ✕ {s.rejected}
                          </span>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--line-soft)]">
                          <div
                            className="h-full rounded-full bg-[var(--brand)]"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11.5px] font-semibold text-[var(--faint)]">
                          <span>{completion}% reviewed</span>
                          <span className="text-[var(--brand)]">Open →</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {view === "final" && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <AdminBtn variant="ghost" onClick={() => go({ std: null, view: null })}>
                  ‹ Back to dashboard
                </AdminBtn>
                <AdminBtn onClick={() => window.print()}>🖨 Print final result</AdminBtn>
              </div>
              <div className="rounded-2xl border border-[var(--line-admin)] bg-white p-6">
                <h3 className="text-center text-[18px] font-extrabold text-[var(--ink)]">
                  Result Merit Report — {currentDrive.titleGu || currentDrive.titleEn}
                </h3>
                <p className="mb-4 text-center text-[12.5px] text-[var(--faint)]">
                  Academic Year: {currentDrive.year}
                </p>
                {finalStandards.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[var(--faint)]">No approved results yet.</p>
                ) : (
                  finalStandards.map((std) => (
                    <section key={std} className="mb-5">
                      <h4 className="mb-1 rounded-[10px] bg-[#FBFAF7] px-3.5 py-2 text-[14px] font-extrabold text-[var(--ink)]">
                        {std}
                      </h4>
                      <MeritSections groups={meritOf(std)} />
                    </section>
                  ))
                )}
              </div>
            </>
          )}

          {view === "merit" && activeStd && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <AdminBtn variant="ghost" onClick={() => go({ view: null })}>
                  ‹ Back to {activeStd}
                </AdminBtn>
                <AdminBtn onClick={() => window.print()}>🖨 Print / Download PDF</AdminBtn>
              </div>
              <div className="rounded-2xl border border-[var(--line-admin)] bg-white p-6">
                <h3 className="text-center text-[18px] font-extrabold text-[var(--ink)]">Merit List — {activeStd}</h3>
                <p className="mb-4 text-center text-[12.5px] text-[var(--faint)]">
                  {currentDrive.titleGu || currentDrive.titleEn} · Academic Year {currentDrive.year}
                </p>
                {merit.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[var(--faint)]">No approved results yet.</p>
                ) : (
                  <MeritSections groups={merit} />
                )}
              </div>
            </>
          )}

          {view === "standard" && activeStd && (
            <>
              <AdminBtn variant="ghost" className="mb-2.5" onClick={() => go({ std: null, view: null })}>
                ‹ Back to dashboard
              </AdminBtn>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <AdminH3 className="mb-0">{activeStd}</AdminH3>
                {stdSummary.allDone && (
                  <AdminBtn onClick={() => go({ view: "merit" })}>🏅 View merit list</AdminBtn>
                )}
              </div>

              {stdSummary.allDone && (
                <div className="mb-4 rounded-xl border border-[#B7E6C6] bg-[#F0FBF3] px-4 py-3 text-[13px] font-bold text-[#1E7A44]">
                  ✓ Result completed — merit list is ready.
                </div>
              )}

              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(
                  [
                    ["Students", stdSummary.total, "var(--ink)"],
                    ["Uploaded", stdSummary.uploaded, "var(--info)"],
                    ["Pending", stdSummary.pending, "var(--warn)"],
                    ["Approved", stdSummary.approved, "var(--success)"],
                    ["Rejected", stdSummary.rejected, "var(--danger)"],
                  ] as const
                ).map(([label, value, color]) => (
                  <div key={label} className="rounded-[14px] border border-[var(--line-admin)] bg-[#FBFAF7] p-3">
                    <div className="text-[22px] font-extrabold" style={{ color }}>
                      {value}
                    </div>
                    <div className="text-[11.5px] text-[var(--faint)]">{label}</div>
                  </div>
                ))}
              </div>

              {streamTabs.length > 0 && (
                <div className="mb-3.5 flex flex-wrap gap-2">
                  {streamTabs.map((tb) => (
                    <button
                      key={tb.value}
                      type="button"
                      onClick={() => setStreamFilter(tb.value)}
                      className="cursor-pointer rounded-[9px] border-[1.5px] px-4 py-1.5 text-[12.5px] font-bold"
                      style={{
                        borderColor: streamFilter === tb.value ? "#A62A38" : "#E6E0D3",
                        background: streamFilter === tb.value ? "#A62A38" : "#FCFAF6",
                        color: streamFilter === tb.value ? "#fff" : "#6B6357",
                      }}
                    >
                      {tb.label} ({tb.count})
                    </button>
                  ))}
                </div>
              )}

              {stdRows.length === 0 ? (
                <p className="py-6 text-[13px] text-[var(--faint)]">No students in this standard.</p>
              ) : (
                <div className="overflow-x-auto">
                  <AdminTable>
                    <thead>
                      <tr>
                        <AdminTh>Student</AdminTh>
                        <AdminTh>Family</AdminTh>
                        <AdminTh>Mobile</AdminTh>
                        {STREAM_STANDARDS.has(activeStd) && <AdminTh>Stream</AdminTh>}
                        <AdminTh>Upload</AdminTh>
                        <AdminTh>Verification</AdminTh>
                        <AdminTh>%</AdminTh>
                        <AdminTh>Rank</AdminTh>
                        <AdminTh>Updated</AdminTh>
                        <AdminTh>Actions</AdminTh>
                      </tr>
                    </thead>
                    <tbody>
                      {stdRows.map((r) => {
                        const meta = rosterStatusMeta(r.status);
                        const sc = r.stream ? streamColors(r.stream) : null;
                        const rankKey = r.entryId ?? r.memberId ?? r.studentName;
                        const rank = ranks.get(rankKey);
                        return (
                          <tr key={`${r.memberId ?? r.entryId ?? r.studentName}`}>
                            <AdminTd>
                              <b>{r.studentName}</b>
                            </AdminTd>
                            <AdminTd>{r.familyLabel}</AdminTd>
                            <AdminTd>{r.mobile || "—"}</AdminTd>
                            {STREAM_STANDARDS.has(activeStd) && (
                              <AdminTd>
                                {r.stream && sc ? (
                                  <span
                                    className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
                                    style={{ background: sc.bg, color: sc.fg }}
                                  >
                                    {r.stream}
                                  </span>
                                ) : null}
                              </AdminTd>
                            )}
                            <AdminTd>
                              <span
                                className="font-bold"
                                style={{ color: r.status === "none" ? "#B0303A" : "#1E9E52" }}
                              >
                                {r.status === "none" ? "Not uploaded" : "Uploaded"}
                              </span>
                            </AdminTd>
                            <AdminTd>
                              <span
                                className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
                                style={{ background: meta.bg, color: meta.fg }}
                              >
                                {meta.label}
                              </span>
                            </AdminTd>
                            <AdminTd>
                              {r.percentage != null ? (
                                <span className={r.percentage >= 80 ? "font-bold text-[#22A45D]" : ""}>
                                  {r.percentage}%
                                </span>
                              ) : (
                                "—"
                              )}
                            </AdminTd>
                            <AdminTd>{rank ? `#${rank}` : "—"}</AdminTd>
                            <AdminTd>{r.updatedAt ? formatDate(r.updatedAt, "en") : "—"}</AdminTd>
                            <AdminTd className="whitespace-nowrap">
                              {r.status === "none" ? (
                                adminUploadEnabled ? (
                                  <button
                                    type="button"
                                    className="cursor-pointer font-bold text-[var(--brand)] underline"
                                    onClick={() => setUploadRow(r)}
                                  >
                                    upload result
                                  </button>
                                ) : (
                                  "—"
                                )
                              ) : (
                                <span className="text-[12px]">
                                  <button
                                    type="button"
                                    className="cursor-pointer font-bold text-[#3D7BC4] underline"
                                    onClick={() => setVerify({ row: r, viewOnly: true })}
                                  >
                                    view
                                  </button>
                                  {" · "}
                                  <button
                                    type="button"
                                    className="cursor-pointer font-bold text-[#1E7A44] underline"
                                    onClick={() => setVerify({ row: r, viewOnly: false })}
                                  >
                                    verify
                                  </button>
                                  {" · "}
                                  <button
                                    type="button"
                                    className="cursor-pointer font-bold text-[#3D7BC4] underline"
                                    onClick={() => setUploadRow(r)}
                                  >
                                    edit
                                  </button>
                                  {(r.status === "REJECTED" || r.status === "RESUBMIT") && adminUploadEnabled && (
                                    <>
                                      {" · "}
                                      <button
                                        type="button"
                                        className="cursor-pointer font-bold text-[#B0801E] underline"
                                        onClick={() => setUploadRow(r)}
                                      >
                                        replace
                                      </button>
                                    </>
                                  )}
                                </span>
                              )}
                            </AdminTd>
                          </tr>
                        );
                      })}
                    </tbody>
                  </AdminTable>
                </div>
              )}
            </>
          )}
        </>
      )}

      {verify && activeStd && (
        <VerifyResultModal
          row={verify.row}
          standard={activeStd}
          viewOnly={verify.viewOnly}
          hasNav={stdRows.filter((r) => r.status !== "none").length > 1}
          onClose={() => setVerify(null)}
          onApprove={() => void approveRow(verify.row, false)}
          onSaveNext={() => void approveRow(verify.row, true)}
          onReject={() => {
            setRejectRow(verify.row);
          }}
          onPrev={() => verifyNav(-1)}
          onNext={() => verifyNav(1)}
          busy={busyAction}
        />
      )}

      {rejectRow && (
        <RejectResultModal
          row={rejectRow}
          onClose={() => setRejectRow(null)}
          onConfirm={(reason) => void rejectConfirm(reason)}
          busy={busyAction}
        />
      )}

      {uploadRow && currentDrive && (
        <UploadResultModal
          row={uploadRow}
          driveId={currentDrive.id}
          onClose={() => setUploadRow(null)}
          onSaved={(updated) => {
            patchRoster(updated);
            setUploadRow(null);
            router.refresh();
          }}
        />
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-[380px] rounded-2xl sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">New result drive</DialogTitle>
          </DialogHeader>
          <div>
            <AdminLabel>Title (English) *</AdminLabel>
            <AdminInput
              value={draft.titleEn}
              onChange={(v) => {
                setDraft((prev) => ({ ...prev, titleEn: v }));
                fromEn(v, (gu) => setDraft((prev) => ({ ...prev, titleGu: gu })));
              }}
            />
            <AdminLabel>Title (ગુજરાતી)</AdminLabel>
            <AdminInput
              gujarati
              value={draft.titleGu}
              onChange={(v) => {
                setDraft((prev) => ({ ...prev, titleGu: v }));
                guInput(v, (gu) => setDraft((prev) => ({ ...prev, titleGu: gu })), "gu");
              }}
            />
            <AdminLabel>Year *</AdminLabel>
            <AdminInput type="number" value={draft.year} onChange={(v) => setDraft({ ...draft, year: v })} />
            {error && <p className="mt-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
            <div className="mt-4 flex gap-2.5">
              <AdminBtn className="flex-1 justify-center" onClick={createDrive}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Create drive"}
              </AdminBtn>
              <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setNewOpen(false)}>
                Cancel
              </AdminBtn>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
