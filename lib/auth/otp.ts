import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/** Fixed OTP used when OTP_DEV_MODE=true (default 1234). */
export function getDevOtpCode() {
  return process.env.OTP_DEV_CODE || "1234";
}

export function isOtpDevMode() {
  return process.env.OTP_DEV_MODE === "true";
}

export function otpLength() {
  if (isOtpDevMode()) return getDevOtpCode().length;
  return Number(process.env.OTP_LENGTH || 6);
}

export function generateOtp(length = otpLength()) {
  if (isOtpDevMode()) return getDevOtpCode();
  let code = "";
  for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10).toString();
  return code;
}

export async function createOtp(mobile: string, channel: "whatsapp" | "sms" = "whatsapp") {
  const code = generateOtp();
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

  return { code, expiresAt, channel };
}

export async function verifyOtp(mobile: string, code: string) {
  const trimmed = (code || "").trim();

  // Developer shortcut: accept fixed code without SMS provider.
  if (isOtpDevMode() && trimmed === getDevOtpCode()) {
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
