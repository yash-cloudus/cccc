/**
 * Date parsing and range maths behind DateField.
 * Run: npx tsx lib/format.test.ts
 */
import assert from "node:assert";
import { formatDateDMY, outOfDateRange, parseISODate } from "./format";

// Local midnight, never the previous day: the whole point of not using
// `new Date("1989-02-12")`, which is UTC and shifts west of Greenwich.
const d = parseISODate("1989-02-12")!;
assert.equal(d.getFullYear(), 1989);
assert.equal(d.getMonth(), 1);
assert.equal(d.getDate(), 12);
assert.equal(formatDateDMY(d), "12/02/1989");

// A full timestamp from the API is accepted, and junk never throws.
assert.equal(parseISODate("1989-02-12T09:30:00.000Z")!.getDate(), 12);
assert.equal(parseISODate(""), null);
assert.equal(parseISODate(null), null);
assert.equal(parseISODate("not a date"), null);
assert.equal(parseISODate("1989-13-45"), null);

// No bounds — everything is pickable.
assert.equal(outOfDateRange(d), false);

// Birth dates: today is allowed, tomorrow is not. This is the `dob` guard.
const today = new Date();
const iso = (x: Date) => x.toISOString().slice(0, 10);
const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
assert.equal(outOfDateRange(parseISODate(iso(today))!, undefined, iso(today)), false);
assert.equal(outOfDateRange(tomorrow, undefined, iso(today)), true);

// Both ends of a range are inclusive, outside either end is blocked.
assert.equal(outOfDateRange(d, "1989-02-12", "1989-02-12"), false);
assert.equal(outOfDateRange(d, "1989-02-13"), true);
assert.equal(outOfDateRange(d, undefined, "1989-02-11"), true);
assert.equal(outOfDateRange(d, "1989-01-01", "1989-12-31"), false);

console.log("ok");
