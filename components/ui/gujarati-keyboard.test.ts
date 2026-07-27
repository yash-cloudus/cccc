/**
 * Gujarati keyboard caret maths.
 * Run: npx tsx components/ui/gujarati-keyboard.test.ts
 */
import assert from "node:assert";
import { insertAt, deleteBackwards } from "./gujarati-keyboard";

// Insert at the caret, not at the end — the bug this guards against.
assert.deepEqual(insertAt("કમ", "લ", 1, 1), { text: "કલમ", caret: 2 });
assert.deepEqual(insertAt("", "ક", 0, 0), { text: "ક", caret: 1 });
assert.deepEqual(insertAt("કમ", "લ", 2, 2), { text: "કમલ", caret: 3 });

// Insert replaces a selection.
assert.deepEqual(insertAt("કખગ", "ઘ", 1, 3), { text: "કઘ", caret: 2 });

// Out-of-range caret (value changed under us) is clamped, never throws.
assert.deepEqual(insertAt("ક", "ખ", 99, 99), { text: "કખ", caret: 2 });
assert.deepEqual(insertAt("ક", "ખ", -5, -5), { text: "ખક", caret: 1 });

// Backspace deletes one char before a collapsed caret…
assert.deepEqual(deleteBackwards("કલમ", 2, 2), { text: "કમ", caret: 1 });
// …the whole selection when there is one…
assert.deepEqual(deleteBackwards("કખગ", 1, 3), { text: "ક", caret: 1 });
// …and nothing at the start of the field.
assert.deepEqual(deleteBackwards("કમ", 0, 0), { text: "કમ", caret: 0 });
assert.deepEqual(deleteBackwards("", 0, 0), { text: "", caret: 0 });

// Multi-codepoint clusters: caret positions are code-unit based, matching the
// DOM's selectionStart, so a matra deletes independently of its base letter.
assert.deepEqual(deleteBackwards("શ્રી", 4, 4), { text: "શ્ર", caret: 3 });

console.log("gujarati-keyboard: all checks passed");
