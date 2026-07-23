import { randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";

export type LaunchTarget = "admin" | "app";

export type LaunchTokenPayload = {
  sub: string;
  purpose: "platform_launch";
  target: LaunchTarget;
  communityId: string;
  communitySlug: string;
  jti: string;
};

const usedJtis = new Map<string, number>();

function accessSecret() {
  const value = process.env.JWT_ACCESS_SECRET;
  if (!value || value.length < 16) throw new Error("Missing JWT_ACCESS_SECRET");
  return new TextEncoder().encode(value);
}

function pruneUsed() {
  const now = Date.now();
  for (const [jti, exp] of usedJtis) {
    if (exp < now) usedJtis.delete(jti);
  }
}

/** Short-lived one-time launch token (Main Admin → tenant host). */
export async function signLaunchToken(input: {
  userId: string;
  target: LaunchTarget;
  communityId: string;
  communitySlug: string;
}) {
  const jti = randomUUID();
  const token = await new SignJWT({
    purpose: "platform_launch",
    target: input.target,
    communityId: input.communityId,
    communitySlug: input.communitySlug,
    jti,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(accessSecret());

  return { token, jti };
}

export async function consumeLaunchToken(token: string): Promise<LaunchTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecret());
  if (payload.purpose !== "platform_launch") throw new Error("INVALID_LAUNCH");
  if (payload.target !== "admin" && payload.target !== "app") throw new Error("INVALID_LAUNCH");
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("INVALID_LAUNCH");
  if (typeof payload.communityId !== "string" || !payload.communityId) throw new Error("INVALID_LAUNCH");
  if (typeof payload.communitySlug !== "string" || !payload.communitySlug) throw new Error("INVALID_LAUNCH");
  if (typeof payload.jti !== "string" || !payload.jti) throw new Error("INVALID_LAUNCH");

  pruneUsed();
  if (usedJtis.has(payload.jti)) throw new Error("LAUNCH_USED");
  // Hold until token would have expired (+ small buffer)
  const expMs = typeof payload.exp === "number" ? payload.exp * 1000 : Date.now() + 60_000;
  usedJtis.set(payload.jti, expMs + 30_000);

  return {
    sub: payload.sub,
    purpose: "platform_launch",
    target: payload.target,
    communityId: payload.communityId,
    communitySlug: payload.communitySlug,
    jti: payload.jti,
  };
}
