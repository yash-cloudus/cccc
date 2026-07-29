"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AdminBtn,
  AdminH2,
  AdminInput,
  AdminSelect,
  AdminToggle,
} from "@/components/admin/admin-ui";
import {
  AD_DURATIONS,
  SETTINGS_SECTIONS,
  getAdPricingSettingValue,
  isOn,
  parseAdPricing,
  serializeAdPricing,
  settingKey,
  settingValue,
  type SettingSection,
} from "@/lib/admin-settings";
import { api } from "@/lib/http";

export function SettingsClient({ stored }: { stored: Record<string, string> }) {
  // One flat map keyed `<section>.<item>` — mirrors the Setting table exactly.
  const initial = useMemo(() => {
    const map: Record<string, string> = {};
    for (const section of SETTINGS_SECTIONS) {
      for (const item of section.items) {
        map[settingKey(section.id, item.key)] =
          item.type === "adPricing" ? getAdPricingSettingValue(stored) : settingValue(stored, section, item);
      }
    }
    return map;
  }, [stored]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [savingId, setSavingId] = useState<string | null>(null);

  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const isDirty = (section: SettingSection) =>
    section.items.some((i) => {
      const k = settingKey(section.id, i.key);
      return values[k] !== initial[k];
    });

  async function save(section: SettingSection) {
    setSavingId(section.id);
    const payload: Record<string, string> = {};
    for (const item of section.items) {
      const k = settingKey(section.id, item.key);
      payload[k] = values[k];
    }
    const res = await api.patch("/api/admin/settings", { settings: payload });
    setSavingId(null);
    if (!res.ok) {
      toast.error(res.error || `Could not save ${section.title} settings`);
      return;
    }
    // Keep the baseline in sync so the section stops reading as dirty.
    for (const key of Object.keys(payload)) initial[key] = payload[key];
    toast.success(`${section.title} settings saved successfully`);
  }

  return (
    <>
      <AdminH2
        info={
          <>
            Control which features are enabled, disabled or visible in the Community Mobile App.
            Changes apply only after you save each section.
          </>
        }
      >
        Settings
      </AdminH2>

      <div className="flex flex-col gap-5">
        {SETTINGS_SECTIONS.map((section) => (
          <section
            key={section.id}
            className="rounded-2xl border border-[var(--line-admin)] bg-white p-5 max-md:p-4"
          >
            <h3 className="text-base font-extrabold text-[var(--ink)]">{section.title}</h3>
            <p className="mt-0.5 text-[12.5px] text-[var(--faint)]">{section.desc}</p>

            <div className="mt-4 flex flex-col">
              {section.items.map((item) => {
                const k = settingKey(section.id, item.key);
                const v = values[k] ?? "";
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-4 border-t border-[var(--line-soft)] py-3.5 first:border-t-0 first:pt-1 max-md:flex-col max-md:items-start max-md:gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-bold text-[var(--ink)]">{item.label}</div>
                      <div className="mt-0.5 text-[12px] leading-relaxed text-[var(--faint)]">
                        {item.help}
                      </div>
                    </div>

                    {item.type === "number" ? (
                      <AdminInput
                        type="number"
                        value={v}
                        onChange={(next) => set(k, next.replace(/[^0-9]/g, ""))}
                        className="w-[140px] max-md:w-full"
                      />
                    ) : item.type === "select" ? (
                      <AdminSelect
                        value={v}
                        ariaLabel={item.label}
                        onChange={(next) => set(k, next)}
                        options={(item.options ?? []).map((o) => ({ value: o, label: o }))}
                        className="w-[160px] max-md:w-full"
                      />
                    ) : item.type === "adPricing" ? (
                      <AdPricingControl value={v} onChange={(next) => set(k, next)} />
                    ) : (
                      <AdminToggle
                        on={isOn(v)}
                        label={item.label}
                        onChange={(next) => set(k, next ? "true" : "false")}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <AdminBtn
                onClick={() => save(section)}
                disabled={savingId === section.id || !isDirty(section)}
              >
                {savingId === section.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  `Save ${section.title}`
                )}
              </AdminBtn>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

/**
 * Merged price + duration editor for a premium banner. Both plans stay
 * stored in the underlying JSON, fully independent, so each gets its own
 * price textbox — the admin sets both at once with no toggle needed.
 */
function AdPricingControl({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const pricing = parseAdPricing(value);

  return (
    <div className="flex gap-2.5 max-md:w-full">
      {AD_DURATIONS.map((d) => {
        const field = d === "1 Year" ? "price1y" : "price6m";
        return (
          <div key={d} className="flex flex-col items-center gap-1 max-md:flex-1">
            <span className="text-[11.5px] font-bold text-[var(--ink-mid)]">{d}</span>
            <AdminInput
              type="number"
              value={pricing[field]}
              onChange={(next) =>
                onChange(serializeAdPricing({ ...pricing, [field]: next.replace(/[^0-9]/g, "") }))
              }
              className="w-[110px] max-md:w-full"
            />
          </div>
        );
      })}
    </div>
  );
}
