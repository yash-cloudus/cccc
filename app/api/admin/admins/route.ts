import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { created, fail, ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";
import { COMMUNITY_ADMIN_ROLES } from "@/lib/constants";

const ASSIGNABLE = COMMUNITY_ADMIN_ROLES.filter((r) => r !== "ADMIN"); // ADMIN is legacy alias
const ASSIGNABLE_SET = new Set<string>(ASSIGNABLE);

function onlyAssignableRoles(roles: string[]) {
  return roles.filter((r) => ASSIGNABLE_SET.has(r));
}

export async function GET() {
  try {
    const { communityId } = await requireAdmin();
    const admins = await prisma.user.findMany({
      where: {
        communityId,
        roles: { some: { role: { name: { in: [...COMMUNITY_ADMIN_ROLES] } } } },
      },
      include: { profile: true, roles: { include: { role: true } } },
      orderBy: { createdAt: "asc" },
    });
    const items = admins.map((u) => ({
      id: u.id,
      username: u.username,
      mobile: u.mobile,
      status: u.status,
      name: u.profile?.fullNameEn || u.username || u.mobile,
      nameGu: u.profile?.fullNameGu || null,
      roles: onlyAssignableRoles(u.roles.map((r) => r.role.name)),
    }));
    return ok(items);
  } catch (e) {
    return handleApiError(e, "Failed to list admins");
  }
}

const createSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(4).max(128),
  fullNameEn: z.string().min(1),
  fullNameGu: z.string().optional(),
  mobile: z
    .union([z.literal(""), z.string().regex(/^[6-9]\d{9}$/, "Valid 10-digit mobile required")])
    .optional(),
  roles: z.array(z.enum(ASSIGNABLE as [string, ...string[]])).min(1),
});

async function roleIdsByName(names: string[]) {
  const roles = await prisma.role.findMany({ where: { name: { in: names } }, select: { id: true, name: true } });
  const missing = names.filter((n) => !roles.find((r) => r.name === n));
  if (missing.length) throw new Error("BAD_ROLE");
  return roles.map((r) => r.id);
}

