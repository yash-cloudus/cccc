"use client";

/**
 * Select backed by Dropdown lists (masters), with an inline "add new" escape
 * hatch.
 *
 * Mirrors the prototype's CustomDropdown (Registration.dc.html): pick a saved
 * option, or add one without leaving the dropdown. Whatever is typed is sent to
 * `DropdownOption` for this community, where it waits for an admin to approve
 * it before the next person can pick it from the list.
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
  otherValueGu,
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
  /** Gujarati half of the typed-in value, so its row reads `En · Gu` like a saved option. */
  otherValueGu?: string;
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
  const typedGu = otherValueGu?.trim();
  const typedLabel = typedGu && typedGu !== typed ? `${typed} · ${typedGu}` : typed;
  return (
    <AdminField
      label={label}
      required={required}
      hint={
        value === OTHER && typed
          ? t(
              "તમારી વિગતમાં સચવાશે. એડમિન મંજૂરી આપે પછી બધાની યાદીમાં દેખાશે.",
              "Saved on this record. It joins the shared list once an admin approves it.",
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
          ...(typed ? [{ value: OTHER, label: typedLabel }] : []),
        ]}
        onAddNew={({ nameEn, nameGu }) => {
          // Select first, then fill in the text. Call sites clear the typed
          // value inside `onChange` (picking a real option must drop it), so
          // setting the text before the selection erased it and the field fell
          // back to "—" with the new name nowhere in sight.
          onChange(OTHER);
          onOtherChange(nameEn);
          onOtherGuChange?.(nameGu);
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

  // /api/dropdowns, not the admin route: registration and profile run this too
  // and are not admin, so the admin route rejected them and the option was
  // never created. That route flags member-added options for admin review.
  await api.post("/api/dropdowns", {
    type,
    nameEn: text,
    nameGu: opts?.nameGu?.trim() || text,
    parentId: opts?.parentId ?? null,
  });
  return text;
}
