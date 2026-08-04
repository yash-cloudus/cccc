import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

export async function GET(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const committeeId = new URL(req.url).searchParams.get("committeeId") || undefined;
    const items = await prisma.committeeMember.findMany({
      where: { communityId, ...(committeeId ? { committeeId } : {}) },
      include: { committee: true, designation: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list committee members");
  }
}

const createSchema = z.object({
  committeeId: z.string().optional(),
  designationId: z.string().optional(),
  profileId: z.string().optional(),
  nameOverride: z.string().optional(),
  nameGu: z.string().optional(),
  roleEn: z.string().optional(),
  roleGu: z.string().optional(),
  phoneOverride: z.string().optional(),
  phoneIso: z.string().length(2).optional(),
  whatsapp: z.string().optional(),
  whatsappIso: z.string().length(2).optional(),
  email: z.string().optional(),
  descGu: z.string().optional(),
  photoUrl: z.string().optional(),
  showContact: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/** Verify any referenced committee/designation belongs to this community. */
async function assertRefs(
  communityId: string,
  committeeId?: string | null,
  designationId?: string | null,
) {
  if (committeeId) {
    const c = await prisma.committee.findFirst({
      where: { id: committeeId, communityId },
      select: { id: true },
    });
    if (!c) throw new Error("BAD_REF");
  }
  if (designationId) {
    const d = await prisma.committeeDesignation.findFirst({
      where: { id: designationId, communityId },
      select: { id: true },
    });
    if (!d) throw new Error("BAD_REF");
  }
}

export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const body = createSchema.parse(await req.json());
    if (!body.profileId && !body.nameOverride) {
      return fail("Provide a member name or pick from the directory");
    }
    await assertRefs(communityId, body.committeeId, body.designationId);
    const item = await prisma.committeeMember.create({
      data: { communityId, ...body },
      include: { committee: true, designation: true },
    });
    return created(item);
  } catch (e) {
    if ((e as Error).message === "BAD_REF") return fail("Invalid committee or designation", 422);
    return handleApiError(e, "Failed to add committee member");
  }
}

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const { id, ...data } = updateSchema.parse(await req.json());
    const existing = await prisma.committeeMember.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Committee member not found", 404);
    await assertRefs(communityId, data.committeeId, data.designationId);
    const item = await prisma.committeeMember.update({
      where: { id },
      data,
      include: { committee: true, designation: true },
    });
    return ok(item);
  } catch (e) {
    if ((e as Error).message === "BAD_REF") return fail("Invalid committee or designation", 422);
    return handleApiError(e, "Failed to update committee member");
  }
}

export async function DELETE(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    const res = await prisma.committeeMember.deleteMany({ where: { id, communityId } });
    if (res.count === 0) return fail("Committee member not found", 404);
    return ok({ deleted: true });
  } catch (e) {
    return handleApiError(e, "Failed to remove committee member");
  }
}
