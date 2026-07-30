"use client";

import { AdminInput, AdminSelect } from "@/components/admin/admin-ui";
import { AdminField, AdminFormRow } from "@/components/admin/admin-form";
import { DateField } from "@/components/ui/date-field";
import { PickerWithAdd } from "@/components/ui/picker-with-add";
import { MemberPlacePicker, type PlaceOption } from "@/components/forms/member-place-picker";
import { WhatsAppField } from "@/components/forms/whatsapp-field";
import { CascadingOccupationFields } from "@/components/forms/cascading-occupation-fields";
import {
  type CascadingOccupationValues,
  blankCascadingOccupation,
} from "@/lib/cascading-occupation";
import { BLOOD_GROUPS, GENDERS, genderFromRelation } from "@/lib/constants";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import type { OccupationTreeNode } from "@/lib/occupation-defaults";

/**
 * One member, with exactly the fields "પરિવાર નોંધણી" collects.
 *
 * The admin review screen used to carry its own cut-down member grid — plain
 * inputs, no Gujarati keyboard, no place, no WhatsApp flag — so an admin could
 * neither see nor fix half of what the family had filled in. This is the same
 * question list in the same order as the member wizard, in admin chrome:
 *
 *   name (En · ગુ) → relation → place → birth date · blood → mobile · WhatsApp
 *   → occupation cascade
 */

export type MemberFormValues = {
  fullNameEn: string;
  fullNameGu: string;
  relation: string;
  /** `Gender` enum value — required in the form, blank only until it's picked. */
  gender: string;
  mobile: string;
  dateOfBirth: string;
  bloodGroup: string;
  /** Where this member lives — the head's answer becomes the family's place. */
  currentlyAt: string;
  hasWhatsApp: boolean;
  /** Only used when `hasWhatsApp` is false — WhatsApp lives on a different number. */
  whatsapp: string;
} & CascadingOccupationValues;

export const blankMemberForm = (isHead = false): MemberFormValues => ({
  fullNameEn: "",
  fullNameGu: "",
  relation: isHead ? "Head" : "",
  gender: "",
  mobile: "",
  dateOfBirth: "",
  bloodGroup: "",
  currentlyAt: "",
  hasWhatsApp: true,
  whatsapp: "",
  ...blankCascadingOccupation(),
});

export function MemberFields({
  values,
  onChange,
  relations,
  occupationTree,
  places,
  onAddPlace,
  communityType = "PARIVAR",
  isHead,
  /** Distinguishes concurrent transliterations when several members are on screen. */
  syncKey = "member",
}: {
  values: MemberFormValues;
  onChange: (patch: Partial<MemberFormValues>) => void;
  relations: { nameEn: string; nameGu: string }[];
  occupationTree: OccupationTreeNode[];
  places: PlaceOption[];
  /** Omit to keep a typed place on this member without adding it to the masters. */
  onAddPlace?: (entry: { nameEn: string; nameGu: string }) => void | Promise<void>;
  communityType?: "PARIVAR" | "GAM";
  isHead?: boolean;
  syncKey?: string;
}) {
  const { fromEn, guInput } = useTranslitSync();

  return (
    <div className="space-y-1">
      <AdminFormRow>
        <AdminField label="Name (English)" required>
          <AdminInput
            speech
            value={values.fullNameEn}
            onChange={(v) => {
              onChange({ fullNameEn: v });
              fromEn(v, (gu) => onChange({ fullNameGu: gu }), syncKey);
            }}
          />
        </AdminField>
        <AdminField label="Name (ગુજરાતી)">
          <AdminInput
            gujarati
            value={values.fullNameGu}
            onChange={(v) => {
              onChange({ fullNameGu: v });
              guInput(v, (gu) => onChange({ fullNameGu: gu }), `${syncKey}:gu`);
            }}
          />
        </AdminField>
      </AdminFormRow>

      <AdminFormRow>
        <AdminField label="Relation · સંબંધ" required={!isHead}>
          {isHead ? (
            <div className="flex min-h-[42px] items-center rounded-[11px] border border-[var(--line-admin)] bg-[var(--surface-admin)] px-3 text-[13px] font-semibold text-[var(--ink-dim)]">
              Head · વડા
            </div>
          ) : relations.length > 0 ? (
            <AdminSelect
              value={values.relation}
              onChange={(v) =>
                // Most relations state the gender; fill it in, but never
                // overwrite an answer already given.
                onChange({
                  relation: v,
                  ...(values.gender ? {} : { gender: genderFromRelation(v) ?? "" }),
                })
              }
              className="w-full"
              options={[
                { value: "", label: "Select relation…" },
                ...relations
                  .filter((r) => r.nameEn.toLowerCase() !== "head")
                  .map((r) => ({
                    value: r.nameEn,
                    label: r.nameGu && r.nameGu !== r.nameEn ? `${r.nameEn} · ${r.nameGu}` : r.nameEn,
                  })),
              ]}
            />
          ) : (
            <AdminInput value={values.relation} onChange={(v) => onChange({ relation: v })} />
          )}
        </AdminField>

        <AdminField label="Gender · જાતિ" required>
          <AdminSelect
            value={values.gender}
            onChange={(v) => onChange({ gender: v })}
            className="w-full"
            options={[
              { value: "", label: "Select gender…" },
              ...GENDERS.map((g) => ({ value: g.value, label: `${g.en} · ${g.gu}` })),
            ]}
          />
        </AdminField>
      </AdminFormRow>

      <AdminField
        label={communityType === "GAM" ? "Village / city · ગામ / શહેર" : "City · શહેર"}
        hint={isHead ? "Also becomes the family's place in the directory." : undefined}
      >
        <MemberPlacePicker
          variant="admin"
          value={values.currentlyAt}
          onChange={(v) => onChange({ currentlyAt: v })}
          options={places}
          onAddNew={onAddPlace}
          t={(_gu, en) => en}
        />
      </AdminField>

      <AdminFormRow>
        <AdminField label="Birth date · જન્મ">
          <DateField
            dob
            variant="admin"
            value={values.dateOfBirth}
            onChange={(v) => onChange({ dateOfBirth: v })}
          />
        </AdminField>
        <AdminField label="Blood group · બ્લડ">
          <PickerWithAdd
            variant="admin"
            placeholder="Select blood group"
            value={values.bloodGroup}
            onChange={(v) => onChange({ bloodGroup: v })}
            options={BLOOD_GROUPS.map((b) => ({ value: b.type, label: b.label }))}
          />
        </AdminField>
      </AdminFormRow>

      <AdminFormRow>
        <AdminField label={isHead ? "Mobile (login) · મોબાઈલ" : "Mobile · મોબાઈલ"} required={isHead}>
          <AdminInput
            type="tel"
            value={values.mobile}
            placeholder="10-digit mobile"
            onChange={(v) => onChange({ mobile: v.replace(/\D/g, "").slice(0, 10) })}
          />
        </AdminField>
        <WhatsAppField
          hasWhatsApp={values.hasWhatsApp}
          whatsapp={values.whatsapp}
          onChange={onChange}
        />
      </AdminFormRow>

      <CascadingOccupationFields tree={occupationTree} values={values} onChange={onChange} />
    </div>
  );
}
