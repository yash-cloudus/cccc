/**
 * Gujarati phonetic input — word-boundary rules.
 * Run: npx tsx hooks/use-translit-sync.test.ts
 */
import assert from "node:assert";
import { splitKeepingSpaces, lastCompletedLatinIndex } from "./use-translit-sync";

const at = (raw: string) => lastCompletedLatinIndex(splitKeepingSpaces(raw));
const word = (raw: string) => {
  const i = at(raw);
  return i === -1 ? null : splitKeepingSpaces(raw)[i];
};

// The word being typed is never touched — only whatever a space completed.
assert.equal(word("savaliya"), null, "first word still in progress");
assert.equal(word("shri sav"), "shri", "converts 'shri'; 'sav' is still being typed");

// Space completes a word → that word converts.
assert.equal(word("savaliya "), "savaliya");
assert.equal(word("shri savaliya "), "savaliya", "converts the newest word");

// Gujarati already in the field is never re-sent.
assert.equal(word("શ્રી "), null);
assert.equal(word("શ્રી savaliya "), "savaliya");
assert.equal(word("શ્રી સાવલિયા "), null, "fully converted → nothing to do");

// Empty / whitespace-only input.
assert.equal(word(""), null);
assert.equal(word("   "), null);

// Spacing is preserved exactly when rebuilt.
const parts = splitKeepingSpaces("શ્રી  savaliya  ");
const i = lastCompletedLatinIndex(parts);
parts[i] = "સાવલિયા";
assert.equal(parts.join(""), "શ્રી  સાવલિયા  ", "double spaces survive");

console.log("use-translit-sync: all checks passed");
