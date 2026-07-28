"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppScreen } from "@/components/layout/app-screen";
import { BackHeader } from "@/components/layout/back-header";
import { useLang } from "@/providers/lang-provider";
import { api } from "@/lib/http";
import { EDUCATION_LEVELS } from "@/lib/occupation-defaults";
import { pickText } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DriveInfo = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  year: number;
  isOpen: boolean;
  isPublished: boolean;
};

export type ChildOption = { id: string; name: string; standard: string | null };

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

const MEDALS = ["#E8A33D", "#B9BEC9", "#C98A5B"];

export function ResultsClient({
  drive,
  childOptions,
  myEntries,
  toppers,
  signedIn,
}: {
  drive: DriveInfo | null;
  childOptions: ChildOption[];
  myEntries: MyEntry[];
  toppers: TopperRow[];
  signedIn: boolean;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);

  const [tab, setTab] = useState<Tab>("upload");
  const title = drive ? `${pickText(drive.titleGu, drive.titleEn, lang)} ${drive.year}` : T("પરિણામ", "Results");

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

  const tabs: { key: Tab; label: string }[] = [
    { key: "upload", label: T("અપલોડ", "Upload") },
    { key: "mine", label: T("મારા અપલોડ", "My uploads") },
    { key: "toppers", label: T("ટોપર્સ", "Toppers") },
  ];

  return (
    <AppScreen>
      <BackHeader
        title={title}
        right={
          <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-white/12">
            <Award className="h-[21px] w-[21px]" strokeWidth={1.7} />
          </div>
        }
      />

      <div className="samaj-header flex-none px-3 pb-3">
        <div className="flex gap-1.5 rounded-[14px] bg-white/12 p-1">
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setTab(x.key)}
              className={cn(
                "flex-1 rounded-[11px] py-2.5 text-[13px] font-bold transition-colors",
                tab === x.key ? "bg-white text-[var(--brand)]" : "text-white/85",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 pb-8">
        {tab === "upload" && (
          <UploadTab drive={drive} childOptions={childOptions} signedIn={signedIn} onDone={() => { setTab("mine"); router.refresh(); }} />
        )}
        {tab === "mine" && <MyUploadsTab entries={myEntries} signedIn={signedIn} />}
        {tab === "toppers" && <ToppersTab drive={drive} rows={toppers} />}
      </div>
    </AppScreen>
  );
}

/* ────────────────────────────── 1 · Upload ────────────────────────────── */

const STANDARDS = EDUCATION_LEVELS.map((l) => ({ value: l.nameEn, label: l.nameGu }));

/**
 * A member's stored education level is whatever the admin form saved — English
 * on some rows ("Std 10"), Gujarati on others ("ધોરણ 12") — so match on both
 * and always hand the select its English key.
 */
const standardKey = (v: string | null) =>
  EDUCATION_LEVELS.find((l) => l.nameEn === v || l.nameGu === v)?.nameEn ?? "";

function UploadTab({
  drive,
  childOptions,
  signedIn,
  onDone,
}: {
  drive: DriveInfo;
  childOptions: ChildOption[];
  signedIn: boolean;
  onDone: () => void;
}) {
  const { lang } = useLang();
  const T = (g: string, e: string) => (lang === "gu" ? g : e);
  const fileRef = useRef<HTMLInputElement>(null);

  const [memberId, setMemberId] = useState("");
  const [standard, setStandard] = useState("");
  const [total, setTotal] = useState("");
  const [obtained, setObtained] = useState("");
  const [marksheetUrl, setMarksheetUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview of the same formula the API applies on submit.
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

  async function pickFile(file: File) {
    setUploading(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("folder", "results");
    const res = await api.upload<{ url: string }>("/api/upload", body);
    setUploading(false);
    if (!res.ok) return setError(res.error);
    setMarksheetUrl(res.data.url);
  }

  async function submit() {
    const child = childOptions.find((c) => c.id === memberId);
    if (!child) return setError(T("બાળક પસંદ કરો", "Pick a child"));
    if (!standard) return setError(T("ધોરણ પસંદ કરો", "Pick a standard"));
    if (percentage == null) {
      return setError(T("સાચા ટોટલ અને મેળવેલ ગુણ ભરો", "Enter valid total and obtained marks"));
    }
    if (!marksheetUrl) return setError(T("માર્કશીટ અપલોડ કરો", "Upload the marksheet"));

    setBusy(true);
    setError(null);
    const res = await api.post("/api/results", {
      driveId: drive.id,
      memberId: child.id,
      studentName: child.name,
      standard,
      totalMarks: Number(total),
      obtainedMarks: Number(obtained),
      marksheetUrl,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast.success(T("પરિણામ મોકલાયું — ચકાસણી બાકી", "Result submitted — pending verification"));
    setMemberId("");
    setStandard("");
    setTotal("");
    setObtained("");
    setMarksheetUrl("");
    onDone();
  }

  return (
    <div className="samaj-card p-4">
      <div className="mb-3 text-[15px] font-extrabold text-[var(--ink)]">{T("બાળક", "Child")} 1</div>

      <Label>{T("બાળક પસંદ કરો (તમારા પરિવારમાંથી)", "Pick a child (from your family)")}</Label>
      <Select
        value={memberId}
        onChange={(v) => {
          setMemberId(v);
          const key = standardKey(childOptions.find((x) => x.id === v)?.standard ?? null);
          if (key) setStandard(key);
        }}
        placeholder={T("બાળક પસંદ કરો…", "Pick a child…")}
        options={childOptions.map((c) => ({ value: c.id, label: c.name }))}
        emptyText={T("તમારા પરિવારમાં કોઈ સભ્ય નથી", "No members in your family")}
      />

      <Label>{T("ધોરણ", "Standard")}</Label>
      <Select
        value={standard}
        onChange={setStandard}
        placeholder={T("પસંદ કરો", "Select")}
        options={STANDARDS.map((s) => ({
          value: s.value,
          label: lang === "gu" ? s.label : s.value,
        }))}
      />

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

      <div className="mt-3 rounded-[13px] border border-[var(--success-tint)] bg-[var(--success-tint)] px-3 py-2.5 text-center text-[13px] font-bold text-[var(--success)]">
        {percentage == null ? `— ${T("ઓટો ગણતરી", "auto calculated")}` : `${percentage}%`}
      </div>

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
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="mt-3 flex w-full flex-col items-center gap-1.5 rounded-[15px] border-[1.5px] border-dashed border-[var(--brand-line)] bg-[var(--brand-tint)] px-4 py-6 text-center"
      >
        {uploading ? (
          <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
        ) : (
          <ImagePlus className="size-6 text-[var(--brand)]" strokeWidth={1.8} />
        )}
        <span className="text-[13px] font-bold text-[var(--brand)]">
          {marksheetUrl
            ? T("માર્કશીટ અપલોડ થઈ ✓", "Marksheet uploaded ✓")
            : T("માર્કશીટનો ફોટો / PDF", "Marksheet photo / PDF")}
        </span>
        <span className="text-[11.5px] text-[var(--faint)]">
          {T("tap કરીને અપલોડ કરો", "tap to upload")}
        </span>
      </button>

      {error && <p className="mt-3 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="samaj-btn mt-4 flex w-full items-center justify-center gap-2 py-3.5 text-[14.5px] disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : T("પરિણામ મોકલો", "Submit result")}
      </button>
    </div>
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
      return {
        text: `✓ ${T("મંજૂર", "Approved")}`,
        cls: "bg-[var(--success-tint)] text-[var(--success)]",
      };
    }
    if (e.status === "REJECTED" || e.status === "RESUBMIT") {
      return {
        text: `✕ ${T("ફરી મોકલો", "Resubmit")}`,
        cls: "bg-[var(--danger-tint)] text-[var(--danger)]",
      };
    }
    return {
      text: T("ચકાસણી બાકી", "Pending"),
      cls: "bg-[var(--gold-tint)] text-[var(--warn)]",
    };
  };

  const note = (e: MyEntry) => {
    if (e.status === "APPROVED") {
      return e.percentage != null
        ? `${e.percentage}% — ${T("મંજૂર", "approved")}`
        : T("મંજૂર", "Approved");
    }
    if (e.status === "REJECTED" || e.status === "RESUBMIT") {
      return e.rejectReason || T("ફરી અપલોડ કરો", "Please upload again");
    }
    return T("માર્કશીટ મોકલી", "Marksheet submitted");
  };

  return (
    <>
      {entries.map((e) => {
        const p = pill(e);
        return (
          <div key={e.id} className="samaj-card mb-3 flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-bold text-[var(--ink)]">
                {e.studentName} · {e.standard}
              </div>
              <div className="mt-0.5 text-[12px] text-[var(--faint)]">{note(e)}</div>
            </div>
            <span
              className={cn(
                "flex-none rounded-lg px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap",
                p.cls,
              )}
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
    () => [...new Set(rows.map((r) => r.standard))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    ),
    [rows],
  );
  const [std, setStd] = useState<string | null>(null);
  const active = std && standards.includes(std) ? std : standards[0];

  const guStandard = (s: string) =>
    lang === "gu" ? (EDUCATION_LEVELS.find((l) => l.nameEn === s)?.nameGu ?? s) : s;

  const ranked = rows
    .filter((r) => r.standard === active)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const footer = (
    <p className="mt-4 rounded-[13px] border border-[var(--line-soft)] bg-[var(--surface)] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
      {T(
        "ફક્ત eligible (≥80%) વિદ્યાર્થીઓને દેખાય. Admin publish કરે પછી જ યાદી ખુલે.",
        "Only eligible students (≥80%) appear. The list opens after the admin publishes it.",
      )}
    </p>
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
      <div className="mb-3 flex flex-wrap gap-2">
        {standards.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStd(s)}
            className={cn(
              "rounded-full border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold",
              s === active
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[var(--line-soft)] bg-white text-[var(--ink-dim)]",
            )}
          >
            {guStandard(s)}
          </button>
        ))}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {ranked.map((r) => (
          <div key={r.id} className="samaj-card flex items-center gap-2.5 p-3">
            <span
              className="flex size-7 flex-none items-center justify-center rounded-lg text-[12.5px] font-extrabold text-white"
              style={{ background: MEDALS[r.rank - 1] ?? "var(--scroll-thumb)" }}
            >
              {r.rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-bold text-[var(--ink)]">
                {r.studentName}
              </span>
              {r.city && (
                <span className="block truncate text-[11.5px] text-[var(--faint)]">{r.city}</span>
              )}
            </span>
            <span className="flex-none text-[13.5px] font-extrabold text-[var(--brand)]">
              {r.percentage?.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {footer}
    </>
  );
}

/* ───────────────────────────── field bits ───────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 mb-1.5 text-[12px] font-bold text-[var(--ink-mid)]">{children}</div>
  );
}

const FIELD =
  "w-full rounded-[13px] border-[1.5px] border-[var(--line-input)] bg-white px-3.5 py-3 text-[14px] font-semibold text-[var(--ink)] outline-none";

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
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={options.length === 0}
      className={cn(FIELD, "disabled:opacity-60")}
    >
      <option value="">{options.length === 0 ? (emptyText ?? placeholder) : placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
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
