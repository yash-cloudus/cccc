/**
 * Country data integrity and number formatting.
 * Run: npx tsx lib/phone/phone.test.ts
 */
import assert from "node:assert";
import {
  COUNTRIES,
  countryByIso,
  countryByName,
  countryOrDefault,
  digitCountFor,
  e164,
  formatFull,
  formatNational,
  isValidNumber,
  maskFor,
  placeholderFor,
  telHref,
  waHref,
} from "./index";

/* ── the data itself ─────────────────────────────────────────────────────── */

assert.equal(COUNTRIES.length, 193, "expected the 193 UN member states");

// Every country needs all four fields, or the picker shows a blank row and the
// mask silently falls back to "group by 3".
for (const c of COUNTRIES) {
  assert.ok(c.name.trim(), `missing name for ${c.iso}`);
  assert.match(c.iso, /^[a-z]{2}$/, `bad ISO: ${c.iso}`);
  assert.match(c.dial, /^\+\d{1,4}$/, `bad dial for ${c.name}: ${c.dial}`);
  assert.ok(/\d/.test(c.sample), `no sample digits for ${c.name}`);
  assert.ok(digitCountFor(c.iso) >= 4, `implausible digit count for ${c.name}`);
}

// ISO is the stored key, so a duplicate would make two countries indistinguishable.
const isos = COUNTRIES.map((c) => c.iso);
assert.equal(new Set(isos).size, isos.length, "duplicate ISO code");
const names = COUNTRIES.map((c) => c.name);
assert.equal(new Set(names).size, names.length, "duplicate country name");

// The destinations this community actually emigrates to.
for (const [name, iso, dial] of [
  ["India", "in", "+91"],
  ["United States", "us", "+1"],
  ["United Kingdom", "gb", "+44"],
  ["Canada", "ca", "+1"],
  ["Australia", "au", "+61"],
  ["United Arab Emirates", "ae", "+971"],
  ["New Zealand", "nz", "+64"],
  ["South Africa", "za", "+27"],
  ["Kenya", "ke", "+254"],
] as const) {
  const c = countryByIso(iso)!;
  assert.ok(c, `${name} missing`);
  assert.equal(c.name, name);
  assert.equal(c.dial, dial);
}

/* ── formatting ──────────────────────────────────────────────────────────── */

assert.equal(maskFor("in"), "##### #####");
assert.equal(digitCountFor("in"), 10);
assert.equal(formatNational("9876543210", "in"), "98765 43210");
assert.equal(formatNational("98765", "in"), "98765");
// Digits past the format are dropped, so a field cannot exceed its own country.
assert.equal(formatNational("98765432109999", "in"), "98765 43210");
assert.equal(formatNational("", "in"), "");
assert.equal(placeholderFor("in"), "xxxxx xxxxx");

assert.equal(digitCountFor("us"), 10);
assert.equal(formatNational("7058211458", "us"), "705-821-1458");

/* ── validation ──────────────────────────────────────────────────────────── */

assert.equal(isValidNumber("9876543210", "in"), true);
assert.equal(isValidNumber("5876543210", "in"), false, "Indian numbers start 6-9");
assert.equal(isValidNumber("987654321", "in"), false, "too short");
assert.equal(isValidNumber("98765432101", "in"), false, "too long");
// The 6-9 rule is India's alone — a US number starting 5 is fine.
assert.equal(isValidNumber("5058211458", "us"), true);

// Every country's own sample must pass its own validator. This is the check that
// catches a sample whose digit count disagrees with reality.
for (const c of COUNTRIES) {
  assert.equal(
    isValidNumber(c.sample, c.iso),
    true,
    `${c.name}'s own sample (${c.sample}) fails its own format`,
  );
}

/* ── assembly ────────────────────────────────────────────────────────────── */

assert.equal(formatFull("9876543210", "in"), "+91 98765 43210");
assert.equal(formatFull("7058211458", "us"), "+1 705-821-1458");
assert.equal(formatFull("", "in"), "");
assert.equal(e164("9876543210", "in"), "+919876543210");
assert.equal(telHref("9876543210", "in"), "tel:+919876543210");
assert.equal(waHref("9876543210", "in"), "https://wa.me/919876543210");

// A legacy row with no country stored is Indian, not broken.
assert.equal(countryOrDefault(null).iso, "in");
assert.equal(countryOrDefault("").iso, "in");
assert.equal(countryOrDefault("zzz").iso, "in");
assert.equal(formatFull("9876543210", null), "+91 98765 43210");

// The NRI directory stores the country by name, so the lookup back must hold.
assert.equal(countryByName("United States")!.iso, "us");
assert.equal(countryByName("  united states ")!.iso, "us");
assert.equal(countryByName("Nowhere"), null);
for (const c of COUNTRIES) assert.equal(countryByName(c.name)!.iso, c.iso);

console.log(`ok — ${COUNTRIES.length} countries, every sample validates`);
