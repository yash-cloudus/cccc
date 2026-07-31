"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, FileText, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { PickerWithAdd } from "@/components/ui/picker-with-add";
import { NextStandardModal, type NextStandardValue } from "@/components/results/next-standard-modal";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { DEFAULT_STREAMS, EDUCATION_LEVELS } from "@/lib/occupation-defaults";
import { HIGHER_STANDARDS, STREAM_STANDARDS, canonicalStream, isPdf } from "@/lib/result-drive";
import { pickText, titleWithYear } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DriveInfo = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  year: number;
  isOpen: boolean;
  isPublished: boolean;
};

export type ChildOption = {
  id: string;
  name: string;
  nameEn: string;
  nameGu: string | null;
  standard: string | null;
  familyLabel: string;
  course: string | null;
};

export type MyEntry = {
  id: string;
  studentName: string;
  standard: string;
  percentage: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RESUBMIT";
  rejectReason: string | null;
  marksheetUrl: string | null;
};

export type TopperRow = {
  id: string;
  studentName: string;
  standard: string;
  percentage: number | null;
  city: string | null;
};

type Tab = "upload" | "mine" | "toppers";

const RANK_GRADIENTS = [
  "linear-gradient(150deg,#F0B33A,#D98A1E)",
  "linear-gradient(150deg,#C3C9D2,#9AA3AF)",
  "linear-gradient(150deg,#D9A066,#B87A3E)",
];

const TOPPER_AVATARS = [
  { fg: "#B0303A", bg: "#FCE7E7" },
  { fg: "#3D6B8C", bg: "#E7F0FB" },
  { fg: "#6A4E9C", bg: "#F0ECFB" },
  { fg: "#4E7A45", bg: "#EAF6EC" },
  { fg: "#B26A1E", bg: "#FEF3E0" },
];

const eduLabel = (std: string, lang: "gu" | "en") =>
  lang === "gu"
    ? (EDUCATION_LEVELS.find((l) => l.nameEn === std)?.nameGu ?? std)
    : std;

/** A stored stream shown in the reader's language, whichever it was saved in. */
const streamLabel = (stream: string | null | undefined, lang: "gu" | "en") => {
  const en = canonicalStream(stream);
  if (!en) return "";
  const hit = DEFAULT_STREAMS.find((s) => s.nameEn === en);
  return lang === "gu" ? (hit?.nameGu ?? en) : en;
};

const childName = (c: { name: string; nameEn: string; nameGu: string | null }, lang: "gu" | "en") =>
  lang === "gu" ? c.nameGu || c.nameEn : c.nameEn || c.name;

