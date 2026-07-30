import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, getClientIp } from "@/lib/api";
import { handleApiError } from "@/lib/admin-guard";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveCommunityId, getSessionPayload, isCommunityAdmin } from "@/lib/tenant";

/**
 * Member-side "add new" for master lists.
 *
 * Registration and profile edits let a member type an option the list does not
 * have yet (a business type, a course). Those screens are not admin, so their
 * writes to /api/admin/dropdowns were rejected and silently dropped — the typed
 * text stayed on that one member's record and the masters never learned about
 * it.
 *
 * What a member adds arrives here as a *request*: created disabled and flagged
 * `needsReview`, so the admin sees it in Dropdown lists straight away but no
 * other member is offered it until the admin enables it. An admin adding from
 * their own screens is the approval, so theirs goes in live. Either way the
 * member's own record keeps the text they typed.
 */

const schema = z.object({
  type: z.string().min(1),
  nameEn: z.string().min(1).max(80),
  nameGu: z.string().min(1).max(80),
  parentId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  try {
    // Registration is unauthenticated, so this is an anonymous write — cap it.
    if (!rateLimit(`dropdowns:${getClientIp(req)}`, 20).allowed) {
      return fail("Too many requests", 429);
    }

    const communityId = await getActiveCommunityId();
    if (!communityId) return fail("Community not found", 404);

    const body = schema.parse(await req.json());
    const type = body.type.trim();
    const nameEn = body.nameEn.trim();
    const parentId = body.parentId ?? null;

    if (parentId) {
      const parent = await prisma.dropdownOption.findFirst({
        where: { id: parentId, communityId },
        select: { id: true },
      });
      if (!parent) return fail("Parent option not found", 404);
    }

    // Same name under the same parent is the same option — hand back the
    // existing row instead of one duplicate per member who types it.
    const existing = await prisma.dropdownOption.findFirst({
      where: { communityId, type, parentId, nameEn },
    });
    if (existing) return created(existing);

    const byAdmin = isCommunityAdmin(await getSessionPayload());
    const item = await prisma.dropdownOption.create({
      data: {
        communityId,
        type,
        parentId,
        nameEn,
        nameGu: body.nameGu.trim() || nameEn,
        // Pending until an admin enables it — every list the members see
        // filters on `isActive`.
        isActive: byAdmin,
        needsReview: !byAdmin,
      },
    });
    return created(item);
  } catch (e) {
    return handleApiError(e, "Failed to add option");
  }
}
