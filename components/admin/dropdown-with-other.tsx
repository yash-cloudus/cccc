"use client";

/**
 * Select backed by Dropdown lists (masters), with an "Other" escape hatch.
 *
 * Mirrors the prototype's CustomDropdown (Registration.dc.html): pick a saved
 * option, or choose "Other" (અન્ય) to reveal a free-text field. Whatever is
 * typed there is saved back into `DropdownOption` for this community, so the
 * next person picks it from the list instead of retyping it.
 *
 * The new option is created on save (not on keystroke) by `commitOtherValue`,
 * so abandoning the form never pollutes the masters list.
 */

import { AdminSelect } from "@/components/admin/admin-ui";
import { AdminField } from "@/components/admin/admin-form";
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
  otherPlaceholder,
  otherLabel = "Other · અન્ય",
  onChange,
  onOtherChange,
}: {
  label: string;
  required?: boolean;
  /** Selected option value, or OTHER when the free-text field is in use. */
  value: string;
  /** Free-text value, only meaningful while `value === OTHER`. */
  otherValue: string;
  options: DropdownChoice[];
  otherPlaceholder?: string;
  otherLabel?: string;
  onChange: (v: string) => void;
  onOtherChange: (v: string) => void;
}) {
  return (
    <>
      <AdminField label={label} required={required}>
        <AdminSelect
          value={value}
          onChange={onChange}
          className="w-full"
          options={[{ value: "", label: "—" }, ...options, { value: OTHER, label: otherLabel }]}
        />
      </AdminField>

      {value === OTHER && (
        <AdminField
          label={`${label} — type it`}
          required={required}
          hint="Saved to Dropdown lists, so it can be reused next time."
        >
          <input
            value={otherValue}
            onChange={(e) => onOtherChange(e.target.value)}
            placeholder={otherPlaceholder}
            className="h-[42px] w-full rounded-[11px] border-[1.5px] border-[var(--line-field)] bg-[var(--field)] px-3 text-[13.5px] text-[var(--ink)] outline-none"
          />
        </AdminField>
      )}
    </>
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
): Promise<string> {
  if (value !== OTHER) return value;

  const text = otherValue.trim();
  if (!text) return "";

  // Already in the masters (someone added it meanwhile, or case differs) —
  // reuse it rather than creating a duplicate row.
  const existing = known.find((o) => o.label.toLowerCase() === text.toLowerCase());
  if (existing) return existing.value;

  await api.post("/api/admin/dropdowns", { type, nameEn: text, nameGu: text });
  return text;
}
