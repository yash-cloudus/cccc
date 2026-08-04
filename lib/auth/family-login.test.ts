/**
 * DDMMYY derivation and login-member choice.
 * Run: npx tsx lib/auth/family-login.test.ts
 */
import assert from "node:assert";
import { dobPassword, pickLoginMember } from "./family-login";

// The example from the spec: 13/11/2004 → 131104.
assert.equal(dobPassword(new Date("2004-11-13")), "131104");

// Single-digit day and month are zero-padded, so the password is always 6 long.
assert.equal(dobPassword(new Date("2004-01-05")), "050104");
assert.equal(dobPassword(new Date("1999-12-31")), "311299");
// Year 2000 keeps its leading zero rather than collapsing to "0".
assert.equal(dobPassword(new Date("2000-03-08")), "080300");

// UTC, not local: a stored date is UTC midnight, so a server behind Greenwich
// must still derive the day the member actually typed.
assert.equal(dobPassword(new Date("2004-11-13T00:00:00.000Z")), "131104");

assert.equal(dobPassword(null), null);
assert.equal(dobPassword(undefined), null);
assert.equal(dobPassword(new Date("nonsense")), null);

// Every derived password fits the 6-digit login schema.
for (const iso of ["2004-11-13", "2004-01-05", "1999-12-31", "2000-03-08"]) {
  assert.match(dobPassword(new Date(iso))!, /^\d{6}$/);
}

const head = { isHead: true, mobile: "9876543210", dateOfBirth: null };
const son = { isHead: false, mobile: "9812345678", dateOfBirth: null };
const headNoPhone = { isHead: true, mobile: null, dateOfBirth: null };

// The head holds the login whenever they gave a number...
assert.equal(pickLoginMember([head, son]), head);
assert.equal(pickLoginMember([son, head]), head);
// ...otherwise the first member who did.
assert.equal(pickLoginMember([headNoPhone, son]), son);
// A blank string is not a number.
assert.equal(pickLoginMember([{ isHead: true, mobile: "  ", dateOfBirth: null }]), null);
assert.equal(pickLoginMember([]), null);

console.log("ok");
