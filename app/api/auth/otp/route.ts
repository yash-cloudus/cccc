import { z } from "zod";
import { canDeliverOtp, createOtp, isOtpDevMode } from "@/lib/auth/otp";
import { fail, fromZod, getClientIp, ok } from "@/lib/api";
import { rateLimit } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/prisma";
import { getActiveCommunity } from "@/lib/tenant";
import { ACCESS_DENIAL, checkMemberAccess } from "@/lib/auth/member-access";
import { sendWhatsApp } from "@/lib/whatsapp/arthix";
import { DEFAULT_ISO, digitsOf, e164, isValidNumber } from "@/lib/phone";

const schema = z.object({
  // Validated per country below, not by a fixed Indian pattern — a member
  // abroad signs in with their own number.
  mobile: z.string().min(4).max(20),
  mobileIso: z.string().length(2).default(DEFAULT_ISO),
  channel: z.enum(["whatsapp", "sms"]).default("whatsapp"),
  purpose: z.enum(["login", "admin", "register"]).default("login"),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limited = rateLimit(`otp:${ip}`, 10, 60_000);
    if (!limited.allowed) return fail("Too many OTP requests", 429);

    const body = schema.parse(await req.json());
    const mobile = digitsOf(body.mobile);
    const mobileIso = body.mobileIso.toLowerCase();
    if (!isValidNumber(mobile, mobileIso)) return fail("Invalid mobile number", 422);

    // Resolved for every purpose, not just login/admin: a MOBILE_PASSWORD
    // community must not be able to mint an OTP through *any* door, and
    // `purpose: "register"` skips the access checks below.
    const community = await getActiveCommunity();
    if (!community) return fail("Community not found", 404);

    // The gate that makes password login real. Without it anyone could ask for
    // an OTP here, post it to /api/auth/verify, and never touch the password.
    if (community.authMode === "MOBILE_PASSWORD") {
      return fail("This community signs in with a password", 400, { usePassword: true });
    }

    if (body.purpose === "login" || body.purpose === "admin") {
      const access = await checkMemberAccess(community.id, mobile, mobileIso);
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

    // "Can this community actually put a code in front of the member?" decides
    // whether the code is real or the fixed dev one — see lib/auth/otp.ts.
    const deliverable = await canDeliverOtp(community.id);
    // Stored against the full international number, which is what /api/auth/verify
    // looks it up by — the national part alone is ambiguous across countries.
    const { code, expiresAt, channel, length } = await createOtp(
      e164(mobile, mobileIso),
      body.channel,
      deliverable,
    );

    if (deliverable) {
      // The provider needs the full international number, not the national part.
      const sent = await sendWhatsApp(
        community.id,
        e164(mobile, mobileIso),
        `${code} is your OTP. Do not share it.`,
      );
      // Fail loudly rather than leaving the member staring at a code that was
      // generated but never sent.
      if (!sent) return fail("Could not send the OTP right now, please try again", 502);
      return ok({ mobile, channel, expiresAt, length, message: "OTP sent on WhatsApp" });
    }

    if (!isOtpDevMode()) {
      // No provider configured and no dev shortcut: say so instead of storing a
      // code nobody can ever receive.
      return fail("OTP delivery is not configured for this community", 503);
    }

    return ok({
      mobile,
      channel,
      expiresAt,
      length,
      devCode: code,
      message: channel === "whatsapp" ? "OTP sent on WhatsApp" : "OTP sent via SMS",
    });
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Failed to send OTP", 500);
  }
}
