/** Shared Result Drive helpers — roster rows, status labels, reject chips. */

import {
  DEFAULT_STREAMS,
  EDUCATION_LEVELS,
  liveStudentChildNode,
  type OccupationTreeNode,
} from "@/lib/occupation-defaults";
import { pickText } from "@/lib/format";
import type { Lang } from "@/lib/i18n/dictionary";

/**
 * "2026" -> "2025-26" — the fixed academic-year range shown next to every drive title.
 * The selected year is the END of the academic session (results declared in
 * 2026 belong to the 2025-26 session), so the range runs backward from it.
 */
export function yearRangeSuffix(year: number): string {
  return `${year - 1}-${String(year).slice(-2)}`;
}

/** Default title for auto-created drives (initial community seed + the "+" quick-create). */
export const DEFAULT_DRIVE_TITLE = { en: "Result", gu: "પરિણામ" } as const;

/**
 * Full display name for a drive — base title plus its academic-year suffix,
 * e.g. "Result" + year 2026 -> "Result 2025-26". The suffix is derived from
 * `year` rather than stored in the title, so it always tracks the drive's
 * actual year everywhere it's shown (header, reports, dropdown, modals).
 */
export function driveDisplayName(
  drive: { titleEn: string; titleGu: string | null; year: number },
  lang: Lang,
): string {
  return `${pickText(drive.titleGu, drive.titleEn, lang)} ${yearRangeSuffix(drive.year)}`;
}

export type RosterStatus = "none" | "PENDING" | "APPROVED" | "REJECTED" | "RESUBMIT";

/** What happens to a student after this result — applied to their record on approval. */
export type StudyOutcome = "PROMOTED" | "STUDY_COMPLETE" | "FAILED_REPEAT" | "DROPPED_OUT";

export type RosterRow = {
  memberId: string | null;
  entryId: string | null;
  studentName: string;
  studentNameEn: string | null;
  studentNameGu: string | null;
  init: string;
  familyLabel: string;
  familyLabelEn: string | null;
  familyLabelGu: string | null;
  mobile: string | null;
  standard: string;
  stream: string | null;
  course: string | null;
  specialization: string | null;
  totalMarks: number | null;
  obtainedMarks: number | null;
  percentage: number | null;
  marksheetUrl: string | null;
  status: RosterStatus;
  rejectReason: string | null;
  updatedAt: string | null;
  nextStandard: string | null;
  nextStream: string | null;
  nextCourse: string | null;
  nextSpecialization: string | null;
  studyOutcome: StudyOutcome | null;
};

export const STUDY_OUTCOME_LABELS: Record<StudyOutcome, { en: string; gu: string }> = {
  PROMOTED: { en: "Promoted", gu: "આગળના ધોરણમાં" },
  STUDY_COMPLETE: { en: "Study complete", gu: "અભ્યાસ પૂર્ણ" },
  FAILED_REPEAT: { en: "Failed / repeat year", gu: "નાપાસ / ફરી એ જ ધોરણ" },
  DROPPED_OUT: { en: "Dropped out", gu: "અભ્યાસ છોડ્યો" },
};

/** Whether a roster row's next-standard decision is fully recorded (any outcome counts, not just PROMOTED). */
export function hasNextStatus(r: Pick<RosterRow, "studyOutcome">): boolean {
  return r.studyOutcome != null;
}

/** A short label for what's next, for admin tables and the close-drive summary. */
export function nextStatusLabel(
  r: Pick<
    RosterRow,
    "studyOutcome" | "nextStandard" | "nextStream" | "nextCourse" | "nextSpecialization"
  >,
  lang: "en" | "gu" = "en",
): string {
  if (!r.studyOutcome) return lang === "gu" ? "નક્કી નથી" : "Not decided";
  if (r.studyOutcome === "PROMOTED") {
    const extra = [r.nextStream || r.nextCourse, r.nextSpecialization].filter(Boolean).join(" · ");
    return `${r.nextStandard ?? ""}${extra ? ` · ${extra}` : ""}`.trim();
  }
  return STUDY_OUTCOME_LABELS[r.studyOutcome][lang];
}

export const STREAM_STANDARDS = new Set(["Standard 11", "Standard 12"]);
export const HIGHER_STANDARDS = new Set(["College", "Diploma"]);

/**
 * Which roster field carries a standard's nested sub-department (Science /
 * Commerce / Arts for Standard 11-12, a branch like IT / Mechanical for
 * Diploma, a degree for College, …). Standard 11-12 keep their own dedicated
 * `stream` field for backward compatibility; every other standard's
 * sub-department — whatever Dropdown lists has nested under it — rides on
 * `course`.
 */
export function subFieldFor(standard: string): "stream" | "course" {
  return STREAM_STANDARDS.has(standard) ? "stream" : "course";
}

/**
 * English name for a standard, whichever language it was stored in.
 *
 * A member's `education` is saved as its display label — Gujarati when the
 * option has one ("ધોરણ 12"), English when it doesn't ("B.COM") — while result
 * entries and every check in this file key off the English name. Without this,
 * the same standard shows up as two separate cards: "Standard 12" with nobody
 * in it and "ધોરણ 12" holding the actual student.
 *
 * An unrecognised value passes through untouched, so community-specific levels
 * still get their own card instead of vanishing.
 */
