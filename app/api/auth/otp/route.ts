import { z } from "zod";
import { createOtp } from "@/lib/auth/otp";
import { fail, fromZod, getClientIp, ok } from "@/lib/api";
import { rateLimit } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { ACCESS_DENIAL, checkMemberAccess } from "@/lib/auth/member-access";

const schema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  channel: z.enum(["whatsapp", "sms"]).default("whatsapp"),
  purpose: z.enum(["login", "admin", "register"]).default("login"),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limited = rateLimit(`otp:${ip}`, 10, 60_000);
    if (!limited.allowed) return fail("Too many OTP requests", 429);

    const body = schema.parse(await req.json());
    const mobile = body.mobile;

    if (body.purpose === "login" || body.purpose === "admin") {
      const community = await getActiveCommunity();
      if (!community) return fail("Community not found", 404);
      const access = await checkMemberAccess(community.id, mobile);
      if (!access.ok) {
        const denial = ACCESS_DENIAL[access.reason];
        // `pending` keeps its flag so the login screen can route to /pending
        // instead of just showing the message.
        return fail(
          denial.message,
          denial.status,
          access.reason === "pending" ? { pending: true } : undefined,
        );
      }

      if (body.purpose === "admin") {
        const assigned = await prisma.userRole.findMany({
          where: { userId: access.userId },
          include: { role: true },
        });
        const okAdmin = assigned.some((r) =>
          ["OWNER", "DATA_MANAGER", "CONTENT_MANAGER", "MODERATOR", "ADMIN"].includes(r.role.name),
        );
        if (!okAdmin) return fail("Not an admin user", 403);
      }
    }

    const { code, expiresAt, channel } = await createOtp(mobile, body.channel);

    // In production: send via WhatsApp/SMS provider. Dev returns hint when OTP_DEV_MODE=true.
    return ok({
      mobile,
      channel,
      expiresAt,
      ...(process.env.OTP_DEV_MODE === "true" ? { devCode: code } : {}),
      message:
        channel === "whatsapp"
          ? "OTP sent on WhatsApp"
          : "OTP sent via SMS",
    });
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Failed to send OTP", 500);
  }
}
