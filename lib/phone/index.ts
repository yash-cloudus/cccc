/**
 * Phone numbers as (country, national number), never as one string.
 *
 * A number is stored in two columns — the ISO country code and the digits — so a
 * UK number is not silently read as an Indian one, and so the country survives a
 * reformat. Reassembling for display or a `tel:` link happens here, once.
 *
 * Everything below is pure and dependency-free so both server routes and client
 * forms can share exactly one definition of "is this number valid".
 */
import { COUNTRIES, DEFAULT_DIAL, DEFAULT_ISO, type Country } from "./countries";

export { COUNTRIES, DEFAULT_DIAL, DEFAULT_ISO };
export type { Country };

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));

export function countryByIso(iso: string | null | undefined): Country | null {
  return BY_ISO.get((iso || "").toLowerCase()) ?? null;
}

/** Falls back to India rather than returning null — every legacy row is Indian. */
export function countryOrDefault(iso: string | null | undefined): Country {
  return countryByIso(iso) ?? BY_ISO.get(DEFAULT_ISO)!;
}

/**
 * Dial code -> country is deliberately absent as a public helper: +1 alone maps
 * to the US, Canada and much of the Caribbean, so it cannot answer the question.
 * Store the ISO.
 */

/** Digits only — what goes in the database. */
export function digitsOf(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

/** "70 123 4567" -> "## ### ####" */
export function maskFor(iso: string): string | null {
  const c = countryByIso(iso);
  return c ? c.sample.replace(/\d/g, "#") : null;
}

/** "70 123 4567" -> "xx xxx xxxx", for the input placeholder. */
export function placeholderFor(iso: string): string {
  const c = countryByIso(iso);
  return c ? c.sample.replace(/\d/g, "x") : "";
}

/** How many digits this country's numbers have. */
export function digitCountFor(iso: string): number {
  const mask = maskFor(iso);
  return mask ? (mask.match(/#/g) || []).length : 0;
}

/**
 * Group raw digits the way the country writes them, dropping anything past the
 * mask so a field can never hold more digits than the format allows.
 */
export function formatNational(digits: string, iso: string): string {
  const d = digitsOf(digits);
  if (!d) return "";
  const mask = maskFor(iso);
  if (!mask) return d.replace(/(\d{3})(?=\d)/g, "$1 ");

  const capped = d.slice(0, (mask.match(/#/g) || []).length);
  let out = "";
  let i = 0;
  for (const ch of mask) {
    if (i >= capped.length) break;
    out += ch === "#" ? capped[i++] : ch;
  }
  return out;
}

/**
 * Valid when the digit count matches the country's own format.
 *
 * Indian numbers additionally have to start 6-9, which is the rule the app has
 * always enforced and the one thing a bare length check would let through.
 */
export function isValidNumber(digits: string, iso: string): boolean {
  const d = digitsOf(digits);
  const expected = digitCountFor(iso);
  if (!expected || d.length !== expected) return false;
  if (iso === "in") return /^[6-9]/.test(d);
  return true;
}

/** The message to show under the field when it fails. */
export function numberError(
  digits: string,
  iso: string,
  t: (gu: string, en: string) => string,
): string | null {
  const d = digitsOf(digits);
  const c = countryOrDefault(iso);
  const expected = digitCountFor(c.iso);
  if (!d) return t("મોબાઈલ નંબર જરૂરી છે", "Mobile number is required");
  if (expected && d.length !== expected) {
    return t(
      `${c.name} નો નંબર ${expected} અંકનો હોવો જોઈએ`,
      `A ${c.name} number must be ${expected} digits`,
    );
  }
  if (c.iso === "in" && !/^[6-9]/.test(d)) {
    return t("ભારતીય નંબર 6-9 થી શરૂ થવો જોઈએ", "An Indian number must start with 6–9");
  }
  return null;
}

/** "+91 98765 43210" — for display. */
export function formatFull(digits: string, iso: string | null | undefined): string {
  const c = countryOrDefault(iso);
  const national = formatNational(digits, c.iso);
  return national ? `${c.dial} ${national}` : "";
}

/** "+919876543210" — for tel: and wa.me, which want no separators. */
export function e164(digits: string, iso: string | null | undefined): string {
  const c = countryOrDefault(iso);
  const d = digitsOf(digits);
  return d ? `${c.dial}${d}` : "";
}

export function telHref(digits: string, iso: string | null | undefined): string {
  return `tel:${e164(digits, iso)}`;
}

/** wa.me wants the number without the leading +. */
export function waHref(digits: string, iso: string | null | undefined): string {
  return `https://wa.me/${e164(digits, iso).replace("+", "")}`;
}

/** Flag image for an ISO code. Same CDN the reference picker used; the app's CSP
 *  already allows `img-src https:`. */
export function flagUrl(iso: string, width: 20 | 40 | 80 = 40): string {
  return `https://flagcdn.com/w${width}/${(iso || DEFAULT_ISO).toLowerCase()}.png`;
}

/** Name match for the NRI country list, which stores the country by name. */
export function countryByName(name: string | null | undefined): Country | null {
  const n = (name || "").trim().toLowerCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === n) ?? null;
}
