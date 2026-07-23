import { z } from "zod";
import bcrypt from "bcryptjs";
import { fail, fromZod, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assertPlatform } from "@/lib/tenant";
import { groupingLabel } from "@/lib/platform";

function normalizeLogoUrl(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("/uploads/")) return v.slice(0, 500);
  if (/^https?:\/\//i.test(v)) return v.slice(0, 500);
  return null;
}

const patchSchema = z.object({
  nameEn: z.string().min(2).max(120).optional(),
  nameGu: z.string().max(120).nullable().optional(),
  logoText: z.string().max(3).nullable().optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  type: z.enum(["PARIVAR", "GAM"]).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  status: z.enum(["DRAFT", "LIVE", "SUSPENDED"]).optional(),
  /** Owner account updates (optional). Password only applied when non-empty. */
  adminName: z.string().max(120).optional(),
  adminPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Owner mobile must be 10 digits starting with 6–9")
    .optional(),
  adminUsername: z.string().min(3).max(64).optional(),
  adminPassword: z.string().min(4).max(128).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertPlatform();
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.community.findUnique({ where: { id } });
    if (!existing) return fail("Community not found", 404);

    const {
      adminName,
      adminPhone,
      adminUsername,
      adminPassword,
      logoUrl,
      ...communityFields
    } = body;

    const community = await prisma.$transaction(async (tx) => {
      const updated = await tx.community.update({
        where: { id },
        data: {
          ...communityFields,
          ...(logoUrl !== undefined ? { logoUrl: normalizeLogoUrl(logoUrl) } : {}),
          ...(body.type ? { groupingLabel: groupingLabel(body.type) } : {}),
        },
      });

      const hasOwnerPatch =
        adminName !== undefined ||
        adminPhone !== undefined ||
        adminUsername !== undefined ||
        (adminPassword !== undefined && adminPassword.length > 0);

      if (hasOwnerPatch) {
        const owner = await tx.user.findFirst({
          where: { communityId: id, roles: { some: { role: { name: "OWNER" } } } },
          orderBy: { createdAt: "asc" },
          include: { profile: true },
        });
        if (!owner) throw new Error("NO_OWNER");

        if (adminUsername) {
          const taken = await tx.user.findFirst({
            where: {
              communityId: id,
              username: adminUsername.trim().toLowerCase(),
              NOT: { id: owner.id },
            },
          });
          if (taken) throw new Error("USERNAME_TAKEN");
        }

        if (adminPhone) {
          const phoneTaken = await tx.user.findFirst({
            where: { communityId: id, mobile: adminPhone, NOT: { id: owner.id } },
          });
          if (phoneTaken) throw new Error("PHONE_TAKEN");
        }

        await tx.user.update({
          where: { id: owner.id },
          data: {
            ...(adminUsername ? { username: adminUsername.trim().toLowerCase() } : {}),
            ...(adminPhone ? { mobile: adminPhone } : {}),
            ...(adminPassword ? { passwordHash: await bcrypt.hash(adminPassword, 10) } : {}),
          },
        });

        if (adminName !== undefined) {
          if (owner.profile) {
            await tx.profile.update({
              where: { userId: owner.id },
              data: { fullNameEn: adminName.trim() || owner.profile.fullNameEn },
            });
          } else if (adminName.trim()) {
            await tx.profile.create({
              data: { userId: owner.id, fullNameEn: adminName.trim(), isHead: true },
            });
          }
        }
      }

      return updated;
    });

    return ok({ community });
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof Error && e.message === "NO_OWNER") return fail("No owner admin found for this app", 404);
    if (e instanceof Error && e.message === "USERNAME_TAKEN") return fail("Username already taken", 409);
    if (e instanceof Error && e.message === "PHONE_TAKEN") return fail("Mobile already used in this community", 409);
    console.error(e);
    return fail("Failed to update community", 500);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertPlatform();
    const { id } = await params;
    const community = await prisma.community.findUnique({
      where: { id },
      include: { _count: { select: { families: true } } },
    });
    if (!community) return fail("Community not found", 404);
    await prisma.community.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return fail("Forbidden", 403);
    console.error(e);
    return fail("Failed to delete community", 500);
  }
}
