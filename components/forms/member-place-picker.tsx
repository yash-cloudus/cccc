"use client";

import { PickerWithAdd, type NewEntry } from "@/components/ui/picker-with-add";

export type PlaceOption = { id: string; nameEn: string; nameGu: string | null };

export function placeLabel(nameEn?: string | null, nameGu?: string | null) {
  const en = (nameEn || "").trim();
  const gu = (nameGu || "").trim();
  if (en && gu && en !== gu) return `${en} · ${gu}`;
  return en || gu || "—";
}

/** Label to show for a stored place value (matched against the known list). */
export function labelForPlace(value: string, options: PlaceOption[], fallback: string) {
  if (!value) return fallback;
  const hit = options.find((o) => o.nameEn === value || o.nameGu === value);
  return hit ? placeLabel(hit.nameEn, hit.nameGu) : value;
}

/**
 * Where one member currently lives.
 *
 * Location moved from the family to the member: households are split across
 * villages and cities, so a single family-level place was wrong for everyone
 * but the head. The head's pick still becomes the family's `city` /
 * `villageAreaId` on save, which keeps the directory, queue filters and family
 * table working unchanged.
 *
 * `onAddNew` is optional — where it is omitted (public registration) a typed
 * place is still accepted for this member, it just does not create a master
 * option that everyone else would then see.
 */
export function MemberPlacePicker({
  value,
  onChange,
  options,
  onAddNew,
  variant = "member",
  t,
}: {
  /** Stored value — the English name of the place. */
  value: string;
  onChange: (nameEn: string) => void;
  options: PlaceOption[];
  /** Persist a brand-new place to the masters, then select it. */
  onAddNew?: (entry: NewEntry) => void | Promise<void>;
  variant?: "member" | "admin";
  t: (gu: string, en: string) => string;
}) {
  // The stored value is the English name, so an unknown value (a place added
  // on a previous visit, or one typed here) still renders as itself.
  const known = options.some((o) => o.nameEn === value);
  const choices = [
    ...options.map((o) => ({ value: o.nameEn, label: placeLabel(o.nameEn, o.nameGu) })),
    ...(value && !known ? [{ value, label: value }] : []),
  ];

  return (
    <PickerWithAdd
      value={value}
      onChange={onChange}
      options={choices}
      variant={variant}
      syncKey="place"
      placeholder={t("પસંદ કરો", "Select")}
      addLabel={t("નવું સ્થળ ઉમેરો", "Add new place")}
      onAddNew={
        onAddNew &&
        (async (entry) => {
          onChange(entry.nameEn);
          await onAddNew(entry);
        })
      }
      t={t}
    />
  );
}
