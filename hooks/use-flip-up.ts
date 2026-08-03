"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True when a popup anchored under `ref` should open upward instead.
 *
 * Fields near the bottom of a long form (occupation, birth date) had their
 * popup run off the window with no way to scroll to it. `needed` is roughly how
 * tall the popup is; pass a bigger number when it grows (an add-new form
 * opening inside it) and it re-measures.
 *
 * By default "available space" is measured against the browser viewport.
 * A picker living inside its own small scrollable popup (a modal, a sheet)
 * needs `containerRef` instead — otherwise this sees the tall viewport below
 * the modal and never flips, so the list opens downward straight over that
 * modal's own buttons instead of over the modal's backdrop.
 */
export function useFlipUp(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  needed: number,
  containerRef?: RefObject<HTMLElement | null>,
) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const container = containerRef?.current?.getBoundingClientRect();
    const below = (container ? container.bottom : window.innerHeight) - r.bottom;
    const above = r.top - (container ? container.top : 0);
    setUp(below < needed && above > below);
  }, [open, ref, needed, containerRef]);
  return up;
}
