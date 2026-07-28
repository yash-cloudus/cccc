"use client";

import {
  AdminInput,
  AdminLabel,
  FilterChip,
} from "@/components/admin/admin-ui";
import type { CommunityType } from "@prisma/client";

export type SurnameOption = { id: string; nameEn: string; nameGu: string };
export type PlaceOption = { id: string; nameEn: string; nameGu: string };

export type FamilyDetailsValues = {
  headNameEn: string;
  headNameGu: string;
  surnameGroupId: string;
  surnameEn: string;
  surnameGu: string;
  addressEn: string;
  addressGu: string;
  city: string;
  nativePlace: string;
  email: string;
  villageAreaId: string;
  livesOutsideVillage: boolean;
  nativeElderNameEn: string;
  nativeElderPhone: string;
};

export const blankFamilyDetails = (): FamilyDetailsValues => ({
  headNameEn: "",
  headNameGu: "",
  surnameGroupId: "",
  surnameEn: "",
  surnameGu: "",
  addressEn: "",
  addressGu: "",
  city: "",
  nativePlace: "",
  email: "",
  villageAreaId: "",
  livesOutsideVillage: false,
  nativeElderNameEn: "",
  nativeElderPhone: "",
});

export function FamilyDetailsFields({
  communityType,
  values,
  onChange,
  surnames,
  cities,
  villages,
  lockedSurname,
  compact,
}: {
  communityType: CommunityType;
  values: FamilyDetailsValues;
  onChange: (patch: Partial<FamilyDetailsValues>) => void;
  surnames: SurnameOption[];
  cities: PlaceOption[];
  villages: PlaceOption[];
  lockedSurname?: SurnameOption | null;
  compact?: boolean;
}) {
  const labelCls = compact
    ? undefined
    : undefined;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <AdminLabel>Head name (English) *</AdminLabel>
          <AdminInput
            value={values.headNameEn}
            onChange={(v) => onChange({ headNameEn: v })}
          />
        </div>
        <div>
          <AdminLabel>Head name (ગુજરાતી)</AdminLabel>
          <AdminInput
            gujarati
            value={values.headNameGu}
            onChange={(v) => onChange({ headNameGu: v })}
          />
        </div>
      </div>

      {communityType === "PARIVAR" ? (
        <div className="rounded-xl border border-[var(--line-admin)] bg-[var(--surface-admin)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink-dim)]">
          Surname (locked):{" "}
          <span className="text-[var(--ink)]">
            {lockedSurname
              ? `${lockedSurname.nameEn}${lockedSurname.nameGu ? ` · ${lockedSurname.nameGu}` : ""}`
              : values.surnameEn || "—"}
          </span>
        </div>
      ) : (
        <div>
          <AdminLabel>Surname group *</AdminLabel>
          <div className="mb-2 flex flex-wrap gap-2">
            {surnames.map((s) => (
              <FilterChip
                key={s.id}
                label={`${s.nameEn}${s.nameGu ? ` · ${s.nameGu}` : ""}`}
                active={values.surnameGroupId === s.id}
                onClick={() =>
                  onChange({
                    surnameGroupId: s.id,
                    surnameEn: s.nameEn,
                    surnameGu: s.nameGu,
                  })
                }
              />
            ))}
          </div>
          {!values.surnameGroupId && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <AdminLabel>New surname (English)</AdminLabel>
                <AdminInput
                  value={values.surnameEn}
                  onChange={(v) => onChange({ surnameEn: v, surnameGroupId: "" })}
                />
              </div>
              <div>
                <AdminLabel>New surname (ગુજરાતી)</AdminLabel>
                <AdminInput
                  gujarati
                  value={values.surnameGu}
                  onChange={(v) => onChange({ surnameGu: v })}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {communityType === "PARIVAR" ? (
        <div>
          <AdminLabel>City · શહેર *</AdminLabel>
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <FilterChip
                key={c.id}
                label={`${c.nameEn}${c.nameGu ? ` · ${c.nameGu}` : ""}`}
                active={values.city === c.nameEn}
                onClick={() => onChange({ city: c.nameEn })}
              />
            ))}
          </div>
          {cities.length === 0 && (
            <AdminInput
              value={values.city}
              onChange={(v) => onChange({ city: v })}
              placeholder="City name"
            />
          )}
        </div>
      ) : (
        <div>
          <AdminLabel>Village · ગામ</AdminLabel>
          <div className="mb-2 flex flex-wrap gap-2">
            {villages.map((v) => (
              <FilterChip
                key={v.id}
                label={`${v.nameEn}${v.nameGu ? ` · ${v.nameGu}` : ""}`}
                active={!values.livesOutsideVillage && values.villageAreaId === v.id}
                onClick={() =>
                  onChange({
                    villageAreaId: v.id,
                    livesOutsideVillage: false,
                  })
                }
              />
            ))}
            <FilterChip
              label="Lives outside · બહાર"
              active={values.livesOutsideVillage}
              onClick={() =>
                onChange({ livesOutsideVillage: true, villageAreaId: "" })
              }
            />
          </div>
          {(values.livesOutsideVillage || !values.villageAreaId) && (
            <div>
              <AdminLabel>City · શહેર *</AdminLabel>
              <AdminInput
                value={values.city}
                onChange={(v) => onChange({ city: v })}
                placeholder="Current city"
              />
            </div>
          )}
          {!values.livesOutsideVillage && values.villageAreaId && (
            <div className="mt-2">
              <AdminLabel>City (optional)</AdminLabel>
              <AdminInput
                value={values.city}
                onChange={(v) => onChange({ city: v })}
                placeholder="If also living in a city"
              />
            </div>
          )}
        </div>
      )}

      <div>
        <AdminLabel>Address *</AdminLabel>
        <AdminInput
          value={values.addressEn}
          onChange={(v) => onChange({ addressEn: v })}
          placeholder="House, area…"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <AdminLabel>Native place · મૂળ ગામ</AdminLabel>
          <AdminInput
            value={values.nativePlace}
            onChange={(v) => onChange({ nativePlace: v })}
          />
        </div>
        <div>
          <AdminLabel>Family email</AdminLabel>
          <AdminInput
            value={values.email}
            onChange={(v) => onChange({ email: v })}
            placeholder="optional@"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <AdminLabel>Native elder name</AdminLabel>
          <AdminInput
            value={values.nativeElderNameEn}
            onChange={(v) => onChange({ nativeElderNameEn: v })}
          />
        </div>
        <div>
          <AdminLabel>Native elder phone</AdminLabel>
          <AdminInput
            value={values.nativeElderPhone}
            onChange={(v) =>
              onChange({ nativeElderPhone: v.replace(/\D/g, "").slice(0, 10) })
            }
          />
        </div>
      </div>
      {/* silence unused */}
      <span className="hidden">{labelCls}</span>
    </div>
  );
}
