import { z } from "zod";
import bcrypt from "bcryptjs";
import { fail, fromZod, ok, created } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assertPlatform } from "@/lib/tenant";
import {
  MAX_LOGO_LETTERS,
  groupingLabel,
  isValidSlug,
  logoTextTooLong,
  normalizeSlug,
} from "@/lib/platform";
import { seedCommunityDefaults } from "@/lib/community-defaults";
import { encryptSecret, maskSecret, tryDecryptSecret } from "@/lib/security/crypto";

function normalizeLogoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("/uploads/")) return v.slice(0, 500);
  if (/^https?:\/\//i.test(v)) return v.slice(0, 500);
  return null;
}

export async function GET() {
  try {
    await assertPlatform();
    const communities = await prisma.community.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: { families: true, users: true, surnameGroups: true, villageAreas: true },
        },
        users: {
          where: { roles: { some: { role: { name: "OWNER" } } } },
          take: 1,
          orderBy: { createdAt: "asc" },
          include: { profile: true },
        },
        integration: true,
      },
    });
    return ok({
      communities: communities.map((c) => {
        const owner = c.users[0] || null;
        // `integration` is destructured out before the spread below, which
        // spreads the whole community row. Ciphertext must never ride along —
        // only the last four characters, so the admin can tell which key is in
        // there without being handed it back.
        const { users: _u, integration, ...rest } = c;
        return {
          ...rest,
          integration: integration
            ? {
                apiKeyMask: maskSecret(tryDecryptSecret(integration.waApiKeyEnc)),
                firmIdMask: maskSecret(tryDecryptSecret(integration.waFirmIdEnc)),
                senderMobile: integration.waSenderMobile,
              }
            : null,
          owner: owner
            ? {
                id: owner.id,
                username: owner.username,
                mobile: owner.mobile,
                name: owner.profile?.fullNameEn || "",
              }
            : null,
        };
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return fail("Forbidden", 403);
    console.error(e);
    return fail("Failed to load communities", 500);
  }
}

const createSchema = z
  .object({
    nameEn: z.string().min(2).max(120),
    nameGu: z.string().max(120).optional().default(""),
    logoText: z
      .string()
      .refine((v) => !logoTextTooLong(v), `Logo text must be at most ${MAX_LOGO_LETTERS} letters`)
      .optional()
      .default(""),
    logoUrl: z.string().max(500).nullable().optional(),
    type: z.enum(["PARIVAR", "GAM"]).default("PARIVAR"),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#A62A38"),
    secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#E8A33D"),
    slug: z.string().min(2).max(40),
    adminName: z.string().max(120).optional().default(""),
    adminPhone: z.string().regex(/^[6-9]\d{9}$/, "Owner mobile required (10 digits, starts with 6–9)"),
    adminUsername: z.string().min(3).max(64),
    adminPassword: z.string().min(4).max(128).default("admin"),
    status: z.enum(["DRAFT", "LIVE", "SUSPENDED"]).default("LIVE"),
    primarySurnameEn: z.string().max(80).optional().default(""),
    primarySurnameGu: z.string().max(80).optional().default(""),
    village: z.string().max(120).optional().default(""),
    authMode: z.enum(["MOBILE_PASSWORD", "WHATSAPP_API", "SMS"]).default("WHATSAPP_API"),
    waApiKey: z.string().max(500).optional().default(""),
    waFirmId: z.string().max(200).optional().default(""),
    waSenderMobile: z.string().max(20).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.type === "PARIVAR" && !v.primarySurnameEn.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Primary surname is required for Parivar communities",
        path: ["primarySurnameEn"],
      });
    }
  });

export async function POST(req: Request) {
  try {
    await assertPlatform();
    const body = createSchema.parse(await req.json());

    const slug = normalizeSlug(body.slug);
    if (!isValidSlug(slug)) return fail("Invalid subdomain. Use a-z, 0-9, underscore (2–40 chars).", 422);

    const existing = await prisma.community.findUnique({ where: { slug } });
    if (existing) return fail("This subdomain is already taken", 409, { field: "slug" });

    const username = body.adminUsername.trim().toLowerCase();
    const password = body.adminPassword.trim() || "admin";
    const mobile = body.adminPhone;

    const logoText = body.logoText || body.nameEn.trim().charAt(0).toUpperCase();
    const logoUrl = normalizeLogoUrl(body.logoUrl);

    const result = await prisma.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          slug,
          nameEn: body.nameEn.trim(),
          nameGu: body.nameGu || null,
          logoText,
          logoUrl,
          type: body.type,
          status: body.status,
          primaryColor: body.primaryColor,
          secondaryColor: body.secondaryColor,
          groupingLabel: groupingLabel(body.type),
          village: body.village.trim() || null,
          authMode: body.authMode,
        },
      });

      // Only when all three are present — partial credentials cannot send, and
      // a half-filled row would read as "configured" to every caller.
      const apiKey = body.waApiKey.trim();
      const firmId = body.waFirmId.trim();
      const senderMobile = body.waSenderMobile.trim();
      if (body.authMode === "WHATSAPP_API" && apiKey && firmId && senderMobile) {
        await tx.communityIntegration.create({
          data: {
            communityId: community.id,
            waApiKeyEnc: encryptSecret(apiKey),
            waFirmIdEnc: encryptSecret(firmId),
            waSenderMobile: senderMobile,
          },
        });
      }

      const ownerRole = await tx.role.findUniqueOrThrow({ where: { name: "OWNER" } });
      const memberRole = await tx.role.findUniqueOrThrow({ where: { name: "MEMBER" } });
      const passwordHash = await bcrypt.hash(password, 10);

      const admin = await tx.user.create({
        data: {
          communityId: community.id,
          mobile,
          username,
          passwordHash,
          status: "APPROVED",
        },
      });
      await tx.userRole.createMany({
        data: [
          { userId: admin.id, roleId: ownerRole.id },
          { userId: admin.id, roleId: memberRole.id },
        ],
      });
      if (body.adminName) {
        await tx.profile.create({
          data: { userId: admin.id, fullNameEn: body.adminName, isHead: true },
        });
      }
      await seedCommunityDefaults(tx, community.id, {
        type: body.type,
        primarySurnameEn: body.primarySurnameEn,
        primarySurnameGu: body.primarySurnameGu,
        communityVillage: body.village || community.nameEn,
      });

      return { community, username };
    });

    return created({
      community: result.community,
      credentials: { username: result.username, password },
    });
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return fail("Forbidden", 403);
    if (e instanceof Error && e.message.includes("ENCRYPTION_KEY")) {
      return fail("Server is missing ENCRYPTION_KEY — cannot store integration credentials", 500);
    }
    console.error(e);
    return fail("Failed to create community", 500);
  }
}
