/**
 * Community Admin → Settings.
 *
 * Mirrors the eight sections in `Admin.dc.html` (settingsVals). Every control
 * persists as one row in the generic `Setting` table (`communityId` + `key`),
 * so adding a section here needs no schema change — the key is
 * `<section>.<item>`, e.g. `result.enable`.
 *
 * Shared by the server page and the client form so defaults cannot drift.
 */

export type SettingItem = {
  key: string;
  label: string;
  help: string;
  /** Defaults to "toggle". "adPricing" renders the merged price+duration control. */
  type?: "toggle" | "number" | "select" | "adPricing";
  /** Only for type "select". */
  options?: string[];
  /** Toggle default is true unless stated; number/select carry a literal. */
  default?: boolean | string;
};

export type SettingSection = {
  id: string;
  title: string;
  desc: string;
  items: SettingItem[];
};

export const SETTINGS_SECTIONS: SettingSection[] = [
  {
    id: "result",
    title: "Result Drive",
    desc: "Control the Result Drive module in the User App.",
    items: [
      { key: "enable", label: "Enable Result Drive", help: "When disabled, the Result Drive module is completely hidden from the User App and no one can upload or view results." },
      { key: "studentUpload", label: "Allow Students to Upload Results", help: "Students (or their family logins) can upload their own marksheets." },
      { key: "adminUpload", label: "Allow Admin to Upload Results", help: "Admins can upload results on behalf of students." },
      { key: "showFinal", label: "Show Final Results", help: "The final ranked result report is visible to users." },
      { key: "showMerit", label: "Show Merit List", help: "The standard-wise merit list is visible to users." },
      { key: "waApprove", label: "WhatsApp Notification after Approval", help: "Send a WhatsApp message to the student when their result is approved." },
      { key: "waReject", label: "WhatsApp Notification after Rejection", help: "Send a WhatsApp message with the reason when a result is rejected." },
    ],
  },
  {
    id: "business",
    title: "Business Directory",
    desc: "Control the Business Directory in the User App.",
    items: [
      { key: "enable", label: "Enable Business Directory", help: "When disabled, users cannot view or register businesses." },
      { key: "allowReg", label: "Allow New Business Registration", help: "Users can submit their business to the directory." },
      { key: "requireApproval", label: "Require Admin Approval", help: "New businesses stay pending until an admin approves them." },
      { key: "showContact", label: "Show Contact Number", help: "Display the business contact number to users." },
      { key: "showWebsite", label: "Show Website Link", help: "Display the business website link to users." },
      { key: "showAddress", label: "Show Business Address", help: "Display the business address to users." },
    ],
  },
  {
    id: "ads",
    title: "Advertisements",
    desc: "Control advertisements shown across the User App.",
    items: [
      { key: "enable", label: "Enable Advertisements", help: "When disabled, all advertisements are hidden from the User App." },
      { key: "premium", label: "Enable Premium Advertisements", help: "Show paid banner advertisements." },
      { key: "general", label: "Enable General Advertisements", help: "Show free directory-linked advertisements." },
      { key: "allowBanner", label: "Allow Premium Banner Requests", help: "Users can request a premium banner from the app." },
      { key: "requireApproval", label: "Require Admin Approval", help: "Premium ads stay pending until an admin approves them." },
      {
        key: "pricing",
        label: "Premium Advertisement Price",
        help: "Amount charged for a premium banner advertisement — set separately for each validity period.",
        type: "adPricing",
      },
    ],
  },
  {
    id: "gallery",
    title: "Gallery",
    desc: "Control the photo Gallery in the User App.",
    items: [
      { key: "enable", label: "Enable Gallery", help: "When disabled, the Gallery is hidden from the User App." },
      { key: "album", label: "Allow Album View", help: "Users can browse photos grouped into albums." },
      { key: "download", label: "Allow Image Download", help: "Users can download images from the gallery." },
      { key: "sharing", label: "Allow Image Sharing", help: "Users can share gallery images to other apps." },
    ],
  },
  {
    id: "news",
    title: "News",
    desc: "Control the News feed in the User App.",
    items: [
      { key: "enable", label: "Enable News", help: "When disabled, News is hidden from the User App." },
      { key: "showHome", label: "Show News on Home Screen", help: "Latest news appears on the app home screen." },
      { key: "pdf", label: "Allow PDF Download", help: "Users can download attached news PDFs." },
      { key: "sharing", label: "Allow News Sharing", help: "Users can share news items to other apps." },
    ],
  },
  {
    id: "members",
    title: "Member Directory",
    desc: "Control what member information is visible in the User App.",
    items: [
      { key: "showMobile", label: "Show Mobile Numbers", help: "Display member mobile numbers in the directory." },
      { key: "showBusiness", label: "Show Business Information", help: "Display each member’s business details." },
      { key: "showAddress", label: "Show Address", help: "Display member addresses in the directory." },
      { key: "showFamily", label: "Show Family Details", help: "Display family relationships and members." },
      { key: "allowSearch", label: "Allow Member Search", help: "Users can search the member directory." },
    ],
  },
  {
    id: "registration",
    title: "Registration",
    desc: "Control member registration and profile updates.",
    items: [
      { key: "allowReg", label: "Allow New Member Registration", help: "When disabled, users cannot submit new registrations." },
      { key: "requireApproval", label: "Require Admin Approval", help: "New registrations stay pending until an admin approves them." },
      { key: "allowUpdate", label: "Allow Profile Update Requests", help: "When disabled, users cannot submit profile update requests." },
      { key: "requireUpdateApproval", label: "Require Approval for Profile Updates", help: "Profile changes apply only after an admin approves them." },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    desc: "Enable or disable each push / WhatsApp notification.",
    items: [
      { key: "regApproved", label: "Registration Approved", help: "Notify the user when their registration is approved." },
      { key: "regRejected", label: "Registration Rejected", help: "Notify the user when their registration is rejected." },
      { key: "resApproved", label: "Result Approved", help: "Notify the student when their result is approved." },
      { key: "resRejected", label: "Result Rejected", help: "Notify the student when their result is rejected." },
      { key: "bizApproved", label: "Business Approved", help: "Notify the user when their business is approved." },
      { key: "adApproved", label: "Advertisement Approved", help: "Notify the user when their advertisement is approved." },
      { key: "newsPublished", label: "News Published", help: "Notify users when new news is published." },
      { key: "galleryUpdated", label: "Gallery Updated", help: "Notify users when the gallery is updated." },
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
  if (item.type === "number" || item.type === "select" || item.type === "adPricing") {
    return String(item.default ?? "");
  }
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
