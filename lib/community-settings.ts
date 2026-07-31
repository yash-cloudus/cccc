import { prisma } from "@/lib/prisma";
import { isOn, settingValue, SETTINGS_SECTIONS } from "@/lib/admin-settings";

/** All Setting rows for one community, keyed `<section>.<item>`. */
export async function getCommunitySettingsMap(communityId: string): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { communityId }, select: { key: true, value: true } });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

/** Resolved boolean for one toggle, with prototype defaults (on unless explicitly off). */
export function communitySettingOn(stored: Record<string, string>, sectionId: string, itemKey: string): boolean {
  const section = SETTINGS_SECTIONS.find((s) => s.id === sectionId);
  const item = section?.items.find((i) => i.key === itemKey);
  if (!section || !item) return true;
  return isOn(settingValue(stored, section, item));
}

export type ResultModuleSettings = {
  enable: boolean;
  studentUpload: boolean;
  adminUpload: boolean;
  showMerit: boolean;
  waApprove: boolean;
  waReject: boolean;
};

export function getResultModuleSettings(stored: Record<string, string>): ResultModuleSettings {
  return {
    enable: communitySettingOn(stored, "result", "enable"),
    studentUpload: communitySettingOn(stored, "result", "studentUpload"),
    adminUpload: communitySettingOn(stored, "result", "adminUpload"),
    showMerit: communitySettingOn(stored, "result", "showMerit"),
    waApprove: communitySettingOn(stored, "result", "waApprove"),
    waReject: communitySettingOn(stored, "result", "waReject"),
  };
}
