"use client";

/**
 * Select backed by Dropdown lists (masters), with an inline "add new" escape
 * hatch.
 *
 * Mirrors the prototype's CustomDropdown (Registration.dc.html): pick a saved
 * option, or add one without leaving the dropdown. Whatever is typed is saved
 * back into `DropdownOption` for this community, so the next person picks it
 * from the list instead of retyping it.
 *
 * The new option is created on save (not on keystroke) by `commitOtherValue`,
 * so abandoning the form never pollutes the masters list.
 */

import { AdminField } from "@/components/admin/admin-form";
import { PickerWithAdd } from "@/components/ui/picker-with-add";
import { api } from "@/lib/http";

/** Sentinel for the "Other" choice — never a real DropdownOption value. */
export const OTHER = "__other__";

export type DropdownChoice = { value: string; label: string };

export function DropdownWithOther({
  label,
  required,
  value,
  otherValue,
  options,
  otherLabel,
  onChange,
  onOtherChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  otherPlaceholder: _otherPlaceholder,
  onOtherGuChange,
  t = (_gu, en) => en,
}: {
  label: string;
  required?: boolean;
  /** Selected option value, or OTHER when a typed-in value is in use. */
  value: string;
  /** Typed-in value, only meaningful while `value === OTHER`. */
  otherValue: string;
  options: DropdownChoice[];
  otherLabel?: string;
  /** Kept for call-site compatibility; the inline add-new supplies its own. */
  otherPlaceholder?: string;
  onChange: (v: string) => void;
  onOtherChange: (v: string) => void;
  /** Gujarati half of a typed-in value, persisted alongside the English one. */
  onOtherGuChange?: (v: string) => void;
  /** Label translator — member screens pass their Gujarati-first `T`. */
  t?: (gu: string, en: string) => string;
}) {
  const typed = otherValue.trim();
  return (
    <AdminField
      label={label}
      required={required}
      hint={
        value === OTHER && typed
          ? t(
              "નવું ઉમેરાશે — યાદીમાં સચવાશે અને ફરી વાપરી શકાશે.",
              "Saved to Dropdown lists, so it can be reused next time.",
            )
          : undefined
      }
    >
      <PickerWithAdd
        value={value}
        onChange={onChange}
        variant="admin"
        syncKey={`dropdown:${label}`}
        placeholder="—"
        addLabel={otherLabel || t("નવું ઉમેરો", "Add new")}
        options={[
          { value: "", label: "—" },
          ...options,
          // A typed-in value shows as its own row, so the trigger reads like
          // any other selection instead of the word "Other".
          ...(typed ? [{ value: OTHER, label: typed }] : []),
        ]}
        onAddNew={({ nameEn, nameGu }) => {
          onOtherChange(nameEn);
          onOtherGuChange?.(nameGu);
          onChange(OTHER);
        }}
        t={t}
      />
    </AdminField>
  );
}

/**
 * Persist a free-text "Other" value into Dropdown lists and return what should
 * be stored on the record.
 *
 * Returns the typed text either way — creating the master option is a
 * convenience, so a failed create (duplicate, offline) must not block saving
 * the family itself.
 */
export async function commitOtherValue(
  type: string,
  value: string,
  otherValue: string,
  known: DropdownChoice[],
  opts?: { parentId?: string | null; nameGu?: string },
): Promise<string> {
  if (value !== OTHER) return value;

  const text = otherValue.trim();
  if (!text) return "";

  const existing = known.find((o) => o.label.toLowerCase() === text.toLowerCase());
  if (existing) return existing.value;

  await api.post("/api/admin/dropdowns", {
    type,
    nameEn: text,
    nameGu: opts?.nameGu?.trim() || text,
    parentId: opts?.parentId ?? null,
  });
  return text;
}
