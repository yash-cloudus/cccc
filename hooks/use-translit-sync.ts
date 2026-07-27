"use client";

import { useCallback, useRef, useState } from "react";

export type TranslitDirection = "en2gu" | "gu2en";

/** A word that is purely Latin, so safe to transliterate into Gujarati. */
const LATIN_WORD = /^[A-Za-z][A-Za-z'’.-]*$/;

/**
 * Split on whitespace but KEEP the separators, so a converted value can be
 * rebuilt with the user's exact spacing.
 */
export function splitKeepingSpaces(raw: string): string[] {
  return raw.split(/(\s+)/);
}

/**
 * Index of the last Latin word that is already *completed* (followed by
 * whitespace). The final element is whatever is still being typed, so it is
 * deliberately excluded — converting it mid-word would fight the typist.
 * Returns -1 when there is nothing to convert.
 */
export function lastCompletedLatinIndex(parts: string[]): number {
  let idx = -1;
  for (let i = 0; i < parts.length - 1; i++) {
    if (LATIN_WORD.test(parts[i])) idx = i;
  }
  return idx;
}

/**
 * Debounced EN ↔ GU sync via /api/i18n/transliterate.
 * Pass a stable `key` when a form has multiple EN/GU pairs so they don't cancel each other.
 */
export function useTranslitSync(debounceMs = 350) {
  const [syncing, setSyncing] = useState<{ direction: TranslitDirection; key: string } | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const tokens = useRef<Map<string, number>>(new Map());

  const sync = useCallback(
    (direction: TranslitDirection, text: string, apply: (result: string) => void, key = "default") => {
      const prev = timers.current.get(key);
      if (prev) clearTimeout(prev);
      const myToken = (tokens.current.get(key) ?? 0) + 1;
      tokens.current.set(key, myToken);

      const timer = setTimeout(async () => {
        const trimmed = text.trim();
        if (!trimmed) {
          if (tokens.current.get(key) !== myToken) return;
          apply("");
          setSyncing((s) => (s?.key === key ? null : s));
          return;
        }

        setSyncing({ direction, key });
        try {
          const res = await fetch("/api/i18n/transliterate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: trimmed, direction }),
          });
          const json = await res.json();
          if (tokens.current.get(key) !== myToken) return;
          if (json.success && typeof json.data?.result === "string") {
            apply(json.data.result);
          }
        } catch {
          /* keep last value; server has local fallback */
        } finally {
          if (tokens.current.get(key) === myToken) {
            setSyncing((s) => (s?.key === key ? null : s));
          }
        }
      }, debounceMs);

      timers.current.set(key, timer);
    },
    [debounceMs],
  );

  /** Type English → fill Gujarati. */
  const fromEn = useCallback(
    (text: string, setGu: (v: string) => void, key?: string) => sync("en2gu", text, setGu, key),
    [sync],
  );

  /**
   * Gujarati phonetic keyboard.
   *
   * Latin typed into a Gujarati field is converted to Gujarati **in place** —
   * "savaliya " becomes "સાવલિયા ". Only a word already followed by a space is
   * converted, so the word being typed stays editable, and Gujarati already in
   * the field is never re-sent.
   *
   * This deliberately does NOT write back to the English field: editing the
   * Gujarati used to overwrite the English through gu2en, which fought the
   * user's own typing.
   */
  const guInput = useCallback(
    (raw: string, setGu: (v: string) => void, key?: string) => {
      const parts = splitKeepingSpaces(raw);
      const idx = lastCompletedLatinIndex(parts);
      if (idx === -1) return;

      sync(
        "en2gu",
        parts[idx],
        (gu) => {
          if (!gu) return;
          const next = [...parts];
          next[idx] = gu;
          setGu(next.join(""));
        },
        key,
      );
    },
    [sync],
  );

  /** Convert any Latin still left in a Gujarati field — call on blur. */
  const guFlush = useCallback(
    (raw: string, setGu: (v: string) => void, key?: string) => {
      const parts = splitKeepingSpaces(raw);
      const pending = parts
        .map((p, i) => (LATIN_WORD.test(p) ? i : -1))
        .filter((i) => i >= 0);
      if (!pending.length) return;

      sync(
        "en2gu",
        pending.map((i) => parts[i]).join(" "),
        (gu) => {
          const words = gu.split(/\s+/).filter(Boolean);
          if (words.length !== pending.length) return;
          const next = [...parts];
          pending.forEach((p, n) => (next[p] = words[n]));
          setGu(next.join(""));
        },
        key,
      );
    },
    [sync],
  );

  return { sync, fromEn, guInput, guFlush, syncing };
}
