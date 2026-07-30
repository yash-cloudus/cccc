"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True when a popup anchored under `ref` should open upward instead.
 *
 * Fields near the bottom of a long form (occupation, birth date) had their
 * popup run off the window with no way to scroll to it. `needed` is roughly how
 * tall the popup is; pass a bigger number when it grows (an add-new form
 * opening inside it) and it re-measures.
 */
export function useFlipUp(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  needed: number,
) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    setUp(below < needed && r.top > below);
  }, [open, ref, needed]);
  return up;
}
