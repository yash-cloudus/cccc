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
  StatusPill,
} from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/http";
import { EDUCATION_LEVELS } from "@/lib/occupation-defaults";
import { useTranslitSync } from "@/hooks/use-translit-sync";

export type DriveInfo = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  year: number;
  isOpen: boolean;
  isPublished: boolean;
  entries: number;
};

export type EntryRow = {
  id: string;
  studentName: string;
  standard: string;
  schoolName: string | null;
  totalMarks: number | null;
  obtainedMarks: number | null;
  percentage: number | null;
  isEligible: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RESUBMIT";
  marksheetUrl: string | null;
};

/** Every standard a drive can have a box for, shown even with zero students. */
const LEVELS = EDUCATION_LEVELS.map((l) => l.nameEn);

const lower = (s: EntryRow["status"]) =>
  (s === "APPROVED" ? "approved" : s === "REJECTED" ? "rejected" : "pending") as
    | "approved"
    | "rejected"
    | "pending";

export function ResultsClient({
  drives,
  currentDrive,
  entries: initialEntries,
}: {
  drives: DriveInfo[];
  currentDrive: DriveInfo | null;
  entries: EntryRow[];
}) {
  const router = useRouter();
  const { fromEn, guInput } = useTranslitSync();
  const [entries, setEntries] = useState<EntryRow[]>(initialEntries);
  const [marks, setMarks] = useState<Record<string, { total: string; obtained: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({ titleEn: "", titleGu: "", year: String(new Date().getFullYear()) });
  const [busy, setBusy] = useState(false);

  function setMark(id: string, field: "total" | "obtained", value: string) {
    setMarks((prev) => ({ ...prev, [id]: { ...(prev[id] || { total: "", obtained: "" }), [field]: value } }));
  }

  async function review(entry: EntryRow, status: EntryRow["status"]) {
    setBusyId(entry.id);
    setError(null);
    const m = marks[entry.id];
    const payload: Record<string, unknown> = { id: entry.id, status };
    if (m?.total) payload.totalMarks = Number(m.total);
    if (m?.obtained) payload.obtainedMarks = Number(m.obtained);
    if (status === "REJECTED") payload.rejectReason = "Not eligible";
    const res = await api.patch<{ percentage: number | null; isEligible: boolean }>(`/api/results`, payload);
    setBusyId(null);
    if (!res.ok) return setError(res.error);
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id
          ? {
              ...e,
              status,
              totalMarks: m?.total ? Number(m.total) : e.totalMarks,
              obtainedMarks: m?.obtained ? Number(m.obtained) : e.obtainedMarks,
              percentage: res.data.percentage ?? e.percentage,
              isEligible: res.data.isEligible ?? e.isEligible,
            }
          : e,
      ),
    );
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

  const pending = entries.filter((e) => e.status === "PENDING").length;

  /* ── Toolbar filters ── */
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (statusFilter !== "all" && e.status !== statusFilter) return false;
        if (q && ![e.studentName, e.schoolName].some((v) => v?.toLowerCase().includes(q))) {
          return false;
        }
        return true;
      }),
    [entries, statusFilter, q],
  );

  /**
   * Drill-down lives in the URL (?std= / ?view=) rather than in state, so
   * "Open →" is a real navigation the browser Back button can undo.
   */
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

  const standards = useMemo(() => {
    const map = new Map<string, { total: number; approved: number; pending: number; rejected: number }>();
    for (const e of filtered) {
      const row = map.get(e.standard) ?? { total: 0, approved: 0, pending: 0, rejected: 0 };
      row.total += 1;
      if (e.status === "APPROVED") row.approved += 1;
      else if (e.status === "REJECTED") row.rejected += 1;
      else row.pending += 1;
      map.set(e.standard, row);
    }
    // Standards nobody seeded (free-typed on an entry) still get a box, after the known levels.
    const extra = [...map.keys()].filter((s) => !LEVELS.includes(s)).sort();
    return [...LEVELS, ...extra]
      .filter((s) => levelFilter === "all" || s === levelFilter)
      .map((standard) => ({
        standard,
        ...(map.get(standard) ?? { total: 0, approved: 0, pending: 0, rejected: 0 }),
      }));
  }, [filtered, levelFilter]);

  const stdEntries = useMemo(
    () => (activeStd ? filtered.filter((e) => e.standard === activeStd) : filtered),
    [filtered, activeStd],
  );

  const stdSummary = useMemo(() => {
    const uploaded = stdEntries.filter((e) => e.marksheetUrl).length;
    return {
      total: stdEntries.length,
      uploaded,
      pending: stdEntries.filter((e) => e.status === "PENDING").length,
      approved: stdEntries.filter((e) => e.status === "APPROVED").length,
      rejected: stdEntries.filter((e) => e.status === "REJECTED").length,
    };
  }, [stdEntries]);

  /** Ranked approved entries of one standard — used by both merit views. */
  const meritOf = useCallback(
    (std: string) =>
      entries
        .filter((e) => e.standard === std && e.status === "APPROVED" && e.percentage != null)
        .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
        .map((e, i) => ({ ...e, rank: i + 1 })),
    [entries],
  );

  /** Standards that actually have a merit list, for the final report. */
  const finalStandards = useMemo(
    () => standards.map((s) => s.standard).filter((s) => meritOf(s).length > 0),
    [standards, meritOf],
  );

  const merit = activeStd ? meritOf(activeStd) : [];

  const openStandard = (std: string) => go({ std, view: null });
  const backToOverview = () => go({ std: null, view: null });

  /** One option per drive; the year alone unless that year has several drives. */
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
            placeholder="Search student / school…"
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
              { value: "PENDING", label: "Pending" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
            ]}
          />
          <AdminSelect
            value={levelFilter}
            onChange={setLevelFilter}
            className="w-auto"
            options={[
              { value: "all", label: "All education levels" },
              ...LEVELS.map((l) => ({ value: l, label: l })),
            ]}
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

          {/* ── Level 1: standards overview ── */}
          {view === "overview" && (
            <>
              <AdminH3>
                Standards — {pending} pending / {entries.length} total
              </AdminH3>
              {standards.length === 0 ? (
                <p className="py-6 text-[13px] text-[var(--faint)]">No entries submitted yet.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
                  {standards.map((s) => {
                    const completion = s.total
                      ? Math.round(((s.approved + s.rejected) / s.total) * 100)
                      : 0;
                    return (
                      <button
                        key={s.standard}
                        type="button"
                        onClick={() => openStandard(s.standard)}
                        className="cursor-pointer rounded-2xl border border-[var(--line-admin)] bg-white p-4 text-left hover:border-[var(--brand-border)]"
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-[15px] font-extrabold text-[var(--ink)]">
                            {s.standard}
                          </span>
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

          {/* ── Final result: every standard's merit list in one report ── */}
          {view === "final" && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <AdminBtn variant="ghost" onClick={backToOverview}>
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
                  <p className="py-6 text-center text-[13px] text-[var(--faint)]">
                    No approved results yet.
                  </p>
                ) : (
                  finalStandards.map((std) => (
                    <section key={std} className="mb-5">
                      <h4 className="mb-1 rounded-[10px] bg-[#FBFAF7] px-3.5 py-2 text-[14px] font-extrabold text-[var(--ink)]">
                        {std}
                      </h4>
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
                          {meritOf(std).map((m) => (
                            <tr key={m.id}>
                              <AdminTd className="font-extrabold text-[var(--brand)]">{m.rank}</AdminTd>
                              <AdminTd className="font-semibold text-[var(--ink)]">
                                {m.studentName}
                              </AdminTd>
                              <AdminTd>{m.percentage?.toFixed(2)}%</AdminTd>
                              <AdminTd>{m.schoolName || "—"}</AdminTd>
                            </tr>
                          ))}
                        </tbody>
                      </AdminTable>
                    </section>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── Level 3: merit list ── */}
          {view === "merit" && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <AdminBtn variant="ghost" onClick={() => go({ view: null })}>
                  ‹ Back to {activeStd}
                </AdminBtn>
                <AdminBtn onClick={() => window.print()}>🖨 Print / Download PDF</AdminBtn>
              </div>

              <div className="rounded-2xl border border-[var(--line-admin)] bg-white p-6">
                <h3 className="text-center text-[18px] font-extrabold text-[var(--ink)]">
                  Merit List — {activeStd}
                </h3>
                <p className="mb-4 text-center text-[12.5px] text-[var(--faint)]">
                  {currentDrive.titleGu || currentDrive.titleEn} · Academic Year {currentDrive.year}
                </p>
                {merit.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[var(--faint)]">
                    No approved results yet.
                  </p>
                ) : (
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
                      {merit.map((m) => (
                        <tr key={m.id}>
                          <AdminTd className="font-extrabold text-[var(--brand)]">{m.rank}</AdminTd>
                          <AdminTd className="font-semibold text-[var(--ink)]">
                            {m.studentName}
                          </AdminTd>
                          <AdminTd>{m.percentage?.toFixed(2)}%</AdminTd>
                          <AdminTd>{m.schoolName || "—"}</AdminTd>
                        </tr>
                      ))}
                    </tbody>
                  </AdminTable>
                )}
              </div>
            </>
          )}

          {/* ── Level 2: one standard's students ── */}
          {view === "standard" && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <AdminBtn variant="ghost" onClick={backToOverview}>
                  ‹ Back to dashboard
                </AdminBtn>
                <AdminBtn variant="ghost" onClick={() => go({ view: "merit" })}>
                  🏅 View merit list
                </AdminBtn>
              </div>

              <AdminH3
                info={
                  <>
                    Enter total + obtained marks then Save — percentage auto-calculates. ≥80% →
                    eligible for felicitation 🎁.
                  </>
                }
              >
                {activeStd}
              </AdminH3>

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
                  <div
                    key={label}
                    className="rounded-[14px] border border-[var(--line-admin)] bg-[#FBFAF7] p-3"
                  >
                    <div className="text-[22px] font-extrabold" style={{ color }}>
                      {value}
                    </div>
                    <div className="text-[11.5px] text-[var(--faint)]">{label}</div>
                  </div>
                ))}
              </div>

          {stdEntries.length === 0 ? (
            <p className="py-6 text-[13px] text-[var(--faint)]">No students in this standard.</p>
          ) : (
            <AdminTable>
              <thead>
                <tr>
                  <AdminTh>Student</AdminTh>
                  <AdminTh>Std</AdminTh>
                  <AdminTh>Total</AdminTh>
                  <AdminTh>Obtained</AdminTh>
                  <AdminTh>%</AdminTh>
                  <AdminTh>Status</AdminTh>
                  <AdminTh>Action</AdminTh>
                </tr>
              </thead>
              <tbody>
                {stdEntries.map((e) => {
                  const m = marks[e.id] || {
                    total: e.totalMarks?.toString() ?? "",
                    obtained: e.obtainedMarks?.toString() ?? "",
                  };
                  return (
                    <tr key={e.id}>
                      <AdminTd>
                        <b>{e.studentName}</b>
                        {e.schoolName ? <div className="text-[11px] text-[var(--faint)]">{e.schoolName}</div> : null}
                      </AdminTd>
                      <AdminTd>{e.standard}</AdminTd>
                      <AdminTd>
                        <input
                          type="number"
                          value={m.total}
                          onChange={(ev) => setMark(e.id, "total", ev.target.value)}
                          className="h-8 w-16 rounded-lg border border-[var(--line-field)] bg-[var(--field)] px-2 text-[12.5px] outline-none"
                        />
                      </AdminTd>
                      <AdminTd>
                        <input
                          type="number"
                          value={m.obtained}
                          onChange={(ev) => setMark(e.id, "obtained", ev.target.value)}
                          className="h-8 w-16 rounded-lg border border-[var(--line-field)] bg-[var(--field)] px-2 text-[12.5px] outline-none"
                        />
                      </AdminTd>
                      <AdminTd>
                        {e.percentage != null ? (
                          <span className={e.isEligible ? "font-bold text-[#22A45D]" : ""}>
                            {e.percentage}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </AdminTd>
                      <AdminTd>
                        <StatusPill status={lower(e.status)} />
                      </AdminTd>
                      <AdminTd>
                        <span className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => review(e, "APPROVED")}
                            disabled={busyId === e.id}
                            className="cursor-pointer rounded-[9px] bg-[var(--success-tint)] px-[10px] py-[5px] text-[11.5px] font-extrabold text-[var(--success)] disabled:opacity-60"
                          >
                            {busyId === e.id ? "…" : "Save ✓"}
                          </button>
                          <button
                            type="button"
                            onClick={() => review(e, "REJECTED")}
                            disabled={busyId === e.id}
                            className="cursor-pointer rounded-[9px] bg-[var(--danger-tint)] px-[10px] py-[5px] text-[11.5px] font-extrabold text-[var(--danger)] disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </span>
                      </AdminTd>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          )}
            </>
          )}
        </>
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
