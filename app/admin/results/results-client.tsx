"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FileOutput,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RotateCw,
  Unlock,
  Upload,
} from "lucide-react";
import {
  ActionBtn,
  AdminBtn,
  AdminH2,
  AdminH3,
  AdminInput,
  AdminLabel,
  AdminSelect,
  AdminTable,
  AdminTd,
  AdminTh,
  FilterButton,
  PillActive,
  PillExpired,
  SearchInput,
} from "@/components/admin/admin-ui";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import {
  CloseDriveModal,
  RejectResultModal,
  UploadResultModal,
  VerifyResultModal,
  openWhatsAppNotify,
} from "@/components/admin/result-drive-modals";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/http";
import { EDUCATION_LEVELS } from "@/lib/occupation-defaults";
import {
  STREAM_STANDARDS,
  meritGroups,
  nextStatusLabel,
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
 * "2026" -> "2025-26" — the fixed academic-year range shown next to every drive title.
 * The selected year is the END of the academic session (results declared in
 * 2026 belong to the 2025-26 session), so the range runs backward from it.
 */
function yearRangeSuffix(year: number): string {
  return `${year - 1}-${String(year).slice(-2)}`;
}

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
  const [closeDriveOpen, setCloseDriveOpen] = useState(false);
  const [closingDrive, setClosingDrive] = useState(false);

  const [standardQuery, setStandardQuery] = useState("");

  const [stdSearch, setStdSearch] = useState("");
  const [stdStatusFilter, setStdStatusFilter] = useState("all");
  const [percentSort, setPercentSort] = useState<"none" | "high" | "low">("none");
  const [stdFiltersOpen, setStdFiltersOpen] = useState(false);

  const params = useSearchParams();
  const activeStd = params.get("std");
  const viewParam = params.get("view");
  const view: "overview" | "standard" | "merit" | "final" =
    viewParam === "final" ? "final" : viewParam === "merit" ? "merit" : activeStd ? "standard" : "overview";

  useEffect(() => {
    setStdSearch("");
    setStdStatusFilter("all");
    setPercentSort("none");
  }, [activeStd]);

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

  const standards = useMemo(() => {
    const map = new Map<string, { total: number; approved: number; pending: number; rejected: number; uploaded: number }>();
    for (const r of roster) {
      const row = map.get(r.standard) ?? { total: 0, approved: 0, pending: 0, rejected: 0, uploaded: 0 };
      row.total += 1;
      if (r.status !== "none") row.uploaded += 1;
      if (r.status === "APPROVED") row.approved += 1;
      else if (r.status === "REJECTED" || r.status === "RESUBMIT") row.rejected += 1;
      else if (r.status === "PENDING") row.pending += 1;
      map.set(r.standard, row);
    }
    const extra = [...map.keys()].filter((s) => !LEVELS.includes(s)).sort();
    return [...LEVELS, ...extra].map((standard) => ({
      standard,
      ...(map.get(standard) ?? { total: 0, approved: 0, pending: 0, rejected: 0, uploaded: 0 }),
    }));
  }, [roster]);

  // The overview search box narrows down which standard cards show — it
  // never touches the counts on them, so it stays a pure display filter.
  const visibleStandards = useMemo(() => {
    const q = standardQuery.trim().toLowerCase();
    if (!q) return standards;
    return standards.filter((s) => s.standard.toLowerCase().includes(q));
  }, [standards, standardQuery]);

  const stdRows = useMemo(() => {
    if (!activeStd) return [];
    let rows = roster.filter((r) => r.standard === activeStd);
    if (STREAM_STANDARDS.has(activeStd) && streamFilter !== "all") {
      rows = rows.filter((r) => (r.stream || "") === streamFilter);
    }
    return rows;
  }, [roster, activeStd, streamFilter]);

  const displayStdRows = useMemo(() => {
    const sq = stdSearch.trim().toLowerCase();
    let rows = stdRows.filter((r) => {
      if (stdStatusFilter !== "all" && r.status !== stdStatusFilter) return false;
      if (
        sq &&
        ![
          r.studentName,
          r.studentNameEn,
          r.studentNameGu,
          r.familyLabel,
          r.familyLabelEn,
          r.familyLabelGu,
          r.mobile,
        ].some((v) => v?.toLowerCase().includes(sq))
      ) {
        return false;
      }
      return true;
    });
    if (percentSort !== "none") {
      rows = [...rows].sort((a, b) => {
        const av = a.percentage ?? -1;
        const bv = b.percentage ?? -1;
        return percentSort === "high" ? bv - av : av - bv;
      });
    }
    return rows;
  }, [stdRows, stdSearch, stdStatusFilter, percentSort]);

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

  const overviewSummary = useMemo(() => {
    const uploaded = roster.filter((r) => r.status !== "none").length;
    const approved = roster.filter((r) => r.status === "APPROVED").length;
    const rejected = roster.filter((r) => r.status === "REJECTED" || r.status === "RESUBMIT").length;
    const nextSet = roster.filter((r) => r.studyOutcome != null).length;
    return { total: roster.length, uploaded, approved, rejected, nextSet };
  }, [roster]);

  const driveOptions = useMemo(() => {
    const perYear = new Map<number, number>();
    for (const d of drives) perYear.set(d.year, (perYear.get(d.year) ?? 0) + 1);
    return [...drives]
      .sort((a, b) => b.year - a.year)
      .map((d) => ({
        value: d.id,
        label: (perYear.get(d.year) ?? 0) > 1 ? `${d.year} — ${d.titleEn}` : String(d.year),
        dot: d.isOpen,
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

  /** Only one drive may be live at a time — ask before silently closing whichever other one is open. */
  async function confirmIfAnotherLive(excludeId?: string) {
    const other = drives.find((d) => d.isOpen && d.id !== excludeId);
    if (!other) return true;
    return confirmDialog({
      title: "Another drive is already live",
      description: `"${other.titleGu || other.titleEn}" (${other.year}) is currently open for uploads. Continuing will close it — only one drive can be live at a time.`,
      confirmLabel: "Close it & continue",
      cancelLabel: "Cancel",
      tone: "danger",
    });
  }

  async function reopenDrive() {
    if (!currentDrive) return;
    if (!(await confirmIfAnotherLive(currentDrive.id))) return;
    await toggleDrive("isOpen");
  }

  const notUploaded = useMemo(() => roster.filter((r) => r.status === "none"), [roster]);
  const incompleteUploaded = useMemo(
    () => roster.filter((r) => r.status !== "none" && !(r.status === "APPROVED" && r.studyOutcome != null)),
    [roster],
  );

  async function confirmCloseDrive() {
    if (!currentDrive) return;
    setClosingDrive(true);
    const res = await api.patch(`/api/admin/result-drives`, { id: currentDrive.id, isOpen: false });
    setClosingDrive(false);
    if (!res.ok) return setError(res.error);
    setCloseDriveOpen(false);
    router.refresh();
  }

  async function createDrive() {
    if (!draft.titleEn.trim()) return setError("Title is required");
    if (!(await confirmIfAnotherLive())) return;
    setBusy(true);
    setError(null);
    const year = Number(draft.year);
    const suffix = yearRangeSuffix(year);
    const res = await api.post<{ id: string }>(`/api/admin/result-drives`, {
      titleEn: `${draft.titleEn.trim()} ${suffix}`,
      titleGu: draft.titleGu.trim() ? `${draft.titleGu.trim()} ${suffix}` : undefined,
      year,
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
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <AdminBtn
              variant={currentDrive.isOpen ? "danger" : "success"}
              onClick={() => (currentDrive.isOpen ? setCloseDriveOpen(true) : void reopenDrive())}
              className="whitespace-nowrap"
            >
              {currentDrive.isOpen ? (
                <Lock className="size-4 shrink-0" />
              ) : (
                <Unlock className="size-4 shrink-0" />
              )}
              {currentDrive.isOpen ? "Close drive" : "Reopen drive"}
            </AdminBtn>
            <AdminBtn
              variant={currentDrive.isPublished ? "danger" : "success"}
              onClick={() => toggleDrive("isPublished")}
              className="whitespace-nowrap"
            >
              {currentDrive.isPublished ? (
                <EyeOff className="size-4 shrink-0" />
              ) : (
                <FileOutput className="size-4 shrink-0" />
              )}
              {currentDrive.isPublished ? "Unpublish toppers" : "Publish toppers"}
            </AdminBtn>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto">
            <SearchInput
              value={standardQuery}
              onChange={setStandardQuery}
              placeholder="Search standard…"
              className="min-w-0 flex-1 md:w-[220px] md:flex-none"
            />
            <AdminSelect
              value={currentDrive.id}
              onChange={(v) => router.push(`/admin/results?drive=${v}`)}
              ariaLabel="Select drive year"
              className="w-[190px] shrink-0"
              options={driveOptions}
            />
          </div>
        </div>
      )}

      {error && <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>}

      {!currentDrive ? (
        <p className="py-8 text-center text-[13px] text-[var(--faint)]">
          No result drive yet. Create one to start collecting student results.
        </p>
      ) : (
        <>
          {view === "overview" && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {(
                  [
                    ["Students", overviewSummary.total, "var(--ink)"],
                    ["Uploaded", overviewSummary.uploaded, "var(--info)"],
                    ["Pending", pending, "var(--warn)"],
                    ["Approved", overviewSummary.approved, "var(--success)"],
                    ["Rejected", overviewSummary.rejected, "var(--danger)"],
                    ["Next status set", overviewSummary.nextSet, "var(--brand)"],
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
              <AdminH3>Standards</AdminH3>
              {visibleStandards.length === 0 ? (
                <p className="py-6 text-[13px] text-[var(--faint)]">
                  {standards.length === 0 ? "No standards yet." : "No standard matches your search."}
                </p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
                  {visibleStandards.map((s) => {
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

              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
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

                <div className="flex w-full items-center gap-2.5 md:w-auto">
                  <SearchInput
                    value={stdSearch}
                    onChange={setStdSearch}
                    placeholder="Search student / mobile / family…"
                    className="min-w-0 flex-1 md:w-[220px] md:flex-none"
                  />
                  <FilterButton
                    className="md:hidden"
                    active={stdStatusFilter !== "all" || percentSort !== "none"}
                    onClick={() => setStdFiltersOpen(true)}
                  />
                  <div className="hidden items-center gap-2.5 md:flex">
                    <AdminSelect
                      value={stdStatusFilter}
                      onChange={setStdStatusFilter}
                      ariaLabel="Filter by verification status"
                      className="w-[150px] shrink-0"
                      options={[
                        { value: "all", label: "All status" },
                        { value: "none", label: "Not uploaded" },
                        { value: "PENDING", label: "Pending" },
                        { value: "APPROVED", label: "Approved" },
                        { value: "REJECTED", label: "Rejected" },
                      ]}
                    />
                    <AdminSelect
                      value={percentSort}
                      onChange={(v) => setPercentSort(v as "none" | "high" | "low")}
                      ariaLabel="Sort by percentage"
                      className="w-[170px] shrink-0"
                      options={[
                        { value: "none", label: "Sort: default" },
                        { value: "high", label: "% High to low" },
                        { value: "low", label: "% Low to high" },
                      ]}
                    />
                  </div>
                </div>
              </div>

              <Sheet open={stdFiltersOpen} onOpenChange={setStdFiltersOpen}>
                <SheetContent side="bottom" className="md:hidden">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-3 px-4 pb-4">
                    <AdminSelect
                      value={stdStatusFilter}
                      onChange={setStdStatusFilter}
                      ariaLabel="Filter by verification status"
                      className="w-full"
                      options={[
                        { value: "all", label: "All status" },
                        { value: "none", label: "Not uploaded" },
                        { value: "PENDING", label: "Pending" },
                        { value: "APPROVED", label: "Approved" },
                        { value: "REJECTED", label: "Rejected" },
                      ]}
                    />
                    <AdminSelect
                      value={percentSort}
                      onChange={(v) => setPercentSort(v as "none" | "high" | "low")}
                      ariaLabel="Sort by percentage"
                      className="w-full"
                      options={[
                        { value: "none", label: "Sort: default" },
                        { value: "high", label: "% High to low" },
                        { value: "low", label: "% Low to high" },
                      ]}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              {stdRows.length === 0 ? (
                <p className="py-6 text-[13px] text-[var(--faint)]">No students in this standard.</p>
              ) : displayStdRows.length === 0 ? (
                <p className="py-6 text-[13px] text-[var(--faint)]">No students match your search or filters.</p>
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
                        <AdminTh>Next status</AdminTh>
                        <AdminTh>Updated</AdminTh>
                        <AdminTh className="text-right whitespace-nowrap">Actions</AdminTh>
                      </tr>
                    </thead>
                    <tbody>
                      {displayStdRows.map((r) => {
                        const meta = rosterStatusMeta(r.status);
                        const sc = r.stream ? streamColors(r.stream) : null;
                        const rankKey = r.entryId ?? r.memberId ?? r.studentName;
                        const rank = ranks.get(rankKey);
                        return (
                          <tr key={`${r.memberId ?? r.entryId ?? r.studentName}`}>
                            <AdminTd>
                              <b>{r.studentNameEn || r.studentName}</b>
                              {r.studentNameGu && r.studentNameGu !== (r.studentNameEn || r.studentName) ? (
                                <div className="mt-0.5 text-[12px] font-medium text-[var(--ink-dim)]">
                                  {r.studentNameGu}
                                </div>
                              ) : null}
                            </AdminTd>
                            <AdminTd>
                              {r.familyLabelEn || r.familyLabel}
                              {r.familyLabelGu && r.familyLabelGu !== (r.familyLabelEn || r.familyLabel) ? (
                                <div className="mt-0.5 text-[12px] font-medium text-[var(--ink-dim)]">
                                  {r.familyLabelGu}
                                </div>
                              ) : null}
                            </AdminTd>
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
                            <AdminTd>
                              {r.status === "none" ? (
                                "—"
                              ) : (
                                <span
                                  className="font-semibold"
                                  style={{ color: r.studyOutcome ? "#1E9E52" : "#B0801E" }}
                                >
                                  {nextStatusLabel(r)}
                                </span>
                              )}
                            </AdminTd>
                            <AdminTd>{r.updatedAt ? formatDate(r.updatedAt, "en") : "—"}</AdminTd>
                            <AdminTd className="whitespace-nowrap">
                              {r.status === "none" ? (
                                adminUploadEnabled ? (
                                  <div className="flex flex-nowrap items-center justify-end gap-1.5">
                                    <ActionBtn
                                      icon={Upload}
                                      label="Upload result"
                                      onClick={() => setUploadRow(r)}
                                    />
                                  </div>
                                ) : (
                                  "—"
                                )
                              ) : (
                                <div className="flex flex-nowrap items-center justify-end gap-1.5">
                                  <ActionBtn
                                    icon={Eye}
                                    label="View"
                                    onClick={() => setVerify({ row: r, viewOnly: true })}
                                  />
                                  <ActionBtn
                                    icon={CheckCircle2}
                                    label="Verify"
                                    tone="success"
                                    onClick={() => setVerify({ row: r, viewOnly: false })}
                                  />
                                  <ActionBtn
                                    icon={Pencil}
                                    label="Edit"
                                    onClick={() => setUploadRow(r)}
                                  />
                                  {(r.status === "REJECTED" || r.status === "RESUBMIT") && adminUploadEnabled && (
                                    <ActionBtn
                                      icon={RotateCw}
                                      label="Replace"
                                      tone="warn"
                                      onClick={() => setUploadRow(r)}
                                    />
                                  )}
                                </div>
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

      {currentDrive && (
        <CloseDriveModal
          open={closeDriveOpen}
          driveTitle={currentDrive.titleGu || currentDrive.titleEn}
          notUploaded={notUploaded}
          incomplete={incompleteUploaded}
          onClose={() => setCloseDriveOpen(false)}
          onConfirm={() => void confirmCloseDrive()}
          busy={closingDrive}
        />
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-[380px] rounded-2xl sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">New result drive</DialogTitle>
          </DialogHeader>
          <div>
            <AdminLabel>Year *</AdminLabel>
            <AdminInput
              type="number"
              value={draft.year}
              onChange={(v) => setDraft((prev) => ({ ...prev, year: v }))}
            />
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
            <p className="mt-2 text-[12px] font-medium text-[var(--faint)]">
              Saved as: <b className="text-[var(--ink)]">{draft.titleEn.trim() || "…"} {yearRangeSuffix(Number(draft.year) || new Date().getFullYear())}</b>
            </p>
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
