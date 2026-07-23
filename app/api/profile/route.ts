import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, fromZod, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";

/** Current member's own profile + family (session-scoped). */
export async function GET() {
  try {
    const session = await requireSession();
    const [profile, user] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: session.sub },
        include: {
          family: {
            include: {
              surnameGroup: true,
              familyMembers: {
                where: { isVisible: true },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      }),
      prisma.user.findUnique({ where: { id: session.sub }, select: { mobile: true } }),
    ]);
    return ok({ profile, mobile: user?.mobile ?? null, userId: session.sub });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    return fail("Failed to load profile", 500);
  }
}

const schema = z.object({
  showPhone: z.boolean().optional(),
  showBusiness: z.boolean().optional(),
  occupation: z.string().max(120).optional(),
  currentlyAt: z.string().max(120).optional(),
  education: z.string().max(120).optional(),
});

/** Member updates their own privacy flags / basic details. */
export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = schema.parse(await req.json());
    const existing = await prisma.profile.findUnique({ where: { userId: session.sub } });
    if (!existing) return fail("Profile not found", 404);
    const updated = await prisma.profile.update({
      where: { userId: session.sub },
      data: body,
    });
    return ok(updated);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to update profile", 500);
  }
}
