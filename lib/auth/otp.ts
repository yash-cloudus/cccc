import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { canSendWhatsApp } from "@/lib/whatsapp/arthix";

/** Fixed OTP used when the community cannot actually deliver one (default 1234). */
export function getDevOtpCode() {
  return process.env.OTP_DEV_CODE || "1234";
}

/**
 * Master kill-switch for the fixed-code shortcut.
 *
 * Hard-off in production regardless of the env var: `verifyOtp` accepts the dev
 * code without reading a single database row, so leaving this on in production
 * would let anyone who knows a member's mobile number sign in as them. An env
 * var that dangerous should not be one typo away from being wrong.
 */
export function isOtpDevMode() {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.OTP_DEV_MODE === "true";
}

/**
 * Whether this community can put a real code in front of a real person.
 *
 * Derived, never stored: it is the send path's own answer, so it cannot drift
 * out of sync with reality the way a "dev mode" toggle would. The moment one
 * community's ARTHIX credentials are saved (and the sender is implemented),
 * that community starts issuing real codes while every other one keeps working
 * on the fixed code.
 */
export async function canDeliverOtp(communityId: string): Promise<boolean> {
  return canSendWhatsApp(communityId);
}

export function otpLength(deliverable = false) {
  if (!deliverable) return getDevOtpCode().length;
  return Number(process.env.OTP_LENGTH || 6);
}

export function generateOtp(deliverable = false) {
  if (!deliverable) return getDevOtpCode();
  const length = otpLength(true);
  let code = "";
  for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10).toString();
  return code;
}

export async function createOtp(
  mobile: string,
  channel: "whatsapp" | "sms" = "whatsapp",
  deliverable = false,
) {
  const code = generateOtp(deliverable);
  const codeHash = await bcrypt.hash(code, 10);
  const minutes = Number(process.env.OTP_EXPIRY_MINUTES || 5);
  const expiresAt = new Date(Date.now() + minutes * 60_000);

  await prisma.otpCode.updateMany({
    where: { mobile, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.otpCode.create({
    data: { mobile, codeHash, channel, expiresAt },
  });

  return { code, expiresAt, channel, length: otpLength(deliverable) };
}

/**
 * `allowDevCode` is the caller's answer to "could this community have delivered
 * a real code?". It is passed in rather than read from the environment here so
 * that a community with working credentials never accepts the fixed code, even
 * on a developer's machine.
 */
export async function verifyOtp(mobile: string, code: string, allowDevCode = false) {
  const trimmed = (code || "").trim();

  if (allowDevCode && isOtpDevMode() && trimmed === getDevOtpCode()) {
    await prisma.otpCode.updateMany({
      where: { mobile, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return { ok: true as const };
  }

  const row = await prisma.otpCode.findFirst({
    where: { mobile, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false as const, reason: "expired" };
  if (row.attempts >= 5) return { ok: false as const, reason: "locked" };

  const match = await bcrypt.compare(trimmed, row.codeHash);
  await prisma.otpCode.update({
    where: { id: row.id },
    data: { attempts: { increment: 1 }, consumedAt: match ? new Date() : undefined },
  });
  if (!match) return { ok: false as const, reason: "invalid" };
  return { ok: true as const };
}
