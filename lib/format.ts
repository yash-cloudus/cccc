import type { CSSProperties } from "react";
import type { Lang } from "@/lib/i18n/dictionary";

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

/** Build a WhatsApp deep link from a raw phone number. */
export function waLink(mobile: string | null | undefined): string {
  const d = (mobile || "").replace(/\D/g, "");
  return `https://wa.me/91${d}`;
}

/** Build a tel: link from a raw phone number. */
export function telLink(mobile: string | null | undefined): string {
  const d = (mobile || "").replace(/\D/g, "");
  return `tel:+91${d}`;
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

/** Format a 10-digit mobile for display (e.g. "98765 43210"). */
export function formatMobile(mobile: string | null | undefined): string {
  const d = (mobile || "").replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
  return mobile || "";
}
