"use client";

import {
  AdminInput,
  AdminLabel,
  FilterChip,
} from "@/components/admin/admin-ui";
import { CascadingOccupationFields } from "@/components/forms/cascading-occupation-fields";
import {
  type CascadingOccupationValues,
  blankCascadingOccupation,
} from "@/lib/cascading-occupation";
import type { OccupationTreeNode } from "@/lib/occupation-defaults";

export type MemberFormValues = {
  fullNameEn: string;
  fullNameGu: string;
  relation: string;
  mobile: string;
  dateOfBirth: string;
  bloodGroup: string;
  hasWhatsApp: boolean;
} & CascadingOccupationValues;

export const blankMemberForm = (isHead = false): MemberFormValues => ({
  fullNameEn: "",
  fullNameGu: "",
  relation: isHead ? "Head" : "",
  mobile: "",
  dateOfBirth: "",
  bloodGroup: "",
  hasWhatsApp: true,
  ...blankCascadingOccupation(),
});

const BLOOD = [
  { value: "A_POS", label: "A+" },
  { value: "A_NEG", label: "A-" },
  { value: "B_POS", label: "B+" },
  { value: "B_NEG", label: "B-" },
  { value: "AB_POS", label: "AB+" },
  { value: "AB_NEG", label: "AB-" },
  { value: "O_POS", label: "O+" },
  { value: "O_NEG", label: "O-" },
];

export function MemberFields({
  values,
  onChange,
  relations,
  occupationTree,
  isHead,
  requireMobile,
}: {
  values: MemberFormValues;
  onChange: (patch: Partial<MemberFormValues>) => void;
  relations: { nameEn: string; nameGu: string }[];
  occupationTree: OccupationTreeNode[];
  isHead?: boolean;
  requireMobile?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <AdminLabel>Name (English) *</AdminLabel>
          <AdminInput
            value={values.fullNameEn}
            onChange={(v) => onChange({ fullNameEn: v })}
          />
        </div>
        <div>
          <AdminLabel>Name (ગુજરાતી)</AdminLabel>
          <AdminInput
            gujarati
            value={values.fullNameGu}
            onChange={(v) => onChange({ fullNameGu: v })}
          />
        </div>
      </div>

      {!isHead && (
        <div>
          <AdminLabel>Relation · સંબંધ *</AdminLabel>
          <div className="flex flex-wrap gap-2">
            {relations
              .filter((r) => r.nameEn.toLowerCase() !== "head")
              .map((r) => (
                <FilterChip
                  key={r.nameEn}
                  label={`${r.nameEn}${r.nameGu ? ` · ${r.nameGu}` : ""}`}
                  active={values.relation === r.nameEn}
                  onClick={() => onChange({ relation: r.nameEn })}
                />
              ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <AdminLabel>
            Mobile{requireMobile || isHead ? " *" : ""} {isHead ? "(login)" : ""}
          </AdminLabel>
          <AdminInput
            value={values.mobile}
            onChange={(v) => onChange({ mobile: v.replace(/\D/g, "").slice(0, 10) })}
            placeholder="10-digit mobile"
          />
        </div>
        <div>
          <AdminLabel>Birth date</AdminLabel>
          <AdminInput
            value={values.dateOfBirth}
            onChange={(v) => onChange({ dateOfBirth: v })}
            placeholder="YYYY-MM-DD"
          />
        </div>
      </div>

      <div>
        <AdminLabel>Blood group</AdminLabel>
        <div className="flex flex-wrap gap-2">
          {BLOOD.map((b) => (
            <FilterChip
              key={b.value}
              label={b.label}
              active={values.bloodGroup === b.value}
              onClick={() => onChange({ bloodGroup: b.value })}
            />
          ))}
        </div>
      </div>

      <CascadingOccupationFields
        tree={occupationTree}
        values={values}
        onChange={onChange}
      />

      <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-[var(--ink-dim)]">
        <input
          type="checkbox"
          checked={values.hasWhatsApp}
          onChange={(e) => onChange({ hasWhatsApp: e.target.checked })}
          className="size-4 accent-[var(--brand)]"
        />
        આ નંબર પર WhatsApp છે
      </label>
    </div>
  );
}
