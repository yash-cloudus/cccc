import { SignJWT, jwtVerify } from "jose";

export type JwtPayload = {
  sub: string;
  mobile: string;
  username?: string | null;
  roles: string[];
  permissions: string[];
  communityId?: string | null;
  communitySlug?: string | null;
  isPlatform?: boolean;
  typ: "access" | "refresh";
};

function secret(kind: "access" | "refresh") {
  const value =
    kind === "access"
      ? process.env.JWT_ACCESS_SECRET
      : process.env.JWT_REFRESH_SECRET;
  if (!value || value.length < 16) {
    throw new Error(`Missing ${kind} JWT secret`);
  }
  return new TextEncoder().encode(value);
}

export async function signToken(
  payload: Omit<JwtPayload, "typ"> & { typ: JwtPayload["typ"] },
  expiresIn: string,
) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret(payload.typ));
}

export async function verifyToken(token: string, kind: "access" | "refresh") {
  const { payload } = await jwtVerify(token, secret(kind));
  return payload as unknown as JwtPayload & { exp: number; iat: number };
}

export async function signAccessToken(data: Omit<JwtPayload, "typ">) {
  return signToken(
    { ...data, typ: "access" },
    process.env.JWT_ACCESS_EXPIRES || "15m",
  );
}

export async function signRefreshToken(data: Omit<JwtPayload, "typ">) {
  return signToken(
    { ...data, typ: "refresh" },
    process.env.JWT_REFRESH_EXPIRES || "30d",
  );
}