export function ResultsClient({
  drive,
  childOptions,
  myEntries,
  toppers,
  signedIn,
  uploadFocus = false,
  studentUploadEnabled = true,
  showMeritTab = true,
}: {
  drive: DriveInfo | null;
  childOptions: ChildOption[];
  myEntries: MyEntry[];
  toppers: TopperRow[];
  signedIn: boolean;
  uploadFocus?: boolean;
  studentUploadEnabled?: boolean;
  showMeritTab?: boolean;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const [tab, setTab] = useState<Tab>("upload");

  const title = drive
    ? titleWithYear(pickText(drive.titleGu, drive.titleEn, lang), drive.year)
    : T("પરિણામ", "Results");

  const tabs: { key: Tab; label: string }[] =
    uploadFocus || !showMeritTab
      ? [
          { key: "upload", label: T("અપલોડ", "Upload") },
          { key: "mine", label: T("મારા અપલોડ", "My uploads") },
        ]
      : [
          { key: "upload", label: T("અપલોડ", "Upload") },
          { key: "mine", label: T("મારા અપલોડ", "My uploads") },
          { key: "toppers", label: T("ટોપર્સ", "Toppers") },
        ];

  useEffect(() => {
    if (uploadFocus && tab === "toppers") setTab("upload");
  }, [uploadFocus, tab]);

  if (!drive) {
    return (
      <AppScreen showNav={false}>
        <BackHeader title={T("પરિણામ", "Results")} />
        <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
          {T("પરિણામ ડ્રાઈવ હજુ શરૂ થઈ નથી", "No result drive has started yet")}
        </p>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <BackHeader
        title={title}
        right={
          <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-white/14">
            <Award className="h-[21px] w-[21px]" strokeWidth={1.7} />
          </div>
        }
      />

      <div className="samaj-header flex-none px-[18px] pb-4">
        <div className="mt-4 flex gap-1.5 rounded-[14px] bg-white/12 p-1">
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setTab(x.key)}
              className={cn(
                "flex-1 cursor-pointer rounded-[11px] py-2.5 text-[12.5px] font-bold transition-colors",
                tab === x.key ? "bg-white text-[var(--brand)]" : "text-white/80",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 pb-8">
        {tab === "upload" && (
          <UploadTab
            drive={drive}
            childOptions={childOptions}
            signedIn={signedIn}
            studentUploadEnabled={studentUploadEnabled}
            onDone={() => {
              setTab("mine");
              router.refresh();
            }}
          />
        )}
        {tab === "mine" && <MyUploadsTab entries={myEntries} signedIn={signedIn} />}
        {tab === "toppers" && !uploadFocus && <ToppersTab drive={drive} rows={toppers} />}
      </div>
    </AppScreen>
  );
}

/* ────────────────────────────── 1 · Upload ────────────────────────────── */

const STANDARDS = EDUCATION_LEVELS.map((l) => ({ value: l.nameEn, label: l.nameGu }));

const standardKey = (v: string | null) =>
  EDUCATION_LEVELS.find((l) => l.nameEn === v || l.nameGu === v)?.nameEn ?? "";

function UploadTab({
  drive,
  childOptions,
  signedIn,
  studentUploadEnabled,
  onDone,
}: {
  drive: DriveInfo;
  childOptions: ChildOption[];
  signedIn: boolean;
  studentUploadEnabled: boolean;
  onDone: () => void;
}) {
  const { lang } = useLang();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);
  const fileRef = useRef<HTMLInputElement>(null);

  const [memberId, setMemberId] = useState("");
  const [standard, setStandard] = useState("");
  const [stream, setStream] = useState("");
  const [courseName, setCourseName] = useState("");
  const [total, setTotal] = useState("");
  const [obtained, setObtained] = useState("");
  const [marksheetUrl, setMarksheetUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showNextStandard, setShowNextStandard] = useState(false);

  const selectedChild = childOptions.find((c) => c.id === memberId) ?? null;
  const isHigher = HIGHER_STANDARDS.has(standard);
  const showStream = STREAM_STANDARDS.has(standard);

  const percentage = useMemo(() => {
    const t = Number(total);
    const o = Number(obtained);
    if (!t || o < 0 || Number.isNaN(o) || o > t) return null;
    return Math.round((o / t) * 10000) / 100;
  }, [total, obtained]);

  if (!signedIn) {
    return (
      <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
        {T("પરિણામ અપલોડ કરવા લોગિન કરો", "Sign in to upload a result")}
      </p>
    );
  }

  if (!drive.isOpen) {
    return (
      <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
        {T("અપલોડ બંધ છે", "Uploads are closed")}
      </p>
    );
  }

  if (!studentUploadEnabled) {
    return (
      <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
        {T("અપલોડ હાલ બંધ છે — એડમિન સંપર્ક કરો", "Uploads are currently disabled — contact admin")}
      </p>
    );
  }

  async function pickFile(file: File) {
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    body.append("folder", "results");
    const res = await api.upload<{ url: string }>("/api/upload", body);
    setUploading(false);
    if (!res.ok) return toast.error(res.error);
    setMarksheetUrl(res.data.url);
  }

  function submit() {
    const child = childOptions.find((c) => c.id === memberId);
    if (!child) return toast.error(T("બાળક પસંદ કરો", "Pick a child"));
    if (!standard) return toast.error(T("ધોરણ પસંદ કરો", "Pick a standard"));
    if (showStream && !stream) return toast.error(T("પ્રવાહ પસંદ કરો", "Pick a stream"));
    if (isHigher && !courseName.trim()) {
      return toast.error(T("કોર્સ / ડિગ્રીનું નામ ભરો", "Enter degree / course name"));
    }
    if (!isHigher && percentage == null) {
      return toast.error(T("સાચા ટોટલ અને મેળવેલ ગુણ ભરો", "Enter valid total and obtained marks"));
    }
    if (!marksheetUrl) {
      return toast.error(
        isHigher
          ? T("સર્ટિફિકેટ અપલોડ કરો", "Upload the certificate")
          : T("માર્કશીટ અપલોડ કરો", "Upload the marksheet"),
      );
    }
    // Current result is ready — ask what's next before actually submitting.
    setShowNextStandard(true);
  }

  async function submitWithNext(next: NextStandardValue | null) {
    const child = childOptions.find((c) => c.id === memberId);
    if (!child) return;

    setBusy(true);
    const res = await api.post("/api/results", {
      driveId: drive.id,
      memberId: child.id,
      studentName: child.name,
      standard,
      stream: showStream ? stream : undefined,
      course: isHigher ? courseName.trim() : undefined,
      ...(isHigher
        ? {}
        : {
            totalMarks: Number(total),
            obtainedMarks: Number(obtained),
          }),
      marksheetUrl,
      ...(next
        ? {
            studyOutcome: next.studyOutcome,
            nextStandard: next.nextStandard ?? undefined,
            nextStream: next.nextStream ?? undefined,
            nextCourse: next.nextCourse ?? undefined,
          }
        : {}),
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setShowNextStandard(false);
    toast.success(T("પરિણામ મોકલાયું — ચકાસણી બાકી", "Result submitted — pending verification"));
    setMemberId("");
    setStandard("");
    setStream("");
    setCourseName("");
    setTotal("");
    setObtained("");
    setMarksheetUrl("");
    onDone();
  }

  const uploadLabel = isHigher
    ? T("ડિગ્રી / ડિપ્લોમા સર્ટિફિકેટ", "Degree / Diploma certificate")
    : T("માર્કશીટનો ફોટો / PDF", "Marksheet photo / PDF");

  return (
    <>
      <h2 className="mb-3.5 px-0.5 text-[15px] font-extrabold text-[var(--ink)]">
        {T("બાળકોનું પરિણામ અપલોડ કરો", "Upload your children's results")}
      </h2>

      <div className="rounded-[20px] border border-[var(--gold-border)] bg-white p-4 shadow-[0_2px_6px_rgba(42,35,32,.05)]">
        <div className="mb-3 flex items-center justify-between">
          <b className="text-[15px] text-[var(--ink)]">{T("બાળક 1", "Child 1")}</b>
        </div>

        <Label>{T("બાળક પસંદ કરો (તમારા પરિવારમાંથી)", "Select child (from your family)")}</Label>
        <Select
          value={memberId}
          onChange={(v) => {
            setMemberId(v);
            const child = childOptions.find((x) => x.id === v);
            const key = standardKey(child?.standard ?? null);
            if (key) setStandard(key);
            // The child's stream is stored in their own language ("વાણિજ્ય"),
            // but the picker's options are keyed by English name — setting the
            // raw value matched no option, so the field sat on "Select".
            if (STREAM_STANDARDS.has(key)) setStream(canonicalStream(child?.course) ?? "");
          }}
          placeholder={T("બાળક પસંદ કરો…", "Select a child…")}
          options={childOptions.map((c) => ({
            value: c.id,
            label: `${childName(c, lang)} · ${eduLabel(standardKey(c.standard) || "—", lang)}`,
          }))}
          emptyText={T("તમારા પરિવારમાં કોઈ સભ્ય નથી", "No members in your family")}
        />

        {selectedChild && (
          <div className="mb-3 rounded-[13px] border border-[#EDE4D4] bg-[#F6F3EC] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#57524A]">
            <b className="text-[var(--ink)]">{childName(selectedChild, lang)}</b>
            <br />
            {T("પરિવાર", "Family")}: {selectedChild.familyLabel}
            {" · "}
            {T("અભ્યાસ", "Education")}: {eduLabel(standardKey(selectedChild.standard) || standard || "—", lang)}
            {selectedChild.course && STREAM_STANDARDS.has(standard)
              ? ` · ${streamLabel(selectedChild.course, lang) || selectedChild.course}`
              : null}
          </div>
        )}

        <Label>{T("ધોરણ", "Standard")}</Label>
        <Select
          value={standard}
          onChange={(v) => {
            setStandard(v);
            if (!STREAM_STANDARDS.has(v)) setStream("");
            if (!HIGHER_STANDARDS.has(v)) setCourseName("");
          }}
          placeholder={T("પસંદ કરો", "Select")}
          options={STANDARDS.map((s) => ({
            value: s.value,
            label: lang === "gu" ? s.label : s.value,
          }))}
        />

        {showStream && (
          <>
            <Label>{T("પ્રવાહ", "Stream")} *</Label>
            <Select
              value={stream}
              onChange={setStream}
              placeholder={T("પસંદ કરો", "Select")}
              options={DEFAULT_STREAMS.map((s) => ({
                value: s.nameEn,
                label: lang === "gu" ? `${s.nameGu} (${s.nameEn})` : s.nameEn,
              }))}
            />
          </>
        )}

        {isHigher && (
          <>
            <Label>{T("ડિગ્રી / કોર્સનું નામ", "Degree / Course name")} *</Label>
            <input
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder={T("દા.ત. B.Com, મિકેનિકલ એન્જિનિયરિંગ", "e.g. B.Com, Mechanical Engineering")}
              className={FIELD}
            />
          </>
        )}

        {!isHigher && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{T("ટોટલ ગુણ", "Total marks")}</Label>
                <NumberInput value={total} onChange={setTotal} placeholder="500" />
              </div>
              <div>
                <Label>{T("મેળવેલ ગુણ", "Obtained marks")}</Label>
                <NumberInput value={obtained} onChange={setObtained} placeholder="432" />
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-[#B7E6C6] bg-[#F0FBF3] px-3.5 py-2.5 text-center">
              <b className="text-[18px] text-[#22A45D]">
                {percentage == null ? "—" : `${percentage}%`}
              </b>{" "}
              <span className="text-[11.5px] text-[#6B6357]">
                {T("· ઓટો ગણતરી", "· auto-calculated")}
              </span>
            </div>
          </>
        )}

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
        {/* Show the uploaded file, not just a tick — a parent needs to see that
            the right marksheet went up and that it is legible. */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-3 flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[15px] border-[1.5px] border-dashed border-[var(--brand-line)] bg-[var(--brand-tint-soft)] p-2.5 text-[var(--brand)] disabled:opacity-60"
        >
          {uploading ? (
            <span className="flex h-[120px] flex-col items-center justify-center gap-1.5">
              <Loader2 className="size-[30px] animate-spin" strokeWidth={1.6} />
              <span className="text-[13.5px] font-bold">{T("અપલોડ થાય છે…", "Uploading…")}</span>
            </span>
          ) : marksheetUrl ? (
            <>
              {isPdf(marksheetUrl) ? (
                <span className="flex h-[120px] w-full flex-col items-center justify-center gap-1.5 rounded-xl bg-white">
                  <FileText className="size-8" strokeWidth={1.6} />
                  <span className="text-[12.5px] font-bold">PDF</span>
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={marksheetUrl}
                  alt={uploadLabel}
                  className="max-h-52 w-full rounded-xl bg-white object-contain"
                />
              )}
              <span className="text-[13px] font-bold">{uploadLabel} ✓</span>
              <span className="text-[11.5px] text-[#C08A8F]">
                {T("બદલવા tap કરો", "tap to replace")}
              </span>
            </>
          ) : (
            <span className="flex h-[120px] flex-col items-center justify-center gap-1.5">
              <ImagePlus className="size-[30px]" strokeWidth={1.6} />
              <span className="text-[13.5px] font-bold">{uploadLabel}</span>
              <span className="text-[11.5px] text-[#C08A8F]">
                {T("tap કરીને અપલોડ કરો", "tap to upload")}
              </span>
            </span>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="samaj-btn mt-3 flex h-[52px] w-full cursor-pointer items-center justify-center text-[15px] disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          T("પરિણામ મોકલો (1 બાળક)", "Submit result (1 child)")
        )}
      </button>

      {showNextStandard && selectedChild && (
        <NextStandardModal
          studentName={childName(selectedChild, lang)}
          lang={lang}
          busy={busy}
          onSkip={() => void submitWithNext(null)}
          onConfirm={(value) => void submitWithNext(value)}
        />
      )}
    </>
  );
}

/* ─────────────────────────── 2 · My uploads ─────────────────────────── */

function MyUploadsTab({ entries, signedIn }: { entries: MyEntry[]; signedIn: boolean }) {
  const { lang } = useLang();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  if (!signedIn) {
    return (
      <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
        {T("તમારા અપલોડ જોવા લોગિન કરો", "Sign in to see your uploads")}
      </p>
    );
  }
  if (entries.length === 0) {
    return (
      <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
        {T("હજુ કોઈ પરિણામ મોકલ્યું નથી", "You have not submitted a result yet")}
      </p>
    );
  }

  const pill = (e: MyEntry) => {
    if (e.status === "APPROVED") {
      return { text: T("✓ મંજૂર", "✓ Approved"), bg: "#E4F5E9", fg: "#1E9E52" };
    }
    if (e.status === "REJECTED" || e.status === "RESUBMIT") {
      return { text: T("✕ ફરી મોકલો", "✕ Resubmit"), bg: "#FCE7E7", fg: "#B0303A" };
    }
    return { text: T("ચકાસણી બાકી", "Pending"), bg: "#FEF3E0", fg: "#B0801E" };
  };

  const note = (e: MyEntry) => {
    if (e.status === "APPROVED") {
      return e.percentage != null
        ? `${e.percentage}% — ${T("મંજૂર", "approved")}`
        : T("મંજૂર", "Approved");
    }
    if (e.status === "REJECTED" || e.status === "RESUBMIT") {
      return e.rejectReason || T("ફોટો ઝાંખો — ફરી અપલોડ", "Blurry photo — re-upload");
    }
    return T("માર્કશીટ મોકલી", "Marksheet submitted");
  };

  return (
    <>
      {entries.map((e) => {
        const p = pill(e);
        return (
          <div
            key={e.id}
            className="mb-3 flex items-center gap-3 rounded-[18px] border border-[#F0E9DB] bg-white p-3.5 shadow-[0_2px_4px_rgba(42,35,32,.04)]"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-[var(--ink)]">
                {e.studentName} · {eduLabel(e.standard, lang)}
              </div>
              <div className="mt-0.5 text-[12px] font-medium text-[#938C80]">{note(e)}</div>
            </div>
            <span
              className="flex-none rounded-full px-[11px] py-1.5 text-[11px] font-extrabold whitespace-nowrap"
              style={{ background: p.bg, color: p.fg }}
            >
              {p.text}
            </span>
          </div>
        );
      })}
    </>
  );
}

/* ───────────────────────────── 3 · Toppers ───────────────────────────── */

function ToppersTab({ drive, rows }: { drive: DriveInfo; rows: TopperRow[] }) {
  const { lang } = useLang();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const standards = useMemo(
    () => [...new Set(rows.map((r) => r.standard))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [rows],
  );
  const [std, setStd] = useState<string | null>(null);
  const active = std && standards.includes(std) ? std : standards[0];

  const ranked = rows
    .filter((r) => r.standard === active)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const footer = (
    <div className="mt-2 rounded-[14px] border border-[#EFE3CB] bg-[#FDF9F0] px-3.5 py-3 text-[12px] leading-relaxed text-[#8B7A55]">
      {T(
        "ફક્ત eligible (≥80%) વિદ્યાર્થીઓ દેખાય. Admin publish કરે પછી જ યાદી ખુલે.",
        "Only eligible (≥80%) students appear. The list opens after the admin publishes it.",
      )}
    </div>
  );

  if (!drive.isPublished || rows.length === 0) {
    return (
      <>
        <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">
          {T("પરિણામ હજુ પ્રકાશિત નથી", "Results not published yet")}
        </p>
        {footer}
      </>
    );
  }

  return (
    <>
      <div className="-mx-1 mb-3.5 flex gap-2 overflow-x-auto pb-1">
        {standards.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStd(s)}
            className={cn(
              "flex-none cursor-pointer rounded-full px-[15px] py-2 text-[13px] font-bold whitespace-nowrap",
              s === active
                ? "bg-[var(--brand)] text-white"
                : "border border-[#EDE4D4] bg-white text-[#6B6357]",
            )}
          >
            {eduLabel(s, lang)}
          </button>
        ))}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {ranked.map((r) => {
          const av = TOPPER_AVATARS[(r.rank - 1) % TOPPER_AVATARS.length];
          const rankBg =
            r.rank <= 3 ? RANK_GRADIENTS[r.rank - 1] : "#F0EBE0";
          const rankFg = r.rank <= 3 ? "#fff" : "#8B8375";
          return (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-[18px] border border-[#F0E9DB] bg-white px-3.5 py-3 shadow-[0_2px_4px_rgba(42,35,32,.04)]"
            >
              <span
                className="flex size-7 flex-none items-center justify-center rounded-[9px] text-[13px] font-extrabold"
                style={{ background: rankBg, color: rankFg }}
              >
                {r.rank}
              </span>
              <span
                className="flex size-10 flex-none items-center justify-center rounded-xl text-[15px] font-extrabold"
                style={{ background: av.bg, color: av.fg }}
              >
                {r.studentName.trim().charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-bold text-[var(--ink)]">
                  {r.studentName}
                </span>
                {r.city && (
                  <span className="block truncate text-[11.5px] font-medium text-[#938C80]">
                    {r.city}
                  </span>
                )}
              </span>
              <b className="flex-none text-[15px] text-[var(--brand)]">
                {r.percentage?.toFixed(1)}%
              </b>
            </div>
          );
        })}
      </div>

      {footer}
    </>
  );
}

/* ───────────────────────────── field bits ───────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 mb-1.5 text-[12px] font-bold text-[#8B8375]">{children}</div>
  );
}

const FIELD =
  "w-full h-12 rounded-[13px] border-[1.5px] border-[#EDE4D4] bg-[#FCFAF6] px-3.5 text-[14px] font-semibold text-[var(--ink)] outline-none";

function Select({
  value,
  onChange,
  options,
  placeholder,
  emptyText,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  emptyText?: string;
}) {
  const blank = options.length === 0 ? (emptyText ?? placeholder) : placeholder;
  return (
    <PickerWithAdd
      value={value}
      onChange={onChange}
      options={[{ value: "", label: blank }, ...options]}
      placeholder={blank}
      className={cn(
        "[&_button]:h-12 [&_button]:rounded-[13px] [&_button]:border-[#EDE4D4] [&_button]:bg-[#FCFAF6] [&_button]:text-[14px]",
        options.length === 0 ? "pointer-events-none opacity-60" : undefined,
      )}
    />
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      className={FIELD}
    />
  );
}
