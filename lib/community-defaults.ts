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
    const en = opts.primarySurnameEn?.trim();
    if (en) {
      await seedLockedSurname(tx, communityId, en, opts.primarySurnameGu?.trim() || en);
    }
    await seedCityDefaults(tx, communityId);
  } else {
    await seedGamVillages(tx, communityId, opts.communityVillage);
  }
}

/** True when this community is Parivar with a single locked surname group. */
export async function getParivarLockedSurname(tx: Tx, communityId: string) {
  const community = await tx.community.findUnique({
    where: { id: communityId },
    select: { type: true },
  });
  if (!community || community.type !== "PARIVAR") return null;
  return tx.surnameGroup.findFirst({
    where: { communityId },
    orderBy: { createdAt: "asc" },
  });
}