export function canonicalStandard(value: string | null | undefined): string {
  const v = (value || "").trim();
  if (!v) return "";
  return EDUCATION_LEVELS.find((l) => l.nameEn === v || l.nameGu === v)?.nameEn ?? v;
}

/** Same idea for streams — "વાણિજ્ય" and "Commerce" are one thing. */
export function canonicalStream(value: string | null | undefined): string | null {
  const v = (value || "").trim();
  if (!v) return null;
  return DEFAULT_STREAMS.find((s) => s.nameEn === v || s.nameGu === v)?.nameEn ?? v;
}

/**
 * A standard's *current* display name — read live from Dropdown lists rather
 * than the seed list above, so renaming "Junior" to "Junior KG" there shows
 * up here immediately, with no separate step to "sync" it into Result Drive.
 *
 * `canonicalStandard` above still keys everything off the seed list's English
 * name — that identity has to stay stable no matter what an admin renames a
 * level to, or every already-stored record would stop matching its card.
 * This function is the other half: given that stable identity, find the
 * matching Dropdown lists row (via `liveStudentChildNode`, matched by
 * `sortOrder` rather than name) and show whatever it's *currently* called.
 */
export function liveLevelLabel(
  tree: OccupationTreeNode[],
  canonicalNameEn: string,
  lang: "en" | "gu",
): string {
  const seed = EDUCATION_LEVELS.find((l) => l.nameEn === canonicalNameEn);
  if (!seed) return canonicalNameEn; // not one of ours — nothing to relabel
  const live = liveStudentChildNode(tree, canonicalNameEn);
  const nameEn = live?.nameEn || seed.nameEn;
  const nameGu = live?.nameGu || seed.nameGu;
  return lang === "gu" ? nameGu || nameEn : nameEn;
}

export const REJECT_REASON_CHIPS = [
  "Blurry / unclear marksheet",
  "Wrong marksheet uploaded",
  "Marks do not match",
  "Incomplete document",
] as const;

/** A marksheet stored as PDF needs an embed/icon; anything else renders as an image. */
export function isPdf(url: string | null | undefined): boolean {
  return (url || "").split("?")[0]!.toLowerCase().endsWith(".pdf");
}

export function nameInitial(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

export function streamColors(stream: string): { bg: string; fg: string } {
  if (stream === "Science") return { bg: "#E7F0FB", fg: "#2C6DB5" };
  if (stream === "Commerce") return { bg: "#F3EAF8", fg: "#7A3EA6" };
  return { bg: "#F0EBE0", fg: "#8B8375" };
}

export function rosterStatusMeta(status: RosterStatus): { label: string; bg: string; fg: string } {
  switch (status) {
    case "none":
      return { label: "Not uploaded", bg: "#F1EBDE", fg: "#8B8375" };
    case "PENDING":
      return { label: "Pending", bg: "#FCEFD6", fg: "#B0801E" };
    case "APPROVED":
      return { label: "Approved", bg: "#E4F5E9", fg: "#1E9E52" };
    case "REJECTED":
    case "RESUBMIT":
      return { label: status === "RESUBMIT" ? "Resubmit" : "Rejected", bg: "#FCE7E7", fg: "#B0303A" };
  }
}

export function calcPct(total: number | null | undefined, obtained: number | null | undefined): number | null {
  if (total == null || obtained == null || total <= 0) return null;
  return Math.round((obtained / total) * 10000) / 100;
}

/** Stable identity for a roster row, used as the rank-map key. */
export function rosterKey(r: RosterRow): string {
  return r.entryId ?? r.memberId ?? r.studentName;
}

export type MeritGroup = { stream: string | null; rows: (RosterRow & { rank: number })[] };

/**
 * Approved students of one standard, ranked — split by stream for Std 11/12.
 *
 * Science, Commerce and Arts sit different exams, so a single ranking across
 * them compares percentages that were never comparable: the Science topper and
 * the Commerce topper are each #1, not #1 and #2. Every other standard gets one
 * ungrouped list, exactly as before.
 */
export function meritGroups(rows: RosterRow[], std: string): MeritGroup[] {
  const approved = rows.filter(
    (r) => r.standard === std && r.status === "APPROVED" && r.percentage != null,
  );
  const ranked = (list: RosterRow[]) =>
    [...list]
      .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
      .map((r, i) => ({ ...r, rank: i + 1 }));

  if (!STREAM_STANDARDS.has(std)) {
    return approved.length ? [{ stream: null, rows: ranked(approved) }] : [];
  }

  const groups: MeritGroup[] = [];
  for (const s of DEFAULT_STREAMS) {
    const inStream = approved.filter((r) => canonicalStream(r.stream) === s.nameEn);
    if (inStream.length) groups.push({ stream: s.nameEn, rows: ranked(inStream) });
  }
  // Approved before a stream was recorded — still has to appear somewhere.
  const unassigned = approved.filter((r) => !canonicalStream(r.stream));
  if (unassigned.length) groups.push({ stream: null, rows: ranked(unassigned) });
  return groups;
}

export function rankApproved(rows: RosterRow[], std: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const group of meritGroups(rows, std)) {
    for (const r of group.rows) map.set(rosterKey(r), r.rank);
  }
  return map;
}
