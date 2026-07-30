/**
 * Occupation summary shown on the register review step.
 * Run: npx tsx lib/cascading-occupation.test.ts
 */
import assert from "node:assert";
import { OTHER } from "@/components/admin/dropdown-with-other";
import {
  blankCascadingOccupation,
  cascadingOccupationSummary,
} from "@/lib/cascading-occupation";

const base = blankCascadingOccupation();
const summary = (patch: Partial<typeof base>) =>
  cascadingOccupationSummary({ ...base, ...patch });

// Nothing picked yet.
assert.equal(summary({}), "");

// The whole path, not just the deepest level.
assert.equal(
  summary({ occupation: "વિદ્યાર્થી", education: "ધોરણ 12", course: "વિજ્ઞાન" }),
  "વિદ્યાર્થી · ધોરણ 12 · વિજ્ઞાન",
);
assert.equal(
  summary({
    occupation: "વિદ્યાર્થી",
    education: "કોલેજ",
    course: "B.Tech",
    specialization: "IT",
  }),
  "વિદ્યાર્થી · કોલેજ · B.Tech · IT",
);

// A typed-in level shows its text — never the OTHER sentinel. This is the bug:
// the review screen printed a literal "__other__".
const typed = summary({
  occupation: "વેપાર",
  occupationOther: OTHER,
  occupationOtherCustom: "Agro",
  occupationOtherCustomGu: "એગ્રો",
});
assert.equal(typed, "વેપાર · એગ્રો");
assert.ok(!typed.includes(OTHER));

// English only, when nothing was typed in Gujarati.
assert.equal(
  summary({ occupation: "વેપાર", occupationOther: OTHER, occupationOtherCustom: "Agro" }),
  "વેપાર · Agro",
);

// A typed level with no text at all drops out instead of leaving a stray "·".
assert.equal(summary({ occupation: "વેપાર", occupationOther: OTHER }), "વેપાર");
assert.equal(summary({ occupation: OTHER, occupationCustom: "Fisherman" }), "Fisherman");

console.log("ok");
