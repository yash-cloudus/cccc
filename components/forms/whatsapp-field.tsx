"use client";

import { AdminField } from "@/components/admin/admin-form";
import { AdminInput, AdminToggle } from "@/components/admin/admin-ui";

/**
 * "This number has WhatsApp" — a switch, or, once turned off, a field for a
 * different WhatsApp number with a "same as mobile" way back.
 *
 * Every admin screen that edits a family member had its own half-built copy
 * of this: one only had the switch (turning it off saved nothing, because
 * there was nowhere for the typed number to go — `FamilyMember` had no column
 * for it), another had the full pair but the API silently dropped the number
 * before it ever reached the database. One component, wired end to end, fixes
 * every caller at once.
 */
export function WhatsAppField({
  hasWhatsApp,
  whatsapp,
  onChange,
  className,
}: {
  hasWhatsApp: boolean;
  whatsapp: string;
  onChange: (next: { hasWhatsApp: boolean; whatsapp: string }) => void;
  className?: string;
}) {
  if (hasWhatsApp) {
    return (
      <AdminField label="WhatsApp" className={className}>
        {/* A div, not a button — AdminToggle already renders one, and a button
            can't nest inside another. Its click still bubbles here, so tapping
            the switch or the row both work. */}
        <div
          onClick={() => onChange({ hasWhatsApp: false, whatsapp })}
          className="flex h-[42px] w-full cursor-pointer items-center justify-between gap-2 rounded-[11px] border-[1.5px] border-[var(--line-field)] bg-[var(--field)] px-3"
        >
          <span className="truncate text-left text-[12.5px] font-semibold text-[var(--ink-dim)]">
            આ નંબર પર WhatsApp છે
          </span>
          <AdminToggle
            on
            onChange={() => onChange({ hasWhatsApp: false, whatsapp })}
            label="This number has WhatsApp"
          />
        </div>
      </AdminField>
    );
  }
  return (
    <AdminField label="WhatsApp number · WhatsApp નંબર" className={className}>
      <AdminInput
        type="tel"
        value={whatsapp}
        placeholder="98765 43210"
        onChange={(v) =>
          onChange({ hasWhatsApp: false, whatsapp: v.replace(/\D/g, "").slice(0, 10) })
        }
      />
      <button
        type="button"
        onClick={() => onChange({ hasWhatsApp: true, whatsapp: "" })}
        className="mt-1.5 cursor-pointer text-[11.5px] font-bold text-[var(--brand)]"
      >
        Same as mobile
      </button>
    </AdminField>
  );
}
