"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  Eye,
  GraduationCap,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Printer,
  RotateCw,
  Trophy,
  Unlock,
  Upload,
} from "lucide-react";
import {
  ActionBtn,
  AdminBtn,
  AdminH2,
  AdminH3,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/http";
import { useAdminT } from "@/lib/i18n/admin-dictionary";
import { DEFAULT_STREAMS, EDUCATION_LEVELS, type OccupationTreeNode } from "@/lib/occupation-defaults";
import {
  DEFAULT_DRIVE_TITLE,
  HIGHER_STANDARDS,
  STREAM_STANDARDS,
  canonicalStandard,
  driveDisplayName,
  liveLevelLabel,
  meritGroups,
  nextStatusLabel,
  rankApproved,
  rosterKey,
  rosterStatusMeta,
  streamColors,
  subFieldFor,
  type MeritGroup,
  type RosterRow,
} from "@/lib/result-drive";
import { formatDate, pickText } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DriveInfo = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  year: number;
  isOpen: boolean;
  entries: number;
};

/** One nested sub-department option — can itself carry one more level of children (College → BE → CSE / IT). */
export type SubOption = {
  nameEn: string;
  nameGu: string | null;
  children?: { nameEn: string; nameGu: string | null }[];
};

const ALL_LEVELS = EDUCATION_LEVELS.map((l) => l.nameEn);

const STATUS_KEYS = {
  none: "res.stNone",
  PENDING: "res.stPending",
  APPROVED: "res.stApproved",
  REJECTED: "res.stRejected",
  RESUBMIT: "res.stResubmit",
} as const;

/** Display name for a standard — its *current* Dropdown lists name, not just the seed list's. */
function levelLabel(value: string, lang: "en" | "gu", tree: OccupationTreeNode[]): string {
  return liveLevelLabel(tree, canonicalStandard(value), lang);
}

function streamLabel(value: string, lang: string): string {
  const m = DEFAULT_STREAMS.find((s) => s.nameEn === value || s.nameGu === value);
  return m ? (lang === "gu" ? m.nameGu : m.nameEn) : value;
}

/** Gold / silver / bronze — same medal gradients as the public toppers page, so rank 1-3 reads instantly. */
const RANK_GRADIENTS = [
  "linear-gradient(150deg,#F0B33A,#D98A1E)",
  "linear-gradient(150deg,#C3C9D2,#9AA3AF)",
  "linear-gradient(150deg,#D9A066,#B87A3E)",
];

/**
 * Ranked merit lists — one per stream for Std 11/12, one overall otherwise.
 * Shared by the per-standard merit list and the whole-drive final report so the
 * two can never disagree about who ranked where.
 *
 * Rows are already sorted highest-percentage-first by `meritGroups`. The
 * whole-drive final report only ever needs the podium, so pass `limit={3}`
 * there; the per-standard merit list omits it and shows every approved row.
 */
