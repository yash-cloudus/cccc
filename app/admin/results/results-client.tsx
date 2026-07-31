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
import {
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
import { useAdminT } from "@/lib/i18n/admin-dictionary";
import { DEFAULT_STREAMS, EDUCATION_LEVELS } from "@/lib/occupation-defaults";
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
import { formatDate, pickText } from "@/lib/format";

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

const STATUS_KEYS = {
  none: "res.stNone",
  PENDING: "res.stPending",
  APPROVED: "res.stApproved",
  REJECTED: "res.stRejected",
  RESUBMIT: "res.stResubmit",
} as const;

/** Display name for a standard / stream — the seed lists carry both languages. */
function levelLabel(value: string, lang: string): string {
  const m = EDUCATION_LEVELS.find((l) => l.nameEn === value || l.nameGu === value);
  return m ? (lang === "gu" ? m.nameGu : m.nameEn) : value;
}

function streamLabel(value: string, lang: string): string {
  const m = DEFAULT_STREAMS.find((s) => s.nameEn === value || s.nameGu === value);
  return m ? (lang === "gu" ? m.nameGu : m.nameEn) : value;
}

/**
 * Ranked merit tables — one per stream for Std 11/12, one overall otherwise.
 * Shared by the per-standard merit list and the whole-drive final report so the
 * two can never disagree about who ranked where.
 */
function MeritSections({ groups }: { groups: MeritGroup[] }) {
  const { t, lang } = useAdminT();
  const split = groups.length > 1 || groups[0]?.stream != null;
  return (
    <>
      {groups.map((g) => (
        <section key={g.stream ?? "unassigned"} className={split ? "mb-4 last:mb-0" : undefined}>
          {split && (
            <div className="mb-1.5 text-[13px] font-extrabold text-[var(--ink)]">
              {g.stream ? streamLabel(g.stream, lang) : t("res.streamNotRecorded")}
            </div>
          )}
          <AdminTable bordered={false}>
            <thead>
              <tr>
                <AdminTh>{t("res.thRank")}</AdminTh>
                <AdminTh>{t("res.thStudentName")}</AdminTh>
                <AdminTh>{t("res.thPercentage")}</AdminTh>
                <AdminTh>{t("res.thSchool")}</AdminTh>
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
  const { t, tf, lang } = useAdminT();
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
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      roster.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (
          q &&
          ![
            r.studentName,
            r.studentNameEn,
            r.studentNameGu,
            r.familyLabel,
            r.familyLabelEn,
            r.familyLabelGu,
            r.mobile,
            r.schoolName,
          ].some((v) => v?.toLowerCase().includes(q))
        ) {
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

  const driveOptions = useMemo(() => {
    const perYear = new Map<number, number>();
    for (const d of drives) perYear.set(d.year, (perYear.get(d.year) ?? 0) + 1);
    return [...drives]
      .sort((a, b) => b.year - a.year)
      .map((d) => ({
        value: d.id,
        label:
          (perYear.get(d.year) ?? 0) > 1
            ? `${d.year} — ${pickText(d.titleGu, d.titleEn, lang)}`
            : String(d.year),
      }));
  }, [drives, lang]);

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
    if (!draft.titleEn.trim()) return setError(t("res.titleRequired"));
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
      label: v === "all" ? t("res.tabAll") : streamLabel(v, lang),
      count: roster.filter(
        (r) => r.standard === activeStd && (v === "all" || (r.stream || "") === v),
      ).length,
    }));
  }, [activeStd, roster, t, lang]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminH2 className="mb-0">
          {t("nav.results")}{" "}
          {currentDrive ? (
            <>
              — {pickText(currentDrive.titleGu, currentDrive.titleEn, lang)}{" "}
              {currentDrive.isOpen ? (
                <PillActive>{t("res.driveOpen")}</PillActive>
              ) : (
                <PillExpired>{t("res.driveClosed")}</PillExpired>
              )}
            </>
          ) : null}
        </AdminH2>
        <span className="flex gap-2">
          <AdminBtn variant="ghost" onClick={() => { setNewOpen(true); setError(null); }}>
            <Plus className="size-4" />
            {t("res.newDrive")}
          </AdminBtn>
          <AdminBtn onClick={() => go({ view: "final", std: null })}>🏆 {t("res.finalResult")}</AdminBtn>
        </span>
      </div>

      {currentDrive && view === "overview" && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <AdminBtn
              variant={currentDrive.isOpen ? "danger" : "success"}
              onClick={() => toggleDrive("isOpen")}
              className="whitespace-nowrap"
            >
              {currentDrive.isOpen ? (
                <Lock className="size-4 shrink-0" />
              ) : (
                <Unlock className="size-4 shrink-0" />
              )}
              {currentDrive.isOpen ? t("res.closeDrive") : t("res.reopenDrive")}
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
              {currentDrive.isPublished ? t("res.unpublishToppers") : t("res.publishToppers")}
            </AdminBtn>
          </div>

          <div className="flex w-full items-center gap-2.5 md:w-auto">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t("res.searchPlaceholder")}
              className="min-w-0 flex-1 md:w-[220px] md:flex-none"
            />
            <FilterButton
              className="md:hidden"
              active={statusFilter !== "all" || levelFilter !== "all"}
              onClick={() => setFiltersOpen(true)}
            />
            <div className="hidden items-center gap-2.5 md:flex">
              <AdminSelect
                value={currentDrive.id}
                onChange={(v) => router.push(`/admin/results?drive=${v}`)}
                ariaLabel={t("res.selectDriveYear")}
                className="w-[110px] shrink-0"
                options={driveOptions}
              />
              <AdminSelect
                value={statusFilter}
                onChange={setStatusFilter}
                ariaLabel={t("res.filterByStatus")}
                className="w-[150px] shrink-0"
                options={[
                  { value: "all", label: t("res.stAll") },
                  { value: "none", label: t("res.stNone") },
                  { value: "PENDING", label: t("res.stPending") },
                  { value: "APPROVED", label: t("res.stApproved") },
                  { value: "REJECTED", label: t("res.stRejected") },
                ]}
              />
              <AdminSelect
                value={levelFilter}
                onChange={setLevelFilter}
                ariaLabel={t("res.filterByLevel")}
                className="w-[180px] shrink-0"
                options={[
                  { value: "all", label: t("res.allLevels") },
                  ...LEVELS.map((l) => ({ value: l, label: levelLabel(l, lang) })),
                ]}
              />
            </div>
          </div>
        </div>
      )}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>{t("res.filters")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div>
              <AdminLabel>{t("res.driveYear")}</AdminLabel>
              <AdminSelect
                value={currentDrive?.id ?? ""}
                onChange={(v) => router.push(`/admin/results?drive=${v}`)}
                ariaLabel={t("res.selectDriveYear")}
                className="w-full"
                options={driveOptions}
              />
            </div>
            <AdminSelect
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel={t("res.filterByStatus")}
              className="w-full"
              options={[
                { value: "all", label: t("res.stAll") },
                { value: "none", label: t("res.stNone") },
                { value: "PENDING", label: t("res.stPending") },
                { value: "APPROVED", label: t("res.stApproved") },
                { value: "REJECTED", label: t("res.stRejected") },
              ]}
            />
            <AdminSelect
              value={levelFilter}
              onChange={setLevelFilter}
              ariaLabel={t("res.filterByLevel")}
              className="w-full"
              options={[
                { value: "all", label: t("res.allLevels") },
                ...LEVELS.map((l) => ({ value: l, label: levelLabel(l, lang) })),
              ]}
            />
          </div>
        </SheetContent>
      </Sheet>

      {error && <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>}

      {!currentDrive ? (
        <p className="py-8 text-center text-[13px] text-[var(--faint)]">
          {t("res.noDrive")}
        </p>
      ) : (
        <>
          {view === "overview" && (
            <>
              <AdminH3>
                {tf("res.standardsSummary", {
                  pending,
                  uploaded: roster.filter((r) => r.status !== "none").length,
                })}
              </AdminH3>
              {standards.length === 0 ? (
                <p className="py-6 text-[13px] text-[var(--faint)]">{t("res.noStandards")}</p>
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
                          <span className="text-[15px] font-extrabold text-[var(--ink)]">
                            {levelLabel(s.standard, lang)}
                          </span>
                          <span className="text-[11.5px] font-semibold text-[var(--faint)]">
                            {tf(s.total === 1 ? "res.studentOne" : "res.studentMany", { n: s.total })}
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
                          <span>{tf("res.pctReviewed", { n: completion })}</span>
                          <span className="text-[var(--brand)]">{t("res.openCard")} →</span>
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
                  ‹ {t("res.backToDashboard")}
                </AdminBtn>
                <AdminBtn onClick={() => window.print()}>🖨 {t("res.printFinal")}</AdminBtn>
              </div>
              <div className="rounded-2xl border border-[var(--line-admin)] bg-white p-6">
                <h3 className="text-center text-[18px] font-extrabold text-[var(--ink)]">
                  {t("res.meritReport")} — {pickText(currentDrive.titleGu, currentDrive.titleEn, lang)}
                </h3>
                <p className="mb-4 text-center text-[12.5px] text-[var(--faint)]">
                  {tf("res.academicYearColon", { year: currentDrive.year })}
                </p>
                {finalStandards.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[var(--faint)]">{t("res.noApproved")}</p>
                ) : (
                  finalStandards.map((std) => (
                    <section key={std} className="mb-5">
                      <h4 className="mb-1 rounded-[10px] bg-[#FBFAF7] px-3.5 py-2 text-[14px] font-extrabold text-[var(--ink)]">
                        {levelLabel(std, lang)}
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
                  ‹ {tf("res.backTo", { name: levelLabel(activeStd, lang) })}
                </AdminBtn>
                <AdminBtn onClick={() => window.print()}>🖨 {t("res.printPdf")}</AdminBtn>
              </div>
              <div className="rounded-2xl border border-[var(--line-admin)] bg-white p-6">
                <h3 className="text-center text-[18px] font-extrabold text-[var(--ink)]">
                  {t("res.meritList")} — {levelLabel(activeStd, lang)}
                </h3>
                <p className="mb-4 text-center text-[12.5px] text-[var(--faint)]">
                  {pickText(currentDrive.titleGu, currentDrive.titleEn, lang)} ·{" "}
                  {tf("res.academicYear", { year: currentDrive.year })}
                </p>
                {merit.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[var(--faint)]">{t("res.noApproved")}</p>
                ) : (
                  <MeritSections groups={merit} />
                )}
              </div>
            </>
          )}

          {view === "standard" && activeStd && (
            <>
              <AdminBtn variant="ghost" className="mb-2.5" onClick={() => go({ std: null, view: null })}>
                ‹ {t("res.backToDashboard")}
              </AdminBtn>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <AdminH3 className="mb-0">{levelLabel(activeStd, lang)}</AdminH3>
                {stdSummary.allDone && (
                  <AdminBtn onClick={() => go({ view: "merit" })}>🏅 {t("res.viewMeritList")}</AdminBtn>
                )}
              </div>

              {stdSummary.allDone && (
                <div className="mb-4 rounded-xl border border-[#B7E6C6] bg-[#F0FBF3] px-4 py-3 text-[13px] font-bold text-[#1E7A44]">
                  ✓ {t("res.resultCompleted")}
                </div>
              )}

              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(
                  [
                    ["res.statStudents", stdSummary.total, "var(--ink)"],
                    ["res.statUploaded", stdSummary.uploaded, "var(--info)"],
                    ["res.stPending", stdSummary.pending, "var(--warn)"],
                    ["res.stApproved", stdSummary.approved, "var(--success)"],
                    ["res.stRejected", stdSummary.rejected, "var(--danger)"],
                  ] as const
                ).map(([label, value, color]) => (
                  <div key={label} className="rounded-[14px] border border-[var(--line-admin)] bg-[#FBFAF7] p-3">
                    <div className="text-[22px] font-extrabold" style={{ color }}>
                      {value}
                    </div>
                    <div className="text-[11.5px] text-[var(--faint)]">{t(label)}</div>
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
                    placeholder={t("res.searchPlaceholder")}
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
                      ariaLabel={t("res.filterByVerification")}
                      className="w-[150px] shrink-0"
                      options={[
                        { value: "all", label: t("res.stAll") },
                        { value: "none", label: t("res.stNone") },
                        { value: "PENDING", label: t("res.stPending") },
                        { value: "APPROVED", label: t("res.stApproved") },
                        { value: "REJECTED", label: t("res.stRejected") },
                      ]}
                    />
                    <AdminSelect
                      value={percentSort}
                      onChange={(v) => setPercentSort(v as "none" | "high" | "low")}
                      ariaLabel={t("res.sortByPercent")}
                      className="w-[170px] shrink-0"
                      options={[
                        { value: "none", label: t("res.sortDefault") },
                        { value: "high", label: t("res.sortHigh") },
                        { value: "low", label: t("res.sortLow") },
                      ]}
                    />
                  </div>
                </div>
              </div>

              <Sheet open={stdFiltersOpen} onOpenChange={setStdFiltersOpen}>
                <SheetContent side="bottom" className="md:hidden">
                  <SheetHeader>
                    <SheetTitle>{t("res.filters")}</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-3 px-4 pb-4">
                    <AdminSelect
                      value={stdStatusFilter}
                      onChange={setStdStatusFilter}
                      ariaLabel={t("res.filterByVerification")}
                      className="w-full"
                      options={[
                        { value: "all", label: t("res.stAll") },
                        { value: "none", label: t("res.stNone") },
                        { value: "PENDING", label: t("res.stPending") },
                        { value: "APPROVED", label: t("res.stApproved") },
                        { value: "REJECTED", label: t("res.stRejected") },
                      ]}
                    />
                    <AdminSelect
                      value={percentSort}
                      onChange={(v) => setPercentSort(v as "none" | "high" | "low")}
                      ariaLabel={t("res.sortByPercent")}
                      className="w-full"
                      options={[
                        { value: "none", label: t("res.sortDefault") },
                        { value: "high", label: t("res.sortHigh") },
                        { value: "low", label: t("res.sortLow") },
                      ]}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              {stdRows.length === 0 ? (
                <p className="py-6 text-[13px] text-[var(--faint)]">{t("res.noStudentsInStd")}</p>
              ) : displayStdRows.length === 0 ? (
                <p className="py-6 text-[13px] text-[var(--faint)]">{t("res.noStudentsMatch")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <AdminTable>
                    <thead>
                      <tr>
                        <AdminTh>{t("res.thStudent")}</AdminTh>
                        <AdminTh>{t("res.thFamily")}</AdminTh>
                        <AdminTh>{t("res.thMobile")}</AdminTh>
                        {STREAM_STANDARDS.has(activeStd) && <AdminTh>{t("res.thStream")}</AdminTh>}
                        <AdminTh>{t("res.thUpload")}</AdminTh>
                        <AdminTh>{t("res.thVerification")}</AdminTh>
                        <AdminTh>%</AdminTh>
                        <AdminTh>{t("res.thRank")}</AdminTh>
                        <AdminTh>{t("res.thUpdated")}</AdminTh>
                        <AdminTh className="text-right whitespace-nowrap">{t("res.thActions")}</AdminTh>
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
                                    {streamLabel(r.stream, lang)}
                                  </span>
                                ) : null}
                              </AdminTd>
                            )}
                            <AdminTd>
                              <span
                                className="font-bold"
                                style={{ color: r.status === "none" ? "#B0303A" : "#1E9E52" }}
                              >
                                {r.status === "none" ? t("res.stNone") : t("res.uploaded")}
                              </span>
                            </AdminTd>
                            <AdminTd>
                              <span
                                className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
                                style={{ background: meta.bg, color: meta.fg }}
                              >
                                {t(STATUS_KEYS[r.status])}
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
                            <AdminTd>{r.updatedAt ? formatDate(r.updatedAt, lang) : "—"}</AdminTd>
                            <AdminTd className="whitespace-nowrap">
                              {r.status === "none" ? (
                                adminUploadEnabled ? (
                                  <div className="flex flex-nowrap items-center justify-end gap-1.5">
                                    <ActionBtn
                                      icon={Upload}
                                      label={t("res.uploadResult")}
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
                                    label={t("common.view")}
                                    onClick={() => setVerify({ row: r, viewOnly: true })}
                                  />
                                  <ActionBtn
                                    icon={CheckCircle2}
                                    label={t("res.verify")}
                                    tone="success"
                                    onClick={() => setVerify({ row: r, viewOnly: false })}
                                  />
                                  <ActionBtn
                                    icon={Pencil}
                                    label={t("common.edit")}
                                    onClick={() => setUploadRow(r)}
                                  />
                                  {(r.status === "REJECTED" || r.status === "RESUBMIT") && adminUploadEnabled && (
                                    <ActionBtn
                                      icon={RotateCw}
                                      label={t("res.replace")}
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

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-[380px] rounded-2xl sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">{t("res.newDriveTitle")}</DialogTitle>
          </DialogHeader>
          <div>
            <AdminLabel>{t("res.titleEn")}</AdminLabel>
            <AdminInput
              value={draft.titleEn}
              onChange={(v) => {
                setDraft((prev) => ({ ...prev, titleEn: v }));
                fromEn(v, (gu) => setDraft((prev) => ({ ...prev, titleGu: gu })));
              }}
            />
            <AdminLabel>{t("res.titleGu")}</AdminLabel>
            <AdminInput
              gujarati
              value={draft.titleGu}
              onChange={(v) => {
                setDraft((prev) => ({ ...prev, titleGu: v }));
                guInput(v, (gu) => setDraft((prev) => ({ ...prev, titleGu: gu })), "gu");
              }}
            />
            <AdminLabel>{t("res.year")}</AdminLabel>
            <AdminInput type="number" value={draft.year} onChange={(v) => setDraft({ ...draft, year: v })} />
            {error && <p className="mt-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
            <div className="mt-4 flex gap-2.5">
              <AdminBtn className="flex-1 justify-center" onClick={createDrive}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : t("res.createDrive")}
              </AdminBtn>
              <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setNewOpen(false)}>
                {t("common.cancel")}
              </AdminBtn>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
