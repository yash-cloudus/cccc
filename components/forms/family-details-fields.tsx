"use client";

import { useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { GujaratiInput } from "@/components/ui/gujarati-keyboard";
import { AdminInput, AdminSelect } from "@/components/admin/admin-ui";
import { AdminField, AdminFormRow } from "@/components/admin/admin-form";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import type { FamilyDetailsValues } from "@/lib/family-form";
import { cn } from "@/lib/utils";

export type NamedOption = { id: string; nameEn: string; nameGu: string | null };

export function bilingualLabel(nameEn?: string | null, nameGu?: string | null) {
  const en = (nameEn || "").trim();
  const gu = (nameGu || "").trim();
  if (en && gu && en !== gu) return `${en} · ${gu}`;
  return en || gu || "—";
}

/**
 * The family-details block of "પરિવાર નોંધણી".
 *
 * One component for both panels: the member registration wizard and the admin
 * "Add family directly" modal collect the very same family, so the field list,
 * order, transliteration and geo capture live here once. Only the input chrome
 * differs — `variant="member"` renders the app's samaj fields, `variant="admin"`
 * the desktop AdminField/AdminInput set.
 */
export function FamilyDetailsFields({
  variant,
  values,
  onChange,
  communityType,
  lockedSurname = null,
  surnameGroups,
  cities,
  villages,
  /** Admin-only: a surname matching no group creates a new one on save. */
  allowNewSurname = false,
  t,
}: {
  variant: "member" | "admin";
  values: FamilyDetailsValues;
  onChange: (patch: Partial<FamilyDetailsValues>) => void;
  communityType: "PARIVAR" | "GAM";
  lockedSurname?: NamedOption | null;
  surnameGroups: NamedOption[];
  cities: NamedOption[];
  villages: NamedOption[];
  allowNewSurname?: boolean;
  /** Label translator — the member side passes its Gujarati-first `T`. */
  t: (gu: string, en: string) => string;
}) {
  const { fromEn, guInput } = useTranslitSync();
  const isAdmin = variant === "admin";

  const selectedGroup =
    lockedSurname ?? surnameGroups.find((g) => g.id === values.surnameGroupId) ?? null;

  const matchedGroup =
    allowNewSurname && values.surnameEn.trim()
      ? (surnameGroups.find(
          (g) => g.nameEn.trim().toLowerCase() === values.surnameEn.trim().toLowerCase(),
        ) ?? null)
      : null;
  const willCreateGroup =
    allowNewSurname && !values.surnameGroupId && !matchedGroup && Boolean(values.surnameEn.trim());

  /** English → Gujarati as you type, for every bilingual pair on this form. */
  const bindEn =
    (enKey: keyof FamilyDetailsValues, guKey: keyof FamilyDetailsValues, tag: string) =>
    (v: string) => {
      onChange({ [enKey]: v } as Partial<FamilyDetailsValues>);
      fromEn(v, (gu) => onChange({ [guKey]: gu } as Partial<FamilyDetailsValues>), tag);
    };
  const bindGu = (guKey: keyof FamilyDetailsValues, tag: string) => (v: string) => {
    onChange({ [guKey]: v } as Partial<FamilyDetailsValues>);
    guInput(v, (gu) => onChange({ [guKey]: gu } as Partial<FamilyDetailsValues>), tag);
  };

  function captureLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => onChange({ latitude: null, longitude: null }),
    );
  }

  const hasLocation = values.latitude != null && values.longitude != null;

  /* ─────────────────────────── surname ─────────────────────────── */

  const surnameBlock =
    communityType === "PARIVAR" ? (
      <Wrap variant={variant} label={t("અટક", "Surname")}>
        <div
          className={cn(
            "flex min-h-[44px] items-center rounded-[13px] border px-3.5 text-sm font-bold",
            isAdmin
              ? "border-[var(--line-admin)] bg-[var(--surface-admin)] text-[var(--ink-dim)]"
              : "border-[var(--line-input)] bg-[#F7F3EC] text-[var(--ink)]",
          )}
        >
          {selectedGroup ? bilingualLabel(selectedGroup.nameEn, selectedGroup.nameGu) : "—"}
        </div>
      </Wrap>
    ) : isAdmin ? (
      <>
        <AdminField label="Surname group">
          <AdminSelect
            value={values.surnameGroupId || matchedGroup?.id || ""}
            onChange={(id) => {
              const g = surnameGroups.find((x) => x.id === id);
              onChange({
                surnameGroupId: id,
                ...(g ? { surnameEn: g.nameEn, surnameGu: g.nameGu ?? "" } : {}),
              });
            }}
            className="w-full"
            options={[
              {
                value: "",
                label: allowNewSurname
                  ? surnameGroups.length === 0
                    ? "Will create from surname below…"
                    : "Select group — or type new surname below"
                  : "Select group",
              },
              ...surnameGroups.map((s) => ({
                value: s.id,
                label: bilingualLabel(s.nameEn, s.nameGu),
              })),
            ]}
          />
        </AdminField>

        {willCreateGroup && (
          <p className="mb-2 text-[11.5px] font-semibold text-[var(--leaf)]">
            New surname group will be created: {values.surnameEn.trim()}
            {values.surnameGu.trim() ? ` · ${values.surnameGu.trim()}` : ""}
          </p>
        )}
        {matchedGroup && (
          <p className="mb-2 text-[11.5px] text-[var(--ink-dim)]">
            Matched existing group: {bilingualLabel(matchedGroup.nameEn, matchedGroup.nameGu)}
          </p>
        )}

        <AdminFormRow>
          <AdminField label="Surname (English)" required>
            <AdminInput
              value={values.surnameEn}
              onChange={bindEn("surnameEn", "surnameGu", "surname")}
            />
          </AdminField>
          <AdminField label="Surname (ગુજરાતી)">
            <AdminInput
              gujarati
              value={values.surnameGu}
              onChange={bindGu("surnameGu", "surname:gu")}
            />
          </AdminField>
        </AdminFormRow>
      </>
    ) : (
      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <Wrap variant={variant} label={`${t("અટક જૂથ", "Surname group")} *`}>
          <PopoverPicker
            label={
              selectedGroup
                ? bilingualLabel(selectedGroup.nameEn, selectedGroup.nameGu)
                : t("પસંદ કરો", "Select")
            }
            options={surnameGroups.map((g) => ({
              key: g.id,
              label: bilingualLabel(g.nameEn, g.nameGu),
              active: values.surnameGroupId === g.id,
              onPick: () =>
                onChange({
                  surnameGroupId: g.id,
                  surnameEn: g.nameEn,
                  surnameGu: g.nameGu ?? "",
                }),
            }))}
          />
        </Wrap>
        <Wrap variant={variant} label={t("(ગુજરાતી)", "(Gujarati)")}>
          <div className="flex min-h-[44px] items-center rounded-[13px] border border-dashed border-[var(--line-input)] bg-[#F7F3EC] px-3.5 text-sm text-[var(--ink-dim)]">
            {selectedGroup?.nameGu || selectedGroup?.nameEn || "—"}
          </div>
        </Wrap>
      </div>
    );

  /* ─────────────────────────── place ─────────────────────────── */

  const cityOption = cities.find((c) => c.nameEn === values.city) ?? null;
  const villageOption = villages.find((v) => v.id === values.villageAreaId) ?? null;
  const placeLabel =
    communityType === "PARIVAR"
      ? cityOption
        ? bilingualLabel(cityOption.nameEn, cityOption.nameGu)
        : t("પસંદ કરો", "Select")
      : values.livesOutsideVillage
        ? t("ગામ બહાર રહે છે", "Lives outside village")
        : villageOption
          ? bilingualLabel(villageOption.nameEn, villageOption.nameGu)
          : t("પસંદ કરો", "Select");

  const placeBlock =
    communityType === "PARIVAR" ? (
      isAdmin ? (
        <AdminField label="City · શહેર" required>
          <AdminSelect
            value={values.city}
            onChange={(v) => onChange({ city: v })}
            className="w-full"
            options={[
              { value: "", label: "Select city…" },
              ...cities.map((c) => ({ value: c.nameEn, label: bilingualLabel(c.nameEn, c.nameGu) })),
            ]}
          />
        </AdminField>
      ) : (
        <Wrap variant={variant} label={`${t("શહેર", "City")} *`}>
          <PopoverPicker
            label={placeLabel}
            options={cities.map((c) => ({
              key: c.id,
              label: bilingualLabel(c.nameEn, c.nameGu),
              active: values.city === c.nameEn,
              onPick: () => onChange({ city: c.nameEn }),
            }))}
          />
        </Wrap>
      )
    ) : isAdmin ? (
      <>
        <AdminField label="Village · ગામ">
          <AdminSelect
            value={values.livesOutsideVillage ? "__outside__" : values.villageAreaId}
            onChange={(v) =>
              v === "__outside__"
                ? onChange({ livesOutsideVillage: true, villageAreaId: "" })
                : onChange({ livesOutsideVillage: false, villageAreaId: v })
            }
            className="w-full"
            options={[
              { value: "", label: "Select village…" },
              ...villages.map((v) => ({ value: v.id, label: bilingualLabel(v.nameEn, v.nameGu) })),
              { value: "__outside__", label: "Lives outside · બહાર" },
            ]}
          />
        </AdminField>
        <AdminField
          label={values.livesOutsideVillage ? "City · શહેર" : "City"}
          required={values.livesOutsideVillage}
        >
          <AdminInput value={values.city} onChange={(v) => onChange({ city: v })} />
        </AdminField>
      </>
    ) : (
      <>
        <Wrap variant={variant} label={`${t("ગામ / શહેર", "Village / city")} *`}>
          <PopoverPicker
            label={placeLabel}
            options={[
              ...villages.map((v) => ({
                key: v.id,
                label: bilingualLabel(v.nameEn, v.nameGu),
                active: !values.livesOutsideVillage && values.villageAreaId === v.id,
                onPick: () => onChange({ livesOutsideVillage: false, villageAreaId: v.id }),
              })),
              {
                key: "__outside__",
                label: t("ગામ બહાર રહે છે", "Lives outside village"),
                active: values.livesOutsideVillage,
                onPick: () => onChange({ livesOutsideVillage: true, villageAreaId: "" }),
              },
            ]}
          />
        </Wrap>
        {values.livesOutsideVillage && (
          <Wrap variant={variant} label={`${t("શહેર", "City")} *`}>
            <input
              className="samaj-fld"
              value={values.city}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder={t("હાલનું શહેર…", "Current city…")}
            />
          </Wrap>
        )}
      </>
    );

  /* ─────────────────────────── render ─────────────────────────── */

  return (
    <>
      {surnameBlock}

      <Wrap
        variant={variant}
        label={`${t("હાલનું સરનામું", "Current address")} (English)`}
        required
      >
        {isAdmin ? (
          <AdminInput
            value={values.addressEn}
            placeholder="Full postal address…"
            onChange={bindEn("addressEn", "addressGu", "addr")}
          />
        ) : (
          <input
            className="samaj-fld"
            value={values.addressEn}
            onChange={(e) => bindEn("addressEn", "addressGu", "addr")(e.target.value)}
            placeholder={t("મકાન, વિસ્તાર, શહેર…", "House, area, city…")}
          />
        )}
      </Wrap>

      <Wrap variant={variant} label={`${t("હાલનું સરનામું", "Current address")} (ગુજરાતી)`}>
        {isAdmin ? (
          <AdminInput gujarati value={values.addressGu} onChange={bindGu("addressGu", "addr:gu")} />
        ) : (
          <GujaratiInput
            inputClassName="samaj-fld"
            value={values.addressGu}
            onChange={bindGu("addressGu", "addr:gu")}
            placeholder={t("ગુજરાતીમાં…", "In Gujarati…")}
          />
        )}
        <button
          type="button"
          onClick={captureLocation}
          className={cn(
            "mt-2 flex h-12 w-full items-center gap-2.5 rounded-[13px] border-[1.5px] bg-white px-3",
            isAdmin ? "border-[var(--line-admin)]" : "border-[var(--line-input)]",
          )}
        >
          <span className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-[#EAF2E8] text-[#1E7A3E]">
            <MapPin className="size-[19px]" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[13.5px] font-bold text-[var(--ink)]">
              {hasLocation
                ? t("સ્થળ સેવ થયું", "Location captured")
                : t("નકશા પર સ્થળ પસંદ કરો", "Pin location on map")}
            </span>
            {hasLocation && (
              <span className="block text-[11.5px] font-semibold text-[#1E7A3E]">
                {values.latitude!.toFixed(4)}° N, {values.longitude!.toFixed(4)}° E
              </span>
            )}
          </span>
        </button>
      </Wrap>

      {placeBlock}

      {isAdmin ? (
        <>
          <AdminFormRow>
            <AdminField label="Native elder name (English)">
              <AdminInput
                value={values.nativeElderNameEn}
                onChange={bindEn("nativeElderNameEn", "nativeElderNameGu", "elder")}
              />
            </AdminField>
            <AdminField label="Native elder name (ગુજરાતી)">
              <AdminInput
                gujarati
                value={values.nativeElderNameGu}
                onChange={bindGu("nativeElderNameGu", "elder:gu")}
              />
            </AdminField>
          </AdminFormRow>
          <AdminField label="Native elder phone">
            <AdminInput
              value={values.nativeElderPhone}
              onChange={(v) => onChange({ nativeElderPhone: v.replace(/\D/g, "").slice(0, 10) })}
            />
          </AdminField>
        </>
      ) : (
        <>
          <Wrap
            variant={variant}
            label={t("વતનમાં રહેતા વડીલ (નામ) (English)", "Native elder name (English)")}
          >
            <input
              className="samaj-fld"
              value={values.nativeElderNameEn}
              onChange={(e) =>
                bindEn("nativeElderNameEn", "nativeElderNameGu", "elder")(e.target.value)
              }
              placeholder={t("વડીલનું નામ…", "Elder name…")}
            />
          </Wrap>
          <Wrap
            variant={variant}
            label={t("વતનમાં રહેતા વડીલ (નામ) (ગુજરાતી)", "Native elder name (Gujarati)")}
          >
            <GujaratiInput
              inputClassName="samaj-fld"
              value={values.nativeElderNameGu}
              onChange={bindGu("nativeElderNameGu", "elder:gu")}
              placeholder={t("ગુજરાતીમાં…", "In Gujarati…")}
            />
          </Wrap>
          <Wrap variant={variant} label={t("વતનમાં રહેતા વડીલ (ફોન)", "Native elder phone")}>
            <input
              className="samaj-fld"
              inputMode="numeric"
              value={values.nativeElderPhone}
              onChange={(e) =>
                onChange({ nativeElderPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })
              }
            />
          </Wrap>
        </>
      )}
    </>
  );
}

/** Label + control, in whichever design system the caller is using. */
function Wrap({
  variant,
  label,
  required,
  children,
}: {
  variant: "member" | "admin";
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  if (variant === "admin") {
    return (
      <AdminField label={label} required={required}>
        {children}
      </AdminField>
    );
  }
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[12.5px] font-bold text-[var(--ink-mid)]">
        {label}
        {required ? " *" : ""}
      </div>
      {children}
    </div>
  );
}

/** The member site's popover picker (the admin side uses AdminSelect instead). */
function PopoverPicker({
  label,
  options,
}: {
  label: string;
  options: { key: string; label: string; active: boolean; onPick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="samaj-fld flex w-full items-center justify-between bg-[var(--field)]"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-5 flex-none text-[var(--brand)]" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-[13px] border border-[var(--line-field)] bg-white shadow-lg">
          {options.map((o, i) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                o.onPick();
                setOpen(false);
              }}
              className={cn(
                "block w-full px-3 py-2.5 text-left text-sm",
                i > 0 && "border-t border-[var(--line-soft)]",
                o.active && "bg-[var(--brand-tint)] font-bold text-[var(--brand)]",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