function MeritSections({
  groups,
  limit,
  hideStreamBadge,
}: {
  groups: MeritGroup[];
  limit?: number;
  hideStreamBadge?: boolean;
}) {
  const { t, lang } = useAdminT();
  const split = !hideStreamBadge && (groups.length > 1 || groups[0]?.stream != null);

  return (
    <div className="flex flex-col gap-5 print:gap-3">
      {groups.map((g) => {
        const key = g.stream ?? "unassigned";
        const rows = limit ? g.rows.slice(0, limit) : g.rows;
        const sc = g.stream ? streamColors(g.stream) : null;
        return (
          <div key={key}>
            {split && (
              <span
                className="mb-2 inline-block rounded-full px-3 py-1 text-[12.5px] font-extrabold print:hidden"
                style={sc ? { background: sc.bg, color: sc.fg } : { background: "#F0EBE0", color: "#8B8375" }}
              >
                {g.stream ? streamLabel(g.stream, lang) : t("res.streamNotRecorded")}
              </span>
            )}
            {split && (
              <span className="mb-1.5 hidden text-[13px] font-bold text-black print:block">
                {g.stream ? streamLabel(g.stream, lang) : t("res.streamNotRecorded")}
              </span>
            )}
            <div className="flex flex-col gap-1.5 print:gap-0.5">
              {rows.map((m) => {
                const medal = m.rank <= 3 ? RANK_GRADIENTS[m.rank - 1] : null;
                return (
                  <div
                    key={rosterKey(m)}
                    className="flex items-center gap-3.5 rounded-[13px] border border-[var(--line-soft)] bg-[#FBFAF7] px-4 py-3 print:break-inside-avoid print:gap-2.5 print:rounded-none print:border-x-0 print:border-t-0 print:border-b print:border-[#ccc] print:bg-transparent print:px-1.5 print:py-2"
                  >
                    <span
                      className="flex size-8 flex-none items-center justify-center rounded-full text-[14px] font-extrabold text-white print:hidden"
                      style={medal ? { background: medal } : { background: "#E4DFD2", color: "#8B8375" }}
                    >
                      {m.rank}
                    </span>
                    <span className="hidden w-5 flex-none text-[14px] font-bold text-black print:block">{m.rank}.</span>
                    <span className="min-w-0 flex-1 truncate text-[16px] font-bold text-[var(--ink)] print:text-[14px] print:text-black">
                      {pickText(m.studentNameGu, m.studentNameEn, lang) || m.studentName}
                    </span>
                    <span className="flex-none text-[17px] font-extrabold text-[var(--brand)] print:text-[14px] print:font-bold print:text-black">
                      {m.percentage?.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ResultsClient({
  drives,
  currentDrive,
  roster: initialRoster,
  adminUploadEnabled,
  enabledStandards,
  standardStreams,
  occupationTree,
}: {
  drives: DriveInfo[];
  currentDrive: DriveInfo | null;
  roster: RosterRow[];
  adminUploadEnabled: boolean;
  /** Standard names enabled in Dropdown lists → Student. `null` means that
   *  list isn't set up yet for this community, so nothing is filtered out. */
  enabledStandards: string[] | null;
  /** Enabled nested sub-department options per standard, from Dropdown
   *  lists' nested section under that standard (Science / Commerce / Arts
   *  for Std 11-12, a branch list for Diploma, etc). A standard missing here
   *  has no nested rows configured — Std 11-12 fall back to the full default
   *  stream list, everything else shows no sub-department filter. Any option
   *  can itself carry `children` for one more nested tier. */
  standardStreams: Record<string, SubOption[]>;
  /** Same Dropdown lists occupation tree, with ids — backs the College/Diploma
   *  course pickers in the upload and next-standard modals. */
  occupationTree: OccupationTreeNode[];
}) {
  const router = useRouter();
  const { t, tf, lang } = useAdminT();
  const [roster, setRoster] = useState<RosterRow[]>(initialRoster);
  // `useState(initialRoster)` only seeds the very first render — switching
  // drives (or any server refetch) sends a new `initialRoster` prop that this
  // needs to pick up explicitly, otherwise the roster stays frozen on
  // whichever drive was loaded first until a hard page reload.
  useEffect(() => {
    setRoster(initialRoster);
  }, [initialRoster]);
  const [error, setError] = useState<string | null>(null);
  const [creatingDrive, setCreatingDrive] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [streamFilter, setStreamFilter] = useState("all");
  const [specializationFilter, setSpecializationFilter] = useState("all");
  const [verify, setVerify] = useState<{ row: RosterRow; viewOnly: boolean } | null>(null);
  const [rejectRow, setRejectRow] = useState<RosterRow | null>(null);
  const [uploadRow, setUploadRow] = useState<RosterRow | null>(null);
  const [closeDriveOpen, setCloseDriveOpen] = useState(false);
  const [closingDrive, setClosingDrive] = useState(false);
  // Set while a per-standard "print just this section" is in flight — every
  // other section on the final report gets `print:hidden` so only this one
  // ends up on paper/PDF, then clears itself once the print dialog closes.
  const [printOnlyStd, setPrintOnlyStd] = useState<string | null>(null);

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

  // The browser's print header prints `document.title` verbatim — on the
  // report views that's the only place a printout says which drive/standard
  // it's for, so swap in something readable while it's open and restore
  // whatever the app normally shows once the admin navigates away.
  useEffect(() => {
    if (!currentDrive || (view !== "final" && view !== "merit")) return;
    const driveTitle = driveDisplayName(currentDrive, lang);
    const previous = document.title;
    document.title =
      view === "final"
        ? `${t("res.meritReport")} — ${driveTitle}`
        : `${t("res.meritList")} — ${levelLabel(activeStd || "", lang, occupationTree)} — ${driveTitle}`;
    return () => {
      document.title = previous;
    };
  }, [view, currentDrive, activeStd, lang, t, occupationTree]);

  useEffect(() => {
    setStdSearch("");
    setStdStatusFilter("all");
    setPercentSort("none");
    setStreamFilter("all");
  }, [activeStd]);

  // A 2nd-tier pick only ever makes sense under whichever 1st-tier sub is
  // selected — switching that (or leaving it) invalidates it.
  useEffect(() => {
    setSpecializationFilter("all");
  }, [streamFilter]);

  useEffect(() => {
    if (!printOnlyStd) return;
    window.print();
  }, [printOnlyStd]);

  useEffect(() => {
    function clear() {
      setPrintOnlyStd(null);
    }
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

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

  // Standards disabled in Dropdown lists → Student drop off the grid — unless
  // they still carry roster data (e.g. from before they were disabled), in
  // which case they surface via `extra` below instead of vanishing silently.
  const levels = useMemo(
    () => (enabledStandards ? ALL_LEVELS.filter((l) => enabledStandards.includes(l)) : ALL_LEVELS),
    [enabledStandards],
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
    const extra = [...map.keys()].filter((s) => !levels.includes(s)).sort();
    return [...levels, ...extra].map((standard) => ({
      standard,
      ...(map.get(standard) ?? { total: 0, approved: 0, pending: 0, rejected: 0, uploaded: 0 }),
    }));
  }, [roster, levels]);

  // The overview search box narrows down which standard cards show — it
  // never touches the counts on them, so it stays a pure display filter.
  const visibleStandards = useMemo(() => {
    const q = standardQuery.trim().toLowerCase();
    if (!q) return standards;
    return standards.filter((s) => s.standard.toLowerCase().includes(q));
  }, [standards, standardQuery]);

  // College / Diploma have no marks to rank by — just a pass/fail-style
  // Degree/Course upload — so the % and Rank columns are just empty dashes
  // for every row there.
  const showScore = !activeStd || !HIGHER_STANDARDS.has(activeStd);

  // The nested-options list for the active standard — Science / Commerce /
  // Arts for Std 11-12, whatever Dropdown lists has nested under any other
  // standard (Diploma's branches, etc). Empty means no sub-department filter.
  const subField = activeStd ? subFieldFor(activeStd) : "stream";
  const subOptions = useMemo((): SubOption[] => {
    if (!activeStd) return [];
    const configured = standardStreams[activeStd];
    if (configured?.length) return configured;
    if (STREAM_STANDARDS.has(activeStd)) return DEFAULT_STREAMS.map((s) => ({ nameEn: s.nameEn, nameGu: s.nameGu }));
    return [];
  }, [activeStd, standardStreams]);

  // One tier deeper still (College → BE → CSE / IT) — only meaningful once a
  // 1st-tier sub is actually selected, since that's what it nests under.
  const specializationOptions = useMemo(() => {
    if (streamFilter === "all") return [];
    return subOptions.find((o) => o.nameEn === streamFilter)?.children ?? [];
  }, [subOptions, streamFilter]);

  const stdRows = useMemo(() => {
    if (!activeStd) return [];
    let rows = roster.filter((r) => r.standard === activeStd);
    if (subOptions.length > 0 && streamFilter !== "all") {
      rows = rows.filter((r) => ((subField === "stream" ? r.stream : r.course) || "") === streamFilter);
    }
    if (specializationOptions.length > 0 && specializationFilter !== "all") {
      rows = rows.filter((r) => (r.specialization || "") === specializationFilter);
    }
    return rows;
  }, [roster, activeStd, streamFilter, subOptions, subField, specializationOptions, specializationFilter]);

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
        label:
          (perYear.get(d.year) ?? 0) > 1
            ? `${d.year} — ${pickText(d.titleGu, d.titleEn, lang)}`
            : String(d.year),
        dot: d.isOpen,
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

  async function toggleDrive(field: "isOpen") {
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

  /**
   * The whole point of the "+" affordance: no title/year typing — one click
   * adds the next drive in the sequence. The next year always follows
   * whichever drive is furthest out already (latest existing year + 1), not
   * today's calendar year — otherwise "+" would stay blocked for months
   * every time the current year's drive already exists (which it does right
   * after signup, since every community starts with one).
   *
   * Creation and activation are two separate decisions: with nothing
   * currently active, the new drive just becomes active — nothing to weigh.
   * With another drive already active, that's a second, more consequential
   * choice, so it gets its own popup rather than being bundled silently into
   * the create confirmation.
   */
  async function createNextDrive() {
    setError(null);
    const latestYear = drives.length ? Math.max(...drives.map((d) => d.year)) : null;
    const year = latestYear != null ? latestYear + 1 : new Date().getFullYear();
    const name = driveDisplayName({ titleEn: DEFAULT_DRIVE_TITLE.en, titleGu: DEFAULT_DRIVE_TITLE.gu, year }, lang);

    const confirmCreate = await confirmDialog({
      title: tf("res.newDriveConfirmTitle", { year: String(year) }),
      description: tf("res.newDriveConfirmBody", { name }),
      confirmLabel: t("res.createDrive"),
      cancelLabel: t("common.cancel"),
      tone: "primary",
    });
    if (!confirmCreate) return;

    const openDrive = drives.find((d) => d.isOpen);
    let makeActive = true;
    if (openDrive) {
      makeActive = await confirmDialog({
        title: t("res.switchActiveTitle"),
        description: tf("res.switchActiveBody", { name, openName: driveDisplayName(openDrive, lang) }),
        confirmLabel: t("res.makeActive"),
        cancelLabel: t("res.keepActiveDrive"),
        tone: "danger",
      });
    }

    setCreatingDrive(true);
    const res = await api.post<{ id: string }>(`/api/admin/result-drives`, { isOpen: makeActive });
    setCreatingDrive(false);
    if (!res.ok) return setError(res.error);
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
    if (!activeStd || subOptions.length === 0) return [];
    return ["all", ...subOptions.map((o) => o.nameEn)].map((v) => ({
      value: v,
      label:
        v === "all"
          ? t("res.tabAll")
          : pickText(subOptions.find((o) => o.nameEn === v)?.nameGu ?? null, v, lang),
      count: roster.filter(
        (r) => r.standard === activeStd && (v === "all" || ((subField === "stream" ? r.stream : r.course) || "") === v),
      ).length,
    }));
  }, [activeStd, roster, t, lang, subOptions, subField]);

  const specializationTabs = useMemo(() => {
    if (!activeStd || specializationOptions.length === 0) return [];
    return ["all", ...specializationOptions.map((o) => o.nameEn)].map((v) => ({
      value: v,
      label:
        v === "all"
          ? t("res.tabAll")
          : pickText(specializationOptions.find((o) => o.nameEn === v)?.nameGu ?? null, v, lang),
      count: roster.filter(
        (r) =>
          r.standard === activeStd &&
          (subField === "stream" ? r.stream : r.course) === streamFilter &&
          (v === "all" || (r.specialization || "") === v),
      ).length,
    }));
  }, [activeStd, roster, t, lang, specializationOptions, subField, streamFilter]);

  const headerBack =
    view === "final"
      ? { onClick: () => go({ std: null, view: null }), label: t("res.backToDashboard") }
      : view === "merit"
        ? { onClick: () => go({ view: null }), label: tf("res.backTo", { name: levelLabel(activeStd || "", lang, occupationTree) }) }
        : null;

  return (
    <>
      <div
        className={cn(
          "mb-4 flex flex-wrap items-center justify-between gap-3",
          (view === "final" || view === "merit") && "print:hidden",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {headerBack && (
            <button
              type="button"
              onClick={headerBack.onClick}
              aria-label={headerBack.label}
              title={headerBack.label}
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--line-admin)] bg-white text-[var(--ink)] shadow-sm transition-colors print:hidden hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]"
            >
              <ChevronLeft className="size-5" strokeWidth={2.4} />
            </button>
          )}
          <AdminH2 className="mb-0">
            {t("nav.results")}{" "}
            {currentDrive ? (
              <>
                — {driveDisplayName(currentDrive, lang)}{" "}
                {currentDrive.isOpen ? (
                  <PillActive>{t("res.driveOpen")}</PillActive>
                ) : (
                  <PillExpired>{t("res.driveClosed")}</PillExpired>
                )}
              </>
            ) : null}
          </AdminH2>
        </div>
        <span className="flex flex-wrap items-center gap-2 print:hidden">
          {currentDrive && view === "overview" && (
            <>
              <SearchInput
                value={standardQuery}
                onChange={setStandardQuery}
                placeholder={t("res.searchStandard")}
                className="min-w-0 md:w-[220px]"
              />
              <AdminSelect
                value={currentDrive.id}
                onChange={(v) => router.push(`/admin/results?drive=${v}`)}
                ariaLabel={t("res.selectDriveYear")}
                className="w-[190px] shrink-0"
                options={driveOptions}
              />
              <button
                type="button"
                onClick={() => void createNextDrive()}
                disabled={creatingDrive}
                aria-label={t("res.newDrive")}
                title={t("res.newDrive")}
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--line-admin)] bg-white text-[var(--ink)] shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]"
              >
                {creatingDrive ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" strokeWidth={2.4} />
                )}
              </button>
            </>
          )}
          {view === "final" ? (
            <AdminBtn onClick={() => window.print()}>
              <Printer className="size-4 shrink-0" />
              {t("res.printFinal")}
            </AdminBtn>
          ) : view === "merit" ? (
            <AdminBtn onClick={() => window.print()}>
              <Printer className="size-4 shrink-0" />
              {t("res.printPdf")}
            </AdminBtn>
          ) : view === "overview" ? (
            <>
              {currentDrive && (
                <AdminBtn
                  variant={currentDrive.isOpen ? "primary" : "success"}
                  onClick={() => (currentDrive.isOpen ? setCloseDriveOpen(true) : void reopenDrive())}
                  className="whitespace-nowrap"
                >
                  {currentDrive.isOpen ? (
                    <Lock className="size-4 shrink-0" />
                  ) : (
                    <Unlock className="size-4 shrink-0" />
                  )}
                  {currentDrive.isOpen ? t("res.closeDrive") : t("res.reopenDrive")}
                </AdminBtn>
              )}
              <AdminBtn onClick={() => go({ view: "final", std: null })}>🏆 {t("res.finalResult")}</AdminBtn>
            </>
          ) : null}
        </span>
      </div>

      {error && <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>}

      {!currentDrive ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-center text-[13px] text-[var(--faint)]">{t("res.noDrive")}</p>
          <AdminBtn onClick={() => void createNextDrive()} disabled={creatingDrive}>
            {creatingDrive ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {t("res.createDrive")}
          </AdminBtn>
        </div>
      ) : (
        <>
          {view === "overview" && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {(
                  [
                    ["res.statStudents", overviewSummary.total, "var(--ink)"],
                    ["res.statUploaded", overviewSummary.uploaded, "var(--info)"],
                    ["res.stPending", pending, "var(--warn)"],
                    ["res.stApproved", overviewSummary.approved, "var(--success)"],
                    ["res.stRejected", overviewSummary.rejected, "var(--danger)"],
                    ["res.statNextSet", overviewSummary.nextSet, "var(--brand)"],
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
              <AdminH3>{t("res.standardsHeading")}</AdminH3>
              {visibleStandards.length === 0 ? (
                <p className="py-6 text-[13px] text-[var(--faint)]">
                  {standards.length === 0 ? t("res.noStandards") : t("res.noStandardMatch")}
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
                          <span className="text-[15px] font-extrabold text-[var(--ink)]">
                            {levelLabel(s.standard, lang, occupationTree)}
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
            <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--line-admin)] bg-white p-4 shadow-[0_2px_10px_rgba(42,35,32,.04)] sm:p-7 print:max-w-none print:rounded-none print:border-0 print:px-10 print:py-8 print:shadow-none">
              <div className="mb-6 flex flex-col items-center border-b border-[var(--line-soft)] pb-5 text-center print:mb-3 print:border-black print:pb-2">
                <span
                  className="mb-2.5 flex size-11 items-center justify-center rounded-full text-white print:hidden"
                  style={{ background: "linear-gradient(150deg,#D98A1E,#A62A38)" }}
                >
                  <Trophy className="size-5" strokeWidth={2} />
                </span>
                <h3 className="text-[19px] font-extrabold text-[var(--ink)] print:text-[16px] print:text-black">
                  {t("res.meritReport")} — {driveDisplayName(currentDrive, lang)}
                </h3>
                <p className="mt-1 text-[12.5px] text-[var(--faint)] print:text-black">
                  {tf("res.academicYearColon", { year: currentDrive.year })}
                </p>
              </div>
              {finalStandards.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[var(--faint)]">{t("res.noApproved")}</p>
              ) : (
                <div className="flex flex-col gap-4 print:gap-4">
                  {finalStandards.map((std) => {
                    const stdGroups = meritOf(std);
                    const soloStream = stdGroups.length === 1 ? (stdGroups[0]?.stream ?? null) : null;
                    const soloStreamColors = soloStream ? streamColors(soloStream) : null;
                    return (
                      <section
                        key={std}
                        className={cn(
                          "overflow-hidden rounded-[16px] border border-[var(--line-soft)] print:break-inside-avoid print:rounded-none print:border-0",
                          printOnlyStd && printOnlyStd !== std && "print:hidden",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 bg-[#FBFAF7] px-4 py-3 print:border-b print:border-black print:bg-transparent print:px-0 print:py-1.5">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <GraduationCap className="size-4 flex-none text-[var(--brand)] print:hidden" strokeWidth={2.2} />
                            <h4 className="min-w-0 truncate text-[15.5px] font-extrabold text-[var(--ink)] print:text-[15px] print:text-black">
                              {levelLabel(std, lang, occupationTree)}
                            </h4>
                            {soloStream && soloStreamColors && (
                              <span
                                className="flex-none rounded-full px-2.5 py-1 text-[12.5px] font-extrabold print:hidden"
                                style={{ background: soloStreamColors.bg, color: soloStreamColors.fg }}
                              >
                                {streamLabel(soloStream, lang)}
                              </span>
                            )}
                            {soloStream && (
                              <span className="hidden text-[13px] font-bold text-black print:inline">
                                ({streamLabel(soloStream, lang)})
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPrintOnlyStd(std)}
                            aria-label={tf("res.printStandard", { std: levelLabel(std, lang, occupationTree) })}
                            title={tf("res.printStandard", { std: levelLabel(std, lang, occupationTree) })}
                            className="flex size-7 flex-none cursor-pointer items-center justify-center rounded-full text-[var(--faint)] transition-colors print:hidden hover:bg-white hover:text-[var(--brand)]"
                          >
                            <Printer className="size-3.5" strokeWidth={2.2} />
                          </button>
                        </div>
                        <div className="p-3.5 print:p-0 print:pt-2">
                          <MeritSections groups={stdGroups} limit={3} hideStreamBadge={!!soloStream} />
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {view === "merit" && activeStd && (
            <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--line-admin)] bg-white p-4 shadow-[0_2px_10px_rgba(42,35,32,.04)] sm:p-7 print:max-w-none print:rounded-none print:border-0 print:px-10 print:py-8 print:shadow-none">
              <div className="mb-6 flex flex-col items-center border-b border-[var(--line-soft)] pb-5 text-center print:mb-3 print:border-black print:pb-2">
                <span
                  className="mb-2.5 flex size-11 items-center justify-center rounded-full text-white print:hidden"
                  style={{ background: "linear-gradient(150deg,#D98A1E,#A62A38)" }}
                >
                  <GraduationCap className="size-5" strokeWidth={2} />
                </span>
                <h3 className="text-[19px] font-extrabold text-[var(--ink)] print:text-[16px] print:text-black">
                  {t("res.meritList")} — {levelLabel(activeStd, lang, occupationTree)}
                </h3>
                <p className="mt-1 text-[12.5px] text-[var(--faint)] print:text-black">
                  {driveDisplayName(currentDrive, lang)} ·{" "}
                  {tf("res.academicYear", { year: currentDrive.year })}
                </p>
              </div>
              {merit.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[var(--faint)]">{t("res.noApproved")}</p>
              ) : (
                <MeritSections groups={merit} />
              )}
            </div>
          )}

          {view === "standard" && activeStd && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => go({ std: null, view: null })}
                    aria-label={t("res.backToDashboard")}
                    title={t("res.backToDashboard")}
                    className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--line-admin)] bg-white text-[var(--ink)] shadow-sm transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]"
                  >
                    <ChevronLeft className="size-5" strokeWidth={2.4} />
                  </button>
                  <AdminH3 className="mb-0">{levelLabel(activeStd, lang, occupationTree)}</AdminH3>
                </div>
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

              {specializationTabs.length > 0 && (
                <div className="-mt-2 mb-3.5 flex flex-wrap gap-2">
                  {specializationTabs.map((tb) => (
                    <button
                      key={tb.value}
                      type="button"
                      onClick={() => setSpecializationFilter(tb.value)}
                      className="cursor-pointer rounded-[9px] border-[1.5px] px-3.5 py-1 text-[12px] font-bold"
                      style={{
                        borderColor: specializationFilter === tb.value ? "#A62A38" : "#E6E0D3",
                        background: specializationFilter === tb.value ? "#A62A38" : "#FCFAF6",
                        color: specializationFilter === tb.value ? "#fff" : "#6B6357",
                      }}
                    >
                      {tb.label} ({tb.count})
                    </button>
                  ))}
                </div>
              )}

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
                        {subOptions.length > 0 && <AdminTh>{t("res.thStream")}</AdminTh>}
                        <AdminTh>{t("res.thUpload")}</AdminTh>
                        <AdminTh>{t("res.thVerification")}</AdminTh>
                        {showScore && <AdminTh>%</AdminTh>}
                        {showScore && <AdminTh>{t("res.thRank")}</AdminTh>}
                        <AdminTh>{t("res.thNextStatus")}</AdminTh>
                        <AdminTh>{t("res.thUpdated")}</AdminTh>
                        <AdminTh className="text-right whitespace-nowrap">{t("res.thActions")}</AdminTh>
                      </tr>
                    </thead>
                    <tbody>
                      {displayStdRows.map((r) => {
                        const meta = rosterStatusMeta(r.status);
                        const subValue = subField === "stream" ? r.stream : r.course;
                        const sc = subValue ? streamColors(subValue) : null;
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
                            {subOptions.length > 0 && (
                              <AdminTd>
                                {subValue && sc ? (
                                  <span
                                    className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
                                    style={{ background: sc.bg, color: sc.fg }}
                                  >
                                    {pickText(
                                      subOptions.find((o) => o.nameEn === subValue)?.nameGu ?? null,
                                      subValue,
                                      lang,
                                    )}
                                    {r.specialization
                                      ? ` · ${pickText(
                                          subOptions
                                            .find((o) => o.nameEn === subValue)
                                            ?.children?.find((c) => c.nameEn === r.specialization)?.nameGu ?? null,
                                          r.specialization,
                                          lang,
                                        )}`
                                      : ""}
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
                            {showScore && (
                              <AdminTd>
                                {r.percentage != null ? (
                                  <span className={r.percentage >= 80 ? "font-bold text-[#22A45D]" : ""}>
                                    {r.percentage}%
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </AdminTd>
                            )}
                            {showScore && <AdminTd>{rank ? `#${rank}` : "—"}</AdminTd>}
                            <AdminTd>
                              {r.status === "none" ? (
                                "—"
                              ) : (
                                <span
                                  className="font-semibold"
                                  style={{ color: r.studyOutcome ? "#1E9E52" : "#B0801E" }}
                                >
                                  {nextStatusLabel(r, lang)}
                                </span>
                              )}
                            </AdminTd>
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
                                  {r.status !== "APPROVED" && (
                                    <ActionBtn
                                      icon={CheckCircle2}
                                      label={t("res.verify")}
                                      tone="success"
                                      onClick={() => setVerify({ row: r, viewOnly: false })}
                                    />
                                  )}
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
          occupationTree={occupationTree}
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
          occupationTree={occupationTree}
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
          driveTitle={driveDisplayName(currentDrive, lang)}
          notUploaded={notUploaded}
          incomplete={incompleteUploaded}
          onClose={() => setCloseDriveOpen(false)}
          onConfirm={() => void confirmCloseDrive()}
          busy={closingDrive}
        />
      )}

    </>
  );
}
