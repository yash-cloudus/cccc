"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, ImagePlus, Loader2, Maximize2 } from "lucide-react";
import { AdminModal, AdminModalActions } from "@/components/admin/admin-form";
import { AdminBtn, AdminInput, AdminLabel } from "@/components/admin/admin-ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCommunity } from "@/providers/community-provider";
import { CourseField, SpecializationField } from "@/components/results/course-field";
import { NextStandardModal, type NextStandardValue } from "@/components/results/next-standard-modal";
import { specializationOptionsForCourse } from "@/lib/cascading-occupation";
import {
  HIGHER_STANDARDS,
  REJECT_REASON_CHIPS,
  STREAM_STANDARDS,
  calcPct,
  canonicalStandard,
  isPdf,
  liveLevelLabel,
  nextStatusLabel,
  rosterStatusMeta,
  streamColors,
  type RosterRow,
} from "@/lib/result-drive";
import { api } from "@/lib/http";
import { useAdminT } from "@/lib/i18n/admin-dictionary";
import { DEFAULT_STREAMS, type OccupationTreeNode } from "@/lib/occupation-defaults";
import { waLink } from "@/lib/format";

function stop(e: React.MouseEvent) {
  e.stopPropagation();
}

const STATUS_KEYS = {
  none: "res.stNone",
  PENDING: "res.stPending",
  APPROVED: "res.stApproved",
  REJECTED: "res.stRejected",
  RESUBMIT: "res.stResubmit",
} as const;

const CHIP_KEYS = {
  "Blurry / unclear marksheet": "res.chipBlurry",
  "Wrong marksheet uploaded": "res.chipWrong",
  "Marks do not match": "res.chipMarksMismatch",
  "Incomplete document": "res.chipIncomplete",
} as const;

/** Display name for a standard — its *current* Dropdown lists name, not just the seed list's. */
function levelLabel(value: string, lang: "en" | "gu", tree: OccupationTreeNode[]): string {
  return liveLevelLabel(tree, canonicalStandard(value), lang);
}

function streamLabel(value: string, lang: string): string {
  const m = DEFAULT_STREAMS.find((s) => s.nameEn === value || s.nameGu === value);
  return m ? (lang === "gu" ? m.nameGu : m.nameEn) : value;
}

