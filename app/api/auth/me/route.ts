import { getAccessToken } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";
import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const token = await getAccessToken();
    if (!token) return fail("Unauthorized", 401);
    const payload = await verifyToken(token, "access");
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        profile: { include: { family: true } },
        roles: { include: { role: true } },
      },
    });
    if (!user) return fail("Unauthorized", 401);
    return ok({
      id: user.id,
      mobile: user.mobile,
      status: user.status,
      roles: user.roles.map((r: { role: { name: string } }) => r.role.name),
      profile: user.profile,
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}