export async function POST(req: Request) {
  try {
    const { communityId } = await requireAdmin(["OWNER"]);
    const body = createSchema.parse(await req.json());
    const passwordHash = await bcrypt.hash(body.password, 10);
    const mobile = body.mobile?.trim() || `9${Date.now().toString().slice(-9)}`;

    const user = await prisma.user.create({
      data: {
        communityId,
        username: body.username.trim().toLowerCase(),
        mobile,
        passwordHash,
        status: "APPROVED",
        profile: { create: { fullNameEn: body.fullNameEn.trim(), fullNameGu: body.fullNameGu?.trim() } },
        roles: {
          create: (await roleIdsByName([...body.roles, "MEMBER"])).map((roleId) => ({ roleId })),
        },
      },
      include: { profile: true, roles: { include: { role: true } } },
    });
    return created({
      id: user.id,
      username: user.username,
      mobile: user.mobile,
      name: user.profile?.fullNameEn,
      roles: onlyAssignableRoles(user.roles.map((r) => r.role.name)),
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Username or mobile already exists in this community", 409);
    }
    if ((e as Error).message === "BAD_ROLE") return fail("Invalid role", 422);
    return handleApiError(e, "Failed to create admin");
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  roles: z.array(z.enum(ASSIGNABLE as [string, ...string[]])).min(1).optional(),
  status: z.enum(["APPROVED", "SUSPENDED"]).optional(),
  fullNameEn: z.string().min(1).max(120).optional(),
  fullNameGu: z.string().max(120).optional(),
  username: z.string().min(3).max(64).optional(),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Valid 10-digit mobile required")
    .optional(),
  /** Set only when changing / resetting. Leave omitted to keep current. */
  password: z.string().min(4).max(128).optional(),
  /** Shortcut: reset password to this value (default admin). */
  resetPassword: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const { communityId, session } = await requireAdmin(["OWNER"]);
    const raw = (await req.json()) as Record<string, unknown>;
    // Strip non-admin roles (e.g. MEMBER) before zod — they are kept separately in DB.
    if (Array.isArray(raw.roles)) {
      raw.roles = onlyAssignableRoles(raw.roles as string[]);
    }
    const body = updateSchema.parse(raw);
    const target = await prisma.user.findFirst({
      where: { id: body.id, communityId },
      include: { roles: { include: { role: true } }, profile: true },
    });
    if (!target) return fail("Admin not found", 404);

    const targetIsOwner = target.roles.some((r) => r.role.name === "OWNER");
    const removingOwner =
      (body.roles && !body.roles.includes("OWNER")) || body.status === "SUSPENDED";
    if (targetIsOwner && removingOwner) {
      const owners = await prisma.user.count({
        where: { communityId, status: "APPROVED", roles: { some: { role: { name: "OWNER" } } } },
      });
      if (owners <= 1) return fail("At least one active OWNER is required", 409);
    }

    if (body.username) {
      const taken = await prisma.user.findFirst({
        where: {
          communityId,
          username: body.username.trim().toLowerCase(),
          NOT: { id: target.id },
        },
      });
      if (taken) return fail("Username already taken", 409);
    }
    if (body.mobile) {
      const phoneTaken = await prisma.user.findFirst({
        where: { communityId, mobile: body.mobile, NOT: { id: target.id } },
      });
      if (phoneTaken) return fail("Mobile already used", 409);
    }

    if (body.roles) {
      const adminRoles = onlyAssignableRoles(body.roles);
      if (adminRoles.length === 0) return fail("Pick at least one admin role", 422);
      // Keep MEMBER so the person can still use the member site.
      const roleIds = await roleIdsByName([...adminRoles, "MEMBER"]);
      await prisma.userRole.deleteMany({ where: { userId: target.id } });
      await prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ roleId, userId: target.id })) });
    }

    const newPassword = body.resetPassword ? "admin" : body.password;
    const data: {
      status?: "APPROVED" | "SUSPENDED";
      passwordHash?: string;
      username?: string;
      mobile?: string;
    } = {};
    if (body.status) data.status = body.status;
    if (body.username) data.username = body.username.trim().toLowerCase();
    if (body.mobile) data.mobile = body.mobile;
    if (newPassword) data.passwordHash = await bcrypt.hash(newPassword, 10);
    if (Object.keys(data).length) await prisma.user.update({ where: { id: target.id }, data });

    if (body.fullNameEn !== undefined || body.fullNameGu !== undefined) {
      if (target.profile) {
        await prisma.profile.update({
          where: { userId: target.id },
          data: {
            ...(body.fullNameEn !== undefined ? { fullNameEn: body.fullNameEn.trim() } : {}),
            ...(body.fullNameGu !== undefined ? { fullNameGu: body.fullNameGu.trim() || null } : {}),
          },
        });
      } else if (body.fullNameEn?.trim()) {
        await prisma.profile.create({
          data: {
            userId: target.id,
            fullNameEn: body.fullNameEn.trim(),
            fullNameGu: body.fullNameGu?.trim() || null,
            isHead: true,
          },
        });
      }
    }

    void session;
    return ok({
      updated: true,
      ...(body.resetPassword ? { password: "admin" } : {}),
    });
  } catch (e) {
    if ((e as Error).message === "BAD_ROLE") return fail("Invalid role", 422);
    return handleApiError(e, "Failed to update admin");
  }
}

export async function DELETE(req: Request) {
  try {
    const { communityId, session } = await requireAdmin(["OWNER"]);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id is required");
    if (id === session.sub) return fail("You cannot remove your own admin account", 409);

    const target = await prisma.user.findFirst({
      where: { id, communityId },
      include: { roles: { include: { role: true } } },
    });
    if (!target) return fail("Admin not found", 404);

    if (target.roles.some((r) => r.role.name === "OWNER")) {
      const owners = await prisma.user.count({
        where: { communityId, roles: { some: { role: { name: "OWNER" } } } },
      });
      if (owners <= 1) return fail("At least one OWNER is required", 409);
    }

    await prisma.user.delete({ where: { id: target.id } });
    return ok({ deleted: true });
  } catch (e) {
    return handleApiError(e, "Failed to remove admin");
  }
}
