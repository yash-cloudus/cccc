/** Shared Result Drive helpers — roster rows, status labels, reject chips. */

export type RosterStatus = "none" | "PENDING" | "APPROVED" | "REJECTED" | "RESUBMIT";

export type RosterRow = {
  memberId: string | null;
  entryId: string | null;
  studentName: string;
  init: string;
  familyLabel: string;
  mobile: string | null;
  standard: string;
  stream: string | null;
  course: string | null;
  schoolName: string | null;
  totalMarks: number | null;
  obtainedMarks: number | null;
  percentage: number | null;
  marksheetUrl: string | null;
  status: RosterStatus;
  rejectReason: string | null;
  updatedAt: string | null;
};

export const STREAM_STANDARDS = new Set(["Std 11", "Std 12"]);
export const HIGHER_STANDARDS = new Set(["College", "Diploma"]);

export const REJECT_REASON_CHIPS = [
  "Blurry / unclear marksheet",
  "Wrong marksheet uploaded",
  "Marks do not match",
  "Incomplete document",
] as const;

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

/** Infer stream from legacy rows that stored stream inside schoolName. */
export function inferStream(entry: { stream?: string | null; schoolName?: string | null; standard: string }): string | null {
  if (entry.stream) return entry.stream;
  const sn = entry.schoolName || "";
  if (STREAM_STANDARDS.has(entry.standard) && ["Science", "Commerce", "Arts"].includes(sn)) return sn;
  return null;
}

export function rankApproved(
  rows: RosterRow[],
  std: string,
): Map<string, number> {
  const ranked = rows
    .filter((r) => r.standard === std && r.status === "APPROVED" && r.percentage != null)
    .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
  return new Map(ranked.map((r, i) => [r.entryId ?? r.memberId ?? r.studentName, i + 1]));
}
