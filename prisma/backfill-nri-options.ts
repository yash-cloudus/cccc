/**
 * Puts every NRI country and city that families already answered into the
 * Dropdown lists masters.
 *
 * From today the masters keep themselves up to date — `syncNriOptions` runs on
 * every family write. This is only for the members who registered before that,
 * whose country and city are on their member row but nowhere in the admin's
 * list, so the NRI tab reads "No country options yet" while the directory shows
 * people in Bahrain.
 *
 * Safe to run more than once: the sync is idempotent and case-insensitive.
 *
 *   npx tsx prisma/backfill-nri-options.ts
 */
import { PrismaClient } from "@prisma/client";
import { syncNriOptions } from "../lib/nri";

const prisma = new PrismaClient();

async function main() {
  const communities = await prisma.community.findMany({ select: { id: true, slug: true } });
  for (const c of communities) {
    const members = await prisma.familyMember.findMany({
      where: { isNri: true, family: { communityId: c.id } },
      select: { isNri: true, nriCountry: true, nriCity: true },
    });
    if (members.length === 0) continue;
    await syncNriOptions(prisma, c.id, members);
    console.log(`${c.slug}: ${members.length} NRI member(s) synced`);
  }
  console.log("done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
