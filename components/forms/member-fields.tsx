"use client";

import { AdminInput, AdminSelect } from "@/components/admin/admin-ui";
import { AdminField, AdminFilePicker, AdminFormRow } from "@/components/admin/admin-form";
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
import { PhoneField } from "@/components/ui/phone-field";
import { NriFields, type NriCityOption } from "@/components/forms/nri-fields";
import { DEFAULT_ISO } from "@/lib/phone";
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
  /** Country of `mobile`. */
  mobileIso: string;
  dateOfBirth: string;
  bloodGroup: string;
  /** Where this member lives — the head's answer becomes the family's place. */
  currentlyAt: string;
  hasWhatsApp: boolean;
  /** Only used when `hasWhatsApp` is false — WhatsApp lives on a different number. */
  whatsapp: string;
  whatsappIso: string;
  /** Head only: the photo the family uploaded at registration. */
  photoUrl: string;
  /** Living abroad — replaces the village/city answer with country + city. */
  isNri: boolean;
  nriCountry: string;
  nriCity: string;
} & CascadingOccupationValues;

export const blankMemberForm = (isHead = false): MemberFormValues => ({
  fullNameEn: "",
  fullNameGu: "",
  relation: isHead ? "Head" : "",
  gender: "",
  mobile: "",
  mobileIso: DEFAULT_ISO,
  dateOfBirth: "",
  bloodGroup: "",
  currentlyAt: "",
  hasWhatsApp: true,
  whatsapp: "",
  whatsappIso: DEFAULT_ISO,
  photoUrl: "",
  isNri: false,
  nriCountry: "",
  nriCity: "",
  ...blankCascadingOccupation(),
});

export function MemberFields({
  values,
  onChange,
  relations,
  occupationTree,
  places,
  nriCities = [],
  onAddPlace,
  communityType = "PARIVAR",
  isHead,
  errors,
  /** Distinguishes concurrent transliterations when several members are on screen. */
  syncKey = "member",
}: {
  values: MemberFormValues;
  onChange: (patch: Partial<MemberFormValues>) => void;
  relations: { nameEn: string; nameGu: string }[];
  occupationTree: OccupationTreeNode[];
  places: PlaceOption[];
  /** Admin-managed NRI cities, grouped by country name. */
  nriCities?: NriCityOption[];
  /** Omit to keep a typed place on this member without adding it to the masters. */
  onAddPlace?: (entry: { nameEn: string; nameGu: string }) => void | Promise<void>;
  communityType?: "PARIVAR" | "GAM";
  isHead?: boolean;
  /** `field -> message`, shown under the field rather than as a toast. */
  errors?: Record<string, string>;
  syncKey?: string;
}) {
  const { fromEn, guInput } = useTranslitSync();
  const err = (k: string) => errors?.[k];

  /**
   * Women are not asked for a phone number. The head is the exception: their
   * number is the household's login, so it is asked for whatever their gender.
   */
  const wantsMobile = isHead || values.gender !== "FEMALE";

  /** Dropping the number when a member becomes female keeps a hidden field from
   *  submitting one. Only fires on an explicit change, so a record loaded from
   *  the database keeps whatever it already had. */
  const setGender = (gender: string) =>
    onChange({
      gender,
      ...(!isHead && gender === "FEMALE" ? { mobile: "", whatsapp: "", hasWhatsApp: true } : {}),
    });

  return (
    <div className="space-y-1">
      {/* Only the head has one — registration asks nobody else for a photo. */}
      {isHead && (
        <AdminField label="Photo · ફોટો">
          <AdminFilePicker
            value={values.photoUrl}
            onChange={(url) => onChange({ photoUrl: url })}
            folder="family-heads"
            hint="Square photo of the family head"
          />
        </AdminField>
      )}
      <AdminFormRow>
        <AdminField label="Name (English) *" required error={err("fullNameEn")}>
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
        <AdminField label="Relation · સંબંધ" required={!isHead} error={err("relation")}>
          {isHead ? (
            <div className="flex min-h-[42px] items-center rounded-[11px] border border-[var(--line-admin)] bg-[var(--surface-admin)] px-3 text-[13px] font-semibold text-[var(--ink-dim)]">
              Head · વડા
            </div>
          ) : relations.length > 0 ? (
            <AdminSelect
              value={values.relation}
              onChange={(v) => {
                // Most relations state the gender; fill it in, but never
                // overwrite an answer already given. "Daughter" implies FEMALE
                // without the gender box being touched, so route it through
                // setGender so the number is dropped too.
                onChange({ relation: v });
                const implied = values.gender || genderFromRelation(v) || "";
                if (implied !== values.gender) setGender(implied);
              }}
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

        <AdminField label="Gender · જાતિ" required error={err("gender")}>
          <AdminSelect
            value={values.gender}
            onChange={setGender}
            className="w-full"
            options={[
              { value: "", label: "Select gender…" },
              ...GENDERS.map((g) => ({ value: g.value, label: `${g.en} · ${g.gu}` })),
            ]}
          />
        </AdminField>
      </AdminFormRow>

      {/* Above the place question, and replaces it when ticked — a member in
          Toronto has no Indian village to record as their current place. */}
      <NriFields
        variant="admin"
        value={{ isNri: values.isNri, nriCountry: values.nriCountry, nriCity: values.nriCity }}
        onChange={(patch) => {
          onChange(patch);
          // Every directory screen reads `currentlyAt`, so it follows the NRI
          // city rather than becoming a second, stale answer.
          if (patch.nriCity !== undefined) onChange({ currentlyAt: patch.nriCity });
        }}
        cities={nriCities}
        error={{ country: err("nriCountry"), city: err("nriCity") }}
        t={(_gu, en) => en}
      />

      {!values.isNri && (
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
      )}

      <AdminFormRow>
        {/* Not marked required here: this component also edits records saved
            before the rule existed, and blocking a name fix on a missing birth
            date would be worse than the gap. New entries are gated by the
            forms that create them. */}
        <AdminField label="Birth date · જન્મ" error={err("dateOfBirth")}>
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

      {wantsMobile && (
        <AdminFormRow>
          <AdminField
            label={isHead ? "Mobile (login) · મોબાઈલ" : "Mobile · મોબાઈલ"}
            required={isHead}
            error={err("mobile")}
          >
            <PhoneField
              variant="admin"
              value={{ iso: values.mobileIso || DEFAULT_ISO, digits: values.mobile }}
              onChange={(v) =>
                onChange({
                  mobile: v.digits,
                  mobileIso: v.iso,
                  // The WhatsApp number follows until it is given its own country.
                  ...(values.hasWhatsApp ? { whatsappIso: v.iso } : {}),
                })
              }
              t={(_gu, en) => en}
            />
          </AdminField>
          <WhatsAppField
            hasWhatsApp={values.hasWhatsApp}
            whatsapp={values.whatsapp}
            whatsappIso={values.whatsappIso}
            onChange={onChange}
          />
        </AdminFormRow>
      )}

      <CascadingOccupationFields tree={occupationTree} values={values} onChange={onChange} />
    </div>
  );
}
