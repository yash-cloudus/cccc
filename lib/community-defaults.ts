import type { CommunityType, Prisma } from "@prisma/client";
import { seedRelationshipDefaults } from "@/lib/constants";
import { seedOccupationDefaults } from "@/lib/occupation-defaults";

type Tx = Prisma.TransactionClient | typeof import("@/lib/prisma").prisma;

export const DEFAULT_CITIES: { nameEn: string; nameGu: string; sortOrder: number }[] = [
  { nameEn: "Ahmedabad", nameGu: "અમદાવાદ", sortOrder: 1 },
  { nameEn: "Surat", nameGu: "સુરત", sortOrder: 2 },
  { nameEn: "Rajkot", nameGu: "રાજકોટ", sortOrder: 3 },
];

/** Seed DropdownOption type=city for Parivar communities. */
export async function seedCityDefaults(tx: Tx, communityId: string) {
  for (const c of DEFAULT_CITIES) {
    const existing = await tx.dropdownOption.findFirst({
      where: { communityId, type: "city", nameEn: c.nameEn, parentId: null },
      select: { id: true },
    });
    if (existing) continue;
    await tx.dropdownOption.create({
      data: {
        communityId,
        type: "city",
        nameEn: c.nameEn,
        nameGu: c.nameGu,
        sortOrder: c.sortOrder,
        isActive: true,
        parentId: null,
      },
    });
  }
}

/** Strip common community suffixes so "Vavliya Parivar" → "Vavliya". */
export function surnameFromCommunityName(name?: string | null) {
  const raw = (name || "").trim();
  if (!raw) return "";
  return raw
    .replace(/\s+(parivar|samaj|community|gam|family|પરિવાર|સમાજ|ગામ)\s*$/iu, "")
    .trim();
}

function titleCaseEn(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export async function seedLockedSurname(
  tx: Tx,
  communityId: string,
  nameEn: string,
  nameGu: string,
) {
  const en = nameEn.trim();
  const gu = nameGu.trim() || en;
  const existing = await tx.surnameGroup.findFirst({
    where: { communityId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return tx.surnameGroup.create({
    data: { communityId, nameEn: en, nameGu: gu, sortOrder: 0 },
  });
}

/**
 * Ensure Parivar communities always have a locked default surname group.
 * Creates one from community name when missing (safe backfill).
 */
export async function ensureParivarLockedSurname(tx: Tx, communityId: string) {
  const community = await tx.community.findUnique({
    where: { id: communityId },
    select: { type: true, nameEn: true, nameGu: true },
  });
  if (!community || community.type !== "PARIVAR") return null;

  const existing = await tx.surnameGroup.findFirst({
    where: { communityId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const enRaw = surnameFromCommunityName(community.nameEn) || community.nameEn.trim() || "Family";
  const guRaw =
    surnameFromCommunityName(community.nameGu) || community.nameGu?.trim() || enRaw;
  return seedLockedSurname(tx, communityId, titleCaseEn(enRaw), guRaw);
}

export async function seedGamVillages(
  tx: Tx,
  communityId: string,
  communityVillage?: string | null,
) {
  const count = await tx.villageArea.count({ where: { communityId } });
  if (count > 0) return;

  const main = (communityVillage || "Main village").trim();
  await tx.villageArea.create({
    data: {
      communityId,
      nameEn: main,
      nameGu: main,
      showPhones: true,
    },
  });
}

export type SeedCommunityOptions = {
  type: CommunityType;
  primarySurnameEn?: string;
  primarySurnameGu?: string;
  communityVillage?: string | null;
};

/**
 * Type-aware defaults after community create (and safe backfill).
 * Always: relationships + occupation tree.
 * PARIVAR: locked surname + city masters.
 * GAM: sample village area(s).
 */
export async function seedCommunityDefaults(tx: Tx, communityId: string, opts: SeedCommunityOptions) {
  await seedRelationshipDefaults(tx, communityId);
  await seedOccupationDefaults(tx, communityId);

  if (opts.type === "PARIVAR") {
    const community = await tx.community.findUnique({
      where: { id: communityId },
      select: { nameEn: true, nameGu: true },
    });
    const en =
      opts.primarySurnameEn?.trim() ||
      titleCaseEn(surnameFromCommunityName(community?.nameEn) || community?.nameEn || "") ||
      "Family";
    const gu =
      opts.primarySurnameGu?.trim() ||
      surnameFromCommunityName(community?.nameGu) ||
      community?.nameGu?.trim() ||
      en;
    await seedLockedSurname(tx, communityId, en, gu);
    await seedCityDefaults(tx, communityId);
  } else {
    await seedGamVillages(tx, communityId, opts.communityVillage);
  }
}

/** Parivar locked surname — creates from community name if missing. */
export async function getParivarLockedSurname(tx: Tx, communityId: string) {
  return ensureParivarLockedSurname(tx, communityId);
}
