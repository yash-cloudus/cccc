"use client";

import { useCallback, useRef, useState } from "react";

export type TranslitDirection = "en2gu" | "gu2en";

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

  /** Type English → fill Gujarati */
  const fromEn = useCallback(
    (text: string, setGu: (v: string) => void, key?: string) => sync("en2gu", text, setGu, key),
    [sync],
  );

  /** Type Gujarati → fill English */
  const fromGu = useCallback(
    (text: string, setEn: (v: string) => void, key?: string) => sync("gu2en", text, setEn, key),
    [sync],
  );

  return { sync, fromEn, fromGu, syncing };
}
