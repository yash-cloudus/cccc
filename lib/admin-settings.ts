/**
 * Community Admin → Settings.
 *
 * Every control persists as one row in the generic `Setting` table
 * (`communityId` + `key`), so adding one needs no schema change — the key is
 * `<section>.<item>`, e.g. `result.enable`.
 *
 * This list was originally ported wholesale from the `Admin.dc.html` mock-up
 * and carried 44 toggles, of which only 7 were ever read by any code. It has
 * been cut back to the controls that actually drive behaviour: an entry here
 * MUST have a consumer, otherwise it is a switch that lies to the admin.
 *
 * Copy lives in `lib/i18n/admin-dictionary.ts` under `set.<section>.title`,
 * `set.<section>.desc`, `set.<section>.<item>` and `set.<section>.<item>.help`
 * — this file carries only structure, so English and Gujarati stay in one place.
 */

// Type-only import: `admin-dictionary` is a "use client" module, but types are
// erased at build time so this stays safe to pull into server code.
import type { AdminKey } from "@/lib/i18n/admin-dictionary";

export type SettingItem = {
  key: string;
  /**
   * Dictionary keys, spelled out rather than built with a template string.
   * `AdminKey` is a literal union, so a key with no dictionary entry is a
   * compile error — the previous `as AdminKey` casts let 100+ missing entries
   * ship silently and the screen rendered raw "set.result.title" text.
   */
  labelKey: AdminKey;
  helpKey: AdminKey;
  /** Defaults to "toggle". "adPricing" renders the merged price+duration control. */
  type?: "toggle" | "adPricing";
  /** Toggles default on unless this says otherwise. */
  default?: boolean | string;
};

export type SettingSection = {
  id: string;
  titleKey: AdminKey;
  descKey: AdminKey;
  items: SettingItem[];
};

export const SETTINGS_SECTIONS: SettingSection[] = [
  {
    id: "result",
    titleKey: "set.result.title",
    descKey: "set.result.desc",
    items: [
      { key: "enable", labelKey: "set.result.enable", helpKey: "set.result.enable.help" },
      { key: "studentUpload", labelKey: "set.result.studentUpload", helpKey: "set.result.studentUpload.help" },
      { key: "adminUpload", labelKey: "set.result.adminUpload", helpKey: "set.result.adminUpload.help" },
      { key: "showMerit", labelKey: "set.result.showMerit", helpKey: "set.result.showMerit.help" },
      { key: "waApprove", labelKey: "set.result.waApprove", helpKey: "set.result.waApprove.help" },
      { key: "waReject", labelKey: "set.result.waReject", helpKey: "set.result.waReject.help" },
    ],
  },
  {
    id: "ads",
    titleKey: "set.ads.title",
    descKey: "set.ads.desc",
    items: [
      { key: "pricing", labelKey: "set.ads.pricing", helpKey: "set.ads.pricing.help", type: "adPricing" },
    ],
  },
  {
    id: "notifications",
    titleKey: "set.notifications.title",
    descKey: "set.notifications.desc",
    items: [
      { key: "newsPublished", labelKey: "set.notifications.newsPublished", helpKey: "set.notifications.newsPublished.help" },
      { key: "adApproved", labelKey: "set.notifications.adApproved", helpKey: "set.notifications.adApproved.help" },
    ],
  },
];

/** `Setting.key` for one control. */
export function settingKey(sectionId: string, itemKey: string): string {
  return `${sectionId}.${itemKey}`;
}

/** Stored value for an item, falling back to its default (toggles default on). */
export function settingValue(
  stored: Record<string, string>,
  section: SettingSection,
  item: SettingItem,
): string {
  const raw = stored[settingKey(section.id, item.key)];
  if (raw !== undefined) return raw;
  if (item.type === "adPricing") return String(item.default ?? "");
  return item.default === false ? "false" : "true";
}

export function isOn(value: string): boolean {
  return value === "true";
}

/* ============================ Premium ad pricing ============================ */

/**
 * Premium banner plans. The admin Settings UI merges price + duration into
 * one control (switching duration swaps which tier's price is being edited),
 * stored as a single JSON blob under `ads.pricing` so both tiers persist even
 * though only one is visible at a time.
 */
export const AD_DURATIONS = ["6 Months", "1 Year"] as const;
export type AdDuration = (typeof AD_DURATIONS)[number];

export const AD_DURATION_MONTHS: Record<AdDuration, number> = { "6 Months": 6, "1 Year": 12 };
const AD_PRICE_DEFAULTS: Record<AdDuration, string> = { "6 Months": "2000", "1 Year": "4000" };

export type AdPricing = { duration: AdDuration; price6m: string; price1y: string };

function isAdDuration(v: unknown): v is AdDuration {
  return v === "6 Months" || v === "1 Year";
}

/** Parses the JSON stored under `ads.pricing`, tolerating missing/malformed input. */
export function parseAdPricing(raw: string | undefined): AdPricing {
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (isAdDuration(p?.duration)) {
        return {
          duration: p.duration,
          price6m: String(p.price6m ?? AD_PRICE_DEFAULTS["6 Months"]),
          price1y: String(p.price1y ?? AD_PRICE_DEFAULTS["1 Year"]),
        };
      }
    } catch {
      // Malformed — fall through to the default below.
    }
  }
  return {
    duration: "6 Months",
    price6m: AD_PRICE_DEFAULTS["6 Months"],
    price1y: AD_PRICE_DEFAULTS["1 Year"],
  };
}

export function serializeAdPricing(p: AdPricing): string {
  return JSON.stringify(p);
}

/**
 * The `ads.pricing` value to seed the Settings UI with — migrates one-time
 * from the older standalone `ads.price` / `ads.duration` keys so communities
 * that already configured a price don't see it reset to the default the
 * first time this merged control loads.
 */
export function getAdPricingSettingValue(stored: Record<string, string>): string {
  const existing = stored["ads.pricing"];
  if (existing) return existing;

  const duration: AdDuration = stored["ads.duration"] === "1 Year" ? "1 Year" : "6 Months";
  const legacyPrice = stored["ads.price"];
  return serializeAdPricing({
    duration,
    price6m: duration === "6 Months" ? (legacyPrice ?? AD_PRICE_DEFAULTS["6 Months"]) : AD_PRICE_DEFAULTS["6 Months"],
    price1y: duration === "1 Year" ? (legacyPrice ?? AD_PRICE_DEFAULTS["1 Year"]) : AD_PRICE_DEFAULTS["1 Year"],
  });
}

export type AdPriceTiers = Record<AdDuration, number>;

/** Both plan prices + the admin's chosen default plan, resolved from stored Settings. */
export function getAdPriceTiers(
  stored: Record<string, string>,
): { tiers: AdPriceTiers; defaultDuration: AdDuration } {
  const p = parseAdPricing(getAdPricingSettingValue(stored));
  return {
    tiers: {
      "6 Months": Number(p.price6m) || Number(AD_PRICE_DEFAULTS["6 Months"]),
      "1 Year": Number(p.price1y) || Number(AD_PRICE_DEFAULTS["1 Year"]),
    },
    defaultDuration: p.duration,
  };
}

/** Bilingual validity text for a banner's charge, e.g. "6 months" / "6 મહિના". */
export function adDurationLabel(months: number, T: (g: string, e: string) => string): string {
  if (months === 12) return T("1 વર્ષ", "1 year");
  if (months % 12 === 0) return T(`${months / 12} વર્ષ`, `${months / 12} years`);
  return T(`${months} મહિના`, `${months} months`);
}