export function VerifyResultModal({
  row,
  standard,
  viewOnly,
  hasNav,
  occupationTree,
  onClose,
  onApprove,
  onSaveNext,
  onReject,
  onPrev,
  onNext,
  busy,
}: {
  row: RosterRow;
  standard: string;
  viewOnly: boolean;
  hasNav: boolean;
  occupationTree: OccupationTreeNode[];
  onClose: () => void;
  onApprove: () => void;
  onSaveNext: () => void;
  onReject: () => void;
  onPrev: () => void;
  onNext: () => void;
  busy: boolean;
}) {
  const { t, lang } = useAdminT();
  const meta = rosterStatusMeta(row.status);
  const stream = row.stream;
  const sc = stream ? streamColors(stream) : null;
  const pct = row.percentage != null ? `${row.percentage}%` : calcPct(row.totalMarks, row.obtainedMarks) != null ? `${calcPct(row.totalMarks, row.obtainedMarks)}%` : "—";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(42,38,32,.5)] p-6" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-[18px] bg-white shadow-[0_30px_60px_rgba(0,0,0,.34)]"
        onClick={stop}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#F1EBDE] bg-white px-6 py-4">
          <h3 className="text-base font-extrabold text-[#2A2620]">
            {t("res.verifyResult")} — {levelLabel(standard, lang, occupationTree)}
          </h3>
          <button type="button" onClick={onClose} className="cursor-pointer text-xl leading-none text-[#A79E92]">
            ✕
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-[1.1fr_1fr]">
            <div className="relative min-h-[260px]">
              {row.marksheetUrl ? (
                isPdf(row.marksheetUrl) ? (
                  <iframe
                    src={row.marksheetUrl}
                    title={t("res.marksheet")}
                    className="h-full min-h-[260px] w-full rounded-xl border border-[#EDE4D4]"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.marksheetUrl}
                    alt={t("res.marksheet")}
                    className="h-full min-h-[260px] w-full rounded-xl border border-[#EDE4D4] object-cover bg-[#FBFAF7]"
                  />
                )
              ) : (
                <div className="flex h-full min-h-[260px] w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#3B4A63] to-[#22304A] text-[13px] text-white/50">
                  {t("res.noMarksheet")}
                </div>
              )}
              {row.marksheetUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(row.marksheetUrl!, "_blank", "noopener,noreferrer");
                  }}
                  aria-label={t("res.viewFullSize")}
                  title={t("res.viewFullSize")}
                  className="absolute right-2 top-2 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full border border-[#E1BFC3] bg-white text-[#A62A38] shadow-sm transition-colors hover:bg-[#FDF4F5]"
                >
                  <Maximize2 className="size-4" strokeWidth={2.2} />
                </button>
              )}
            </div>
            <div>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex size-[46px] shrink-0 items-center justify-center rounded-[13px] bg-[#FBEBEC] text-lg font-extrabold text-[#A62A38]">
                  {row.init}
                </div>
                <div>
                  <div className="text-[15px] font-extrabold text-[#2A2620]">{row.studentName}</div>
                  <span
                    className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    {t(STATUS_KEYS[row.status])}
                  </span>
                </div>
              </div>
              <table className="mb-3 w-full text-[13px]">
                <tbody>
                  {[
                    [t("res.thFamily"), row.familyLabel],
                    [t("res.thMobile"), row.mobile || "—"],
                    [
                      t("res.standard"),
                      stream && sc ? (
                        <span key="std">
                          {levelLabel(standard, lang, occupationTree)}{" "}
                          <span
                            className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
                            style={{ background: sc.bg, color: sc.fg }}
                          >
                            {streamLabel(stream, lang)}
                          </span>
                        </span>
                      ) : (
                        levelLabel(standard, lang, occupationTree)
                      ),
                    ],
                    [t("res.totalMarks"), row.totalMarks ?? "—"],
                    [t("res.obtained"), row.obtainedMarks ?? "—"],
                    [t("res.nextStatus"), nextStatusLabel(row, lang)],
                  ].map(([label, val]) => (
                    <tr key={String(label)}>
                      <td className="w-[110px] py-1.5 text-[#938C80]">{label}</td>
                      <td className="py-1.5 text-[#2A2620]">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="rounded-xl border border-[#B7E6C6] bg-[#F0FBF3] px-3 py-3 text-center">
                <div className="text-[26px] font-extrabold text-[#22A45D]">{pct}</div>
                <div className="text-[11.5px] text-[#6B6357]">{t("res.autoCalcNote")}</div>
              </div>
            </div>
          </div>
          {!viewOnly && row.status !== "none" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminBtn onClick={onApprove} disabled={busy}>
                ✓ {t("res.approve")}
              </AdminBtn>
              <AdminBtn variant="ghost" onClick={onSaveNext} disabled={busy}>
                ✓ {t("res.saveNext")}
              </AdminBtn>
              <AdminBtn variant="ghost" onClick={onReject} disabled={busy} className="!text-[#B0303A] !border-[#EFCED1]">
                ✕ {t("res.reject")}
              </AdminBtn>
              {hasNav && (
                <>
                  <div className="flex-1" />
                  <AdminBtn variant="ghost" onClick={onPrev} disabled={busy}>
                    ‹ {t("res.prev")}
                  </AdminBtn>
                  <AdminBtn variant="ghost" onClick={onNext} disabled={busy}>
                    {t("res.next")} ›
                  </AdminBtn>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RejectResultModal({
  row,
  onClose,
  onConfirm,
  busy,
}: {
  row: RosterRow;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  busy: boolean;
}) {
  const { t } = useAdminT();
  // Only a WhatsApp-API community actually sends that notice.
  const waOn = useCommunity().authMode === "WHATSAPP_API";
  const [reason, setReason] = useState("");
  const [err, setErr] = useState(false);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(42,38,32,.5)] p-6" onClick={onClose}>
      <div
        className="w-full max-w-[380px] rounded-2xl bg-white shadow-[0_30px_60px_rgba(0,0,0,.34)]"
        onClick={stop}
      >
        <div className="border-b border-[#F1EBDE] px-6 py-[18px]">
          <h3 className="text-base font-extrabold text-[#2A2620]">{t("res.rejectResult")}</h3>
          <p className="mt-0.5 text-[12px] text-[#938C80]">
            {row.studentName} — {t(waOn ? "res.rejectNote" : "res.rejectNoteNoWa")}
          </p>
        </div>
        <div className="px-6 py-[18px]">
          <AdminLabel>{t("res.rejectReason")}</AdminLabel>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {REJECT_REASON_CHIPS.map((chip) => {
              const label = t(CHIP_KEYS[chip]);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setReason(label)}
                  className="cursor-pointer rounded-2xl border-[1.5px] px-3 py-1.5 text-[12px] font-bold"
                  style={{
                    borderColor: reason === label ? "#B0303A" : "#E6E0D3",
                    background: reason === label ? "#FCE7E7" : "#fff",
                    color: reason === label ? "#B0303A" : "#6B6357",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("res.reasonPlaceholder")}
            className="mb-2 min-h-[70px] w-full resize-none rounded-[11px] border-[1.5px] border-[#EDE4D4] bg-[#FCFAF6] px-3 py-2.5 text-[13px] text-[#2A2320] outline-none"
          />
          {err && <p className="mb-2 text-[12px] font-semibold text-[#B0303A]">{t("res.reasonRequired")}</p>}
          <div className="mt-1.5 flex gap-2.5">
            <AdminBtn
              className="flex-1 justify-center !bg-gradient-to-br !from-[#B0303A] !to-[#8A1F28]"
              disabled={busy}
              onClick={() => {
                if (!reason.trim()) return setErr(true);
                onConfirm(reason.trim());
              }}
            >
              {t("res.rejectResult")}
            </AdminBtn>
            <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={onClose}>
              {t("common.cancel")}
            </AdminBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UploadResultModal({
  row,
  driveId,
  occupationTree,
  onClose,
  onSaved,
}: {
  row: RosterRow;
  driveId: string;
  occupationTree: OccupationTreeNode[];
  onClose: () => void;
  onSaved: (updated: RosterRow) => void;
}) {
  const { t, lang } = useAdminT();
  const fileRef = useRef<HTMLInputElement>(null);
  const isHigher = HIGHER_STANDARDS.has(row.standard);
  const showStream = STREAM_STANDARDS.has(row.standard);
  const [course, setCourse] = useState(row.course || "");
  const [specialization, setSpecialization] = useState(row.specialization || "");
  const showSpecialization =
    isHigher && specializationOptionsForCourse(occupationTree, row.standard, course).options.length > 0;
  const [total, setTotal] = useState(row.totalMarks?.toString() || "");
  const [obtained, setObtained] = useState(row.obtainedMarks?.toString() || "");
  const [marksheetUrl, setMarksheetUrl] = useState(row.marksheetUrl || "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNextStandard, setShowNextStandard] = useState(false);

  const pct = useMemo(() => {
    const p = calcPct(Number(total), Number(obtained));
    return p != null ? `${p}%` : "—";
  }, [total, obtained]);

  const sc = row.stream ? streamColors(row.stream) : null;

  async function pickFile(file: File) {
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    body.append("folder", "results");
    const res = await api.upload<{ url: string }>("/api/upload", body);
    setUploading(false);
    if (!res.ok) return setError(res.error);
    setMarksheetUrl(res.data.url);
  }

  function save() {
    setError(null);
    if (!isHigher) {
      const tot = Number(total);
      const o = Number(obtained);
      if (!tot) return setError(t("res.errTotalMarks"));
      if (o > tot) return setError(t("res.errObtainedExceeds"));
    } else if (!course.trim()) {
      return setError(t("res.errCourseName"));
    }
    // What's next is compulsory — always ask, even after "Decide later"
    // backed out of it once. There's no way to save without answering it.
    setShowNextStandard(true);
  }

  async function finalizeSave(next: NextStandardValue | null) {
    setBusy(true);
    setError(null);
    const common = {
      memberId: row.memberId ?? undefined,
      studentName: row.studentName,
      standard: row.standard,
      stream: row.stream ?? undefined,
      course: isHigher ? course.trim() : undefined,
      specialization: isHigher && showSpecialization ? specialization.trim() || undefined : undefined,
      ...(isHigher ? {} : { totalMarks: Number(total), obtainedMarks: Number(obtained) }),
      marksheetUrl: marksheetUrl || undefined,
      // Skipping ("Decide later") omits these entirely — on an edit that
      // leaves whatever next-standard decision was already recorded alone.
      ...(next
        ? {
            studyOutcome: next.studyOutcome,
            nextStandard: next.nextStandard ?? undefined,
            nextStream: next.nextStream ?? undefined,
            nextCourse: next.nextCourse ?? undefined,
            nextSpecialization: next.nextSpecialization ?? undefined,
          }
        : {}),
    };

    type EntryPayload = {
      id: string;
      percentage: number | null;
      marksheetUrl: string | null;
      status: string;
      nextStandard: string | null;
      nextStream: string | null;
      nextCourse: string | null;
      nextSpecialization: string | null;
      studyOutcome: string | null;
    };

    let entry: EntryPayload;
    if (row.entryId) {
      // Admin entering/editing a result on the student's behalf is itself the
      // verification — it goes straight to Approved rather than back into the
      // Pending queue. Only a family/student upload needs a separate Verify.
      const res = await api.patch<{ entry: EntryPayload }>("/api/results", {
        id: row.entryId,
        ...common,
        status: "APPROVED",
        rejectReason: null,
      });
      setBusy(false);
      if (!res.ok) return setError(res.error);
      entry = res.data.entry;
    } else {
      const res = await api.post<EntryPayload>("/api/results", {
        driveId,
        ...common,
      });
      setBusy(false);
      if (!res.ok) return setError(res.error);
      entry = res.data;
    }

    setShowNextStandard(false);
    onSaved({
      ...row,
      entryId: entry.id,
      course: isHigher ? course.trim() : row.course,
      specialization: isHigher && showSpecialization ? specialization.trim() || null : row.specialization,
      totalMarks: isHigher ? null : Number(total),
      obtainedMarks: isHigher ? null : Number(obtained),
      percentage: entry.percentage ?? calcPct(Number(total), Number(obtained)),
      marksheetUrl: entry.marksheetUrl ?? marksheetUrl,
      status: entry.status as RosterRow["status"],
      rejectReason: null,
      updatedAt: new Date().toISOString(),
      nextStandard: entry.nextStandard,
      nextStream: entry.nextStream,
      nextCourse: entry.nextCourse,
      nextSpecialization: entry.nextSpecialization,
      studyOutcome: entry.studyOutcome as RosterRow["studyOutcome"],
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(42,38,32,.5)] p-6" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-[400px] overflow-y-auto rounded-2xl bg-white shadow-[0_30px_60px_rgba(0,0,0,.34)]"
        onClick={stop}
      >
        <div className="border-b border-[#F1EBDE] px-6 py-[18px]">
          <h3 className="text-base font-extrabold text-[#2A2620]">{t("res.uploadResult")}</h3>
          <p className="mt-0.5 text-[12px] text-[#938C80]">
            {row.studentName} · {levelLabel(row.standard, lang, occupationTree)}
            {row.stream && sc ? (
              <>
                {" "}
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
                  style={{ background: sc.bg, color: sc.fg }}
                >
                  {streamLabel(row.stream, lang)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="px-6 py-[18px]">
          <AdminLabel>{isHigher ? t("res.degreeCert") : t("res.marksheetFile")}</AdminLabel>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickFile(f);
              e.target.value = "";
            }}
          />
          {/* Show what was actually uploaded — "Uploaded ✓" alone gave no way to
              tell whether the right file went up, or whether it is readable. */}
          <div
            role="button"
            tabIndex={uploading ? -1 : 0}
            onClick={() => !uploading && fileRef.current?.click()}
            onKeyDown={(e) => {
              if (!uploading && (e.key === "Enter" || e.key === " ")) fileRef.current?.click();
            }}
            aria-disabled={uploading}
            className="relative mb-3 flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[13px] border-[1.5px] border-dashed border-[#E1BFC3] bg-[#FDF4F5] p-2 text-[#A62A38] aria-disabled:pointer-events-none aria-disabled:opacity-60"
          >
            {uploading ? (
              <span className="flex h-14 items-center justify-center gap-2">
                <Loader2 className="size-6 animate-spin" />
                <span className="text-[13px] font-bold">{t("res.uploading")}</span>
              </span>
            ) : marksheetUrl ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(marksheetUrl, "_blank", "noopener,noreferrer");
                  }}
                  aria-label={t("res.viewFullSize")}
                  title={t("res.viewFullSize")}
                  className="absolute right-2 top-2 z-10 flex size-7 cursor-pointer items-center justify-center rounded-full border border-[#E1BFC3] bg-white text-[#A62A38] shadow-sm transition-colors hover:bg-[#FDF4F5]"
                >
                  <Maximize2 className="size-3.5" strokeWidth={2.2} />
                </button>
                {isPdf(marksheetUrl) ? (
                  <span className="flex h-14 w-full flex-col items-center justify-center gap-1.5 rounded-lg bg-white text-[#A62A38]">
                    <FileText className="size-7" strokeWidth={1.6} />
                    <span className="text-[12px] font-bold">{t("res.pdfUploaded")}</span>
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={marksheetUrl}
                    alt={t("res.uploadedMarksheet")}
                    className="max-h-44 w-full rounded-lg bg-white object-contain"
                  />
                )}
                <span className="text-[12.5px] font-bold">{t("res.uploadedTapReplace")}</span>
              </>
            ) : (
              <span className="flex h-14 flex-col items-center justify-center gap-1.5">
                <ImagePlus className="size-6" strokeWidth={1.6} />
                <span className="text-[13px] font-bold">{t("res.tapToUpload")}</span>
              </span>
            )}
          </div>

          {isHigher && (
            <>
              <AdminLabel>{t("res.degreeCourse")}</AdminLabel>
              <CourseField
                tree={occupationTree}
                standard={row.standard}
                value={course}
                onChange={(v) => {
                  setCourse(v);
                  setSpecialization("");
                }}
                lang={lang}
                variant="admin"
              />
            </>
          )}

          {showSpecialization && (
            <>
              <AdminLabel>{t("res.specialization")}</AdminLabel>
              <SpecializationField
                tree={occupationTree}
                standard={row.standard}
                course={course}
                value={specialization}
                onChange={setSpecialization}
                lang={lang}
                variant="admin"
              />
            </>
          )}

          {!isHigher && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <AdminLabel>{t("res.totalMarks")}</AdminLabel>
                  <AdminInput
                    type="number"
                    min={0}
                    value={total}
                    onChange={(v) => setTotal(v.replace(/^-+/, ""))}
                  />
                </div>
                <div>
                  <AdminLabel>{t("res.obtainedMarks")}</AdminLabel>
                  <AdminInput
                    type="number"
                    min={0}
                    value={obtained}
                    onChange={(v) => {
                      const clean = v.replace(/^-+/, "");
                      const tot = Number(total);
                      const o = Number(clean);
                      setObtained(clean !== "" && tot > 0 && !Number.isNaN(o) && o > tot ? total : clean);
                    }}
                  />
                </div>
              </div>
              <div className="mt-3 mb-1 rounded-xl border border-[#B7E6C6] bg-[#F0FBF3] px-3 py-2.5 text-center">
                <div className="text-[22px] font-extrabold text-[#22A45D]">{pct}</div>
                <div className="text-[11.5px] text-[#6B6357]">auto-calculated</div>
              </div>
            </>
          )}

          {error && (
            <div className="mb-1 rounded-[11px] border border-[#EFCED1] bg-[#FCE7E7] px-3 py-2.5 text-[12.5px] font-semibold text-[#B0303A]">
              {error}
            </div>
          )}

          <div className="flex gap-2.5">
            <AdminBtn className="flex-1 justify-center" onClick={save} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Save result"}
            </AdminBtn>
            <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={onClose}>
              Cancel
            </AdminBtn>
          </div>
        </div>
      </div>

      {showNextStandard && (
        <NextStandardModal
          studentName={row.studentName}
          currentStandard={row.standard}
          lang={lang}
          busy={busy}
          occupationTree={occupationTree}
          initial={
            row.studyOutcome
              ? {
                  studyOutcome: row.studyOutcome,
                  nextStandard: row.nextStandard,
                  nextStream: row.nextStream,
                  nextCourse: row.nextCourse,
                  nextSpecialization: row.nextSpecialization,
                }
              : null
          }
          onSkip={() => setShowNextStandard(false)}
          onConfirm={(value) => void finalizeSave(value)}
        />
      )}
    </div>
  );
}

export function openWhatsAppNotify(mobile: string | null | undefined, message: string) {
  const d = (mobile || "").replace(/\D/g, "");
  if (!d) return;
  const url = `${waLink(mobile)}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Only one result drive is ever live at a time, so closing one is a real
 * decision — this shows exactly who is still incomplete before it happens,
 * instead of silently locking them out.
 */
export function CloseDriveModal({
  open,
  driveTitle,
  notUploaded,
  incomplete,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  driveTitle: string;
  /** Students with no result uploaded at all. */
  notUploaded: RosterRow[];
  /** Students with a result uploaded that isn't fully processed (still pending/rejected, or approved without a next-standard decision). */
  incomplete: RosterRow[];
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const { t, tf } = useAdminT();
  const allClear = notUploaded.length === 0 && incomplete.length === 0;

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={t("res.closeDriveTitle")}
      subtitle={tf("res.closeDriveSubtitle", { title: driveTitle })}
      width="lg"
      footer={
        <AdminModalActions
          onSave={onConfirm}
          onCancel={onClose}
          saveLabel={t("res.closeDrive")}
          cancelLabel={t("common.cancel")}
          variant="danger"
          busy={busy}
        />
      }
    >
      {allClear ? (
        <p className="rounded-xl border border-[#B7E6C6] bg-[#F0FBF3] px-4 py-3 text-[13px] font-semibold text-[#1E7A44]">
          {t("res.allClearSafeToClose")}
        </p>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto">
          {notUploaded.length > 0 && (
            <RosterWarningSection
              title={tf("res.notUploadedYet", { n: notUploaded.length })}
              rows={notUploaded}
              tone="danger"
            />
          )}
          {incomplete.length > 0 && (
            <RosterWarningSection
              title={tf("res.uploadedIncomplete", { n: incomplete.length })}
              subtitle={t("res.incompleteSubtitle")}
              rows={incomplete}
              tone="warn"
            />
          )}
        </div>
      )}
    </AdminModal>
  );
}

function RosterWarningSection({
  title,
  subtitle,
  rows,
  tone,
}: {
  title: string;
  subtitle?: string;
  rows: RosterRow[];
  tone: "danger" | "warn";
}) {
  const color = tone === "danger" ? "#B0303A" : "#B0801E";
  const bg = tone === "danger" ? "#FCE7E7" : "#FCEFD6";
  return (
    <div className="mb-3.5 last:mb-0">
      <div className="mb-1.5 text-[12.5px] font-extrabold" style={{ color }}>
        {title}
      </div>
      {subtitle && <div className="mb-2 text-[11.5px] text-[#938C80]">{subtitle}</div>}
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => {
          const meta = rosterStatusMeta(r.status);
          return (
            <div
              key={r.entryId ?? r.memberId ?? r.studentName}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[11px] px-3 py-2 text-[12.5px]"
              style={{ background: bg }}
            >
              <span className="font-bold text-[#2A2620]">
                {r.studentName} <span className="font-medium text-[#8B8375]">· {r.standard}</span>
              </span>
              <span className="flex items-center gap-1.5">
                {r.mobile && <span className="text-[#8B8375]">{r.mobile}</span>}
                {r.status !== "none" && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    {meta.label}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
