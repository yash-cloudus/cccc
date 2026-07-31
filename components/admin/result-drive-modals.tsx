"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, ImagePlus, Loader2 } from "lucide-react";
import { AdminBtn, AdminInput, AdminLabel } from "@/components/admin/admin-ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  HIGHER_STANDARDS,
  REJECT_REASON_CHIPS,
  STREAM_STANDARDS,
  calcPct,
  isPdf,
  rosterStatusMeta,
  streamColors,
  type RosterRow,
} from "@/lib/result-drive";
import { api } from "@/lib/http";
import { useAdminT } from "@/lib/i18n/admin-dictionary";
import { DEFAULT_STREAMS, EDUCATION_LEVELS } from "@/lib/occupation-defaults";
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

/** Display name for a standard / stream — the seed lists carry both languages. */
function levelLabel(value: string, lang: string): string {
  const m = EDUCATION_LEVELS.find((l) => l.nameEn === value || l.nameGu === value);
  return m ? (lang === "gu" ? m.nameGu : m.nameEn) : value;
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
            {t("res.verifyResult")} — {levelLabel(standard, lang)}
          </h3>
          <button type="button" onClick={onClose} className="cursor-pointer text-xl leading-none text-[#A79E92]">
            ✕
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-[1.1fr_1fr]">
            <div>
              {row.marksheetUrl ? (
                isPdf(row.marksheetUrl) ? (
                  <iframe
                    src={row.marksheetUrl}
                    title={t("res.marksheet")}
                    className="h-[260px] w-full rounded-xl border border-[#EDE4D4]"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.marksheetUrl}
                    alt={t("res.marksheet")}
                    className="max-h-[260px] w-full rounded-xl border border-[#EDE4D4] object-contain bg-[#FBFAF7]"
                  />
                )
              ) : (
                <div className="flex h-[260px] w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#3B4A63] to-[#22304A] text-[13px] text-white/50">
                  {t("res.noMarksheet")}
                </div>
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
                    [t("res.thSchool"), row.schoolName || "—"],
                    [
                      t("res.standard"),
                      stream && sc ? (
                        <span key="std">
                          {levelLabel(standard, lang)}{" "}
                          <span
                            className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
                            style={{ background: sc.bg, color: sc.fg }}
                          >
                            {streamLabel(stream, lang)}
                          </span>
                        </span>
                      ) : (
                        levelLabel(standard, lang)
                      ),
                    ],
                    [t("res.totalMarks"), row.totalMarks ?? "—"],
                    [t("res.obtained"), row.obtainedMarks ?? "—"],
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
            {row.studentName} — {t("res.rejectNote")}
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
  onClose,
  onSaved,
}: {
  row: RosterRow;
  driveId: string;
  onClose: () => void;
  onSaved: (updated: RosterRow) => void;
}) {
  const { t, lang } = useAdminT();
  const fileRef = useRef<HTMLInputElement>(null);
  const isHigher = HIGHER_STANDARDS.has(row.standard);
  const showStream = STREAM_STANDARDS.has(row.standard);
  const [school, setSchool] = useState(row.schoolName || "");
  const [course, setCourse] = useState(row.course || "");
  const [total, setTotal] = useState(row.totalMarks?.toString() || "");
  const [obtained, setObtained] = useState(row.obtainedMarks?.toString() || "");
  const [marksheetUrl, setMarksheetUrl] = useState(row.marksheetUrl || "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function save() {
    setError(null);
    if (!isHigher) {
      const tot = Number(total);
      const o = Number(obtained);
      if (!tot) return setError(t("res.errTotalMarks"));
      if (o > tot) return setError(t("res.errObtainedExceeds"));
    } else if (!course.trim()) {
      return setError(t("res.errCourseName"));
    }

    setBusy(true);
    const common = {
      memberId: row.memberId ?? undefined,
      studentName: row.studentName,
      standard: row.standard,
      stream: row.stream ?? undefined,
      course: isHigher ? course.trim() : undefined,
      schoolName: school.trim() || undefined,
      ...(isHigher ? {} : { totalMarks: Number(total), obtainedMarks: Number(obtained) }),
      marksheetUrl: marksheetUrl || undefined,
    };

    type EntryPayload = {
      id: string;
      percentage: number | null;
      marksheetUrl: string | null;
      status: string;
    };

    let entry: EntryPayload;
    if (row.entryId) {
      const res = await api.patch<{ entry: EntryPayload }>("/api/results", {
        id: row.entryId,
        ...common,
        status: "PENDING",
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

    onSaved({
      ...row,
      entryId: entry.id,
      schoolName: school.trim() || null,
      course: isHigher ? course.trim() : row.course,
      totalMarks: isHigher ? null : Number(total),
      obtainedMarks: isHigher ? null : Number(obtained),
      percentage: entry.percentage ?? calcPct(Number(total), Number(obtained)),
      marksheetUrl: entry.marksheetUrl ?? marksheetUrl,
      status: "PENDING",
      rejectReason: null,
      updatedAt: new Date().toISOString(),
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
            {row.studentName} · {levelLabel(row.standard, lang)}
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
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mb-3 flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[13px] border-[1.5px] border-dashed border-[#E1BFC3] bg-[#FDF4F5] p-2 text-[#A62A38] disabled:opacity-60"
          >
            {uploading ? (
              <span className="flex h-24 items-center justify-center gap-2">
                <Loader2 className="size-6 animate-spin" />
                <span className="text-[13px] font-bold">{t("res.uploading")}</span>
              </span>
            ) : marksheetUrl ? (
              <>
                {isPdf(marksheetUrl) ? (
                  <span className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg bg-white text-[#A62A38]">
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
              <span className="flex h-24 flex-col items-center justify-center gap-1.5">
                <ImagePlus className="size-6" strokeWidth={1.6} />
                <span className="text-[13px] font-bold">{t("res.tapToUpload")}</span>
              </span>
            )}
          </button>

          <AdminLabel>School / College</AdminLabel>
          <AdminInput value={school} onChange={setSchool} placeholder="School name" />

          {isHigher && (
            <>
              <AdminLabel>Degree / Course name *</AdminLabel>
              <AdminInput value={course} onChange={setCourse} placeholder="e.g. B.Com, Mechanical Engineering" />
            </>
          )}

          {!isHigher && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <AdminLabel>Total marks</AdminLabel>
                  <AdminInput type="number" value={total} onChange={setTotal} />
                </div>
                <div>
                  <AdminLabel>Obtained marks</AdminLabel>
                  <AdminInput type="number" value={obtained} onChange={setObtained} />
                </div>
              </div>
              <div className="my-3 rounded-xl border border-[#B7E6C6] bg-[#F0FBF3] px-3 py-2.5 text-center">
                <div className="text-[22px] font-extrabold text-[#22A45D]">{pct}</div>
                <div className="text-[11.5px] text-[#6B6357]">auto-calculated</div>
              </div>
            </>
          )}

          {error && (
            <div className="mb-3 rounded-[11px] border border-[#EFCED1] bg-[#FCE7E7] px-3 py-2.5 text-[12.5px] font-semibold text-[#B0303A]">
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
    </div>
  );
}

export function openWhatsAppNotify(mobile: string | null | undefined, message: string) {
  const d = (mobile || "").replace(/\D/g, "");
  if (!d) return;
  const url = `${waLink(mobile)}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
