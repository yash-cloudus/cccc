import { formatFull, telHref, waHref } from "@/lib/phone";
import type { CSSProperties } from "react";
import type { Lang } from "@/lib/i18n/dictionary";
import { DEFAULT_RELATIONS } from "@/lib/constants";

/** Format an ISO date string for display, localized to the active language. */
export function formatDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "gu" ? "gu-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format an ISO date string (or Date) as dd/mm/yyyy. */
export function formatDateDMY(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Parse a stored date value into a local-midnight Date — null when absent or
 * unparseable. Takes plain `yyyy-mm-dd` or a full ISO timestamp from the API,
 * and pins it to local midnight so a date never shifts a day across timezones.
 */
export function parseISODate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(`${v.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when `d` falls outside an ISO min/max range. Either bound may be absent. */
export function outOfDateRange(
  d: Date,
  min?: string | null,
  max?: string | null,
): boolean {
  const lo = parseISODate(min);
  const hi = parseISODate(max);
  return Boolean((lo && d < lo) || (hi && d > hi));
}

/** Format a start/end date pair as dd/mm/yyyy, or a single date when there's no end (or they match). */
export function formatDateRangeDMY(
  startISO: string | Date | null | undefined,
  endISO: string | Date | null | undefined,
): string {
  const start = formatDateDMY(startISO);
  const end = formatDateDMY(endISO);
  if (!start) return end;
  if (!end || end === start) return start;
  return `${start} – ${end}`;
}

const DEFAULT_ACCENT = "#8E2230";

/** Diagonal accent-colour gradient CSS value for a gallery album thumbnail.
 * Falls back to the brand maroon when no accent is set. */
export function accentGradient(accent: string | null | undefined): string {
  const c = accent || DEFAULT_ACCENT;
  return `linear-gradient(150deg, ${c}, color-mix(in srgb, ${c} 55%, white))`;
}

/** Sets the `--accent` custom property an album card's hover shadow reads
 * (see ALBUM_HOVER_SHADOW). Put this on the card's outer element. */
export function accentVarStyle(accent: string | null | undefined): CSSProperties {
  return { ["--accent" as string]: accent || DEFAULT_ACCENT };
}

/** Drop shadow tinted with the album's accent colour, shown on hover (see .album-hover
 * in globals.css — a real CSS rule, since Tailwind's arbitrary-value shadow utility
 * doesn't reliably pick up `color-mix()` + a `var()` set via inline style). Pair with
 * `accentVarStyle`. */
export const ALBUM_HOVER_SHADOW = "album-hover";

/** Same-origin download link for a (possibly cross-origin) file URL — routes
 * through /api/download so the browser's `download` attribute actually
 * triggers a save instead of opening the file in a new tab. */
export function downloadHref(url: string, filename?: string): string {
  const params = new URLSearchParams({ url });
  if (filename) params.set("name", filename);
  return `/api/download?${params.toString()}`;
}

/** Relative-ish short time label (e.g. "2h", "3d") with a date fallback. */
export function formatTimeAgo(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return lang === "gu" ? "હમણાં" : "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return formatDate(iso, lang);
}

/** Pick a bilingual pair, falling back to the other language when one is empty. */
export function pickText(
  gu: string | null | undefined,
  en: string | null | undefined,
  lang: Lang,
): string {
  if (lang === "gu") return (gu || en || "").toString();
  return (en || gu || "").toString();
}

/**
 * WhatsApp deep link. The country comes from the row's own `*Iso` column; a
 * caller that has none falls back to India, which is what every number in the
 * database was before those columns existed.
 */
export function waLink(mobile: string | null | undefined, iso?: string | null): string {
  return waHref(mobile ?? "", iso);
}

/** `tel:` link. Same country rule as `waLink`. */
export function telLink(mobile: string | null | undefined, iso?: string | null): string {
  return telHref(mobile ?? "", iso);
}

/** "+1 705-821-1458" — a number as its own country writes it. */
export function phoneText(mobile: string | null | undefined, iso?: string | null): string {
  return formatFull(mobile ?? "", iso);
}

const BLOOD_LABELS: Record<string, string> = {
  A_POS: "A+",
  A_NEG: "A-",
  B_POS: "B+",
  B_NEG: "B-",
  O_POS: "O+",
  O_NEG: "O-",
  AB_POS: "AB+",
  AB_NEG: "AB-",
};

/** Map a BloodGroupType enum value to a human label (e.g. A_POS → "A+"). */
export function bloodLabel(value: string | null | undefined): string {
  if (!value) return "";
  return BLOOD_LABELS[value] ?? value;
}

export type BloodEnum = "A_POS" | "A_NEG" | "B_POS" | "B_NEG" | "O_POS" | "O_NEG" | "AB_POS" | "AB_NEG";

/** Map a human blood label (e.g. "B+") to its BloodGroupType enum value. */
export function bloodToEnum(label: string | null | undefined): BloodEnum | undefined {
  if (!label) return undefined;
  const entry = Object.entries(BLOOD_LABELS).find(([, v]) => v === label);
  return (entry?.[0] as BloodEnum) ?? undefined;
}

/** Map a stored relation (e.g. "Head") to its bilingual label from DEFAULT_RELATIONS. */
export function relationLabel(relation: string | null | undefined, lang: Lang): string {
  if (!relation) return "";
  const found = DEFAULT_RELATIONS.find((r) => r.nameEn.toLowerCase() === relation.toLowerCase());
  if (!found) return relation;
  return lang === "gu" ? found.nameGu : found.nameEn;
}

/** Title with its year appended — unless the title already states it. Admins
 * routinely type the year into the title ("Results 2026", "વડડોરીયા ૨૦૨૭"), so
 * check Gujarati digits too before deciding to append. */
export function titleWithYear(title: string, year: number): string {
  const ascii = title.replace(/[૦-૯]/g, (d) =>
    String(d.charCodeAt(0) - 0x0ae6),
  );
  return ascii.includes(String(year)) ? title : `${title} ${year}`;
}

/** Format a 10-digit mobile for display (e.g. "98765 43210"). */
export function formatMobile(mobile: string | null | undefined): string {
  const d = (mobile || "").replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
  return mobile || "";
}
