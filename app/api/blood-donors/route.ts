import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { getActiveCommunityId } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const communityId = await getActiveCommunityId();
    if (!communityId) return ok({ members: [], groups: [] });

    const bloodType = new URL(req.url).searchParams.get("type");
    const city = new URL(req.url).searchParams.get("city");

    // Prefer derived directory members with blood group (scoped to this community)
    const members = await prisma.familyMember.findMany({
      where: {
        bloodGroup: bloodType
          ? (bloodType as
              | "A_POS"
              | "A_NEG"
              | "B_POS"
              | "B_NEG"
              | "O_POS"
              | "O_NEG"
              | "AB_POS"
              | "AB_NEG")
          : { not: null },
        isVisible: true,
        isDeceased: false,
        family: { communityId, status: "APPROVED", ...(city ? { city } : {}) },
      },
      include: { family: { include: { surnameGroup: true } } },
      take: 200,
    });

    const groups = await prisma.familyMember.groupBy({
      by: ["bloodGroup"],
      where: {
        bloodGroup: { not: null },
        family: { communityId, status: "APPROVED" },
        isVisible: true,
        isDeceased: false,
      },
      _count: true,
    });

    return ok({ members, groups });
  } catch (e) {
    console.error(e);
    return fail("Failed to load blood donors", 500);
  }
}
