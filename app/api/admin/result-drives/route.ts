import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";
import { DEFAULT_DRIVE_TITLE } from "@/lib/result-drive";

export async function GET() {
  try {
    const { communityId } = await requireAdmin();
    const items = await prisma.resultDrive.findMany({
      where: { communityId },
      include: { _count: { select: { entries: true } } },
      orderBy: { year: "desc" },
    });
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list result drives");
  }
}

const createSchema = z.object({
  /** Whether this drive should become the live one, closing whatever else is open. Defaults to true — the admin only gets asked when another drive is already active. */
  isOpen: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER", "DATA_MANAGER", "ADMIN"]);
    const { isOpen = true } = createSchema.parse(await req.json().catch(() => ({})));
    // No more admin-typed title/year — the new drive always continues the
    // sequence from whichever drive is furthest out already, regardless of
    // today's calendar date. First drive ever for a (legacy) community with
    // none yet falls back to the current year.
    const item = await prisma.$transaction(async (tx) => {
      const latest = await tx.resultDrive.findFirst({
        where: { communityId },
        orderBy: { year: "desc" },
        select: { year: true },
      });
      const year = latest ? latest.year + 1 : new Date().getFullYear();

      if (isOpen) {
        // Only one drive may be live at a time — opening this one closes any other.
        await tx.resultDrive.updateMany({
          where: { communityId, isOpen: true },
          data: { isOpen: false },
        });
      }
      return tx.resultDrive.create({
        data: {
          communityId,
          titleEn: DEFAULT_DRIVE_TITLE.en,
          titleGu: DEFAULT_DRIVE_TITLE.gu,
          year,
          isOpen,
        },
      });
    });
    return created(item);
  } catch (e) {
    return handleApiError(e, "Failed to create result drive");
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  titleEn: z.string().optional(),
  titleGu: z.string().optional(),
  year: z.number().int().optional(),
  isOpen: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER", "DATA_MANAGER", "ADMIN"]);
    const { id, ...data } = updateSchema.parse(await req.json());
    const existing = await prisma.resultDrive.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!existing) return fail("Result drive not found", 404);
    // Only one drive may be live at a time — (re)opening this one closes every other.
    const item = await prisma.$transaction(async (tx) => {
      if (data.isOpen) {
        await tx.resultDrive.updateMany({
          where: { communityId, isOpen: true, id: { not: id } },
          data: { isOpen: false },
        });
      }
      return tx.resultDrive.update({ where: { id }, data });
    });
    return ok(item);
  } catch (e) {
    return handleApiError(e, "Failed to update result drive");
  }
}
