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
