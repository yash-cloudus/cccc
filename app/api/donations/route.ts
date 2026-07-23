import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await requireSession();
    const items = await prisma.donation.findMany({
      where: { userId: session.sub },
      include: { payment: true },
      orderBy: { createdAt: "desc" },
    });
    return ok(items);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    return fail("Failed to list donations", 500);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = z
      .object({
        amount: z.number().positive(),
        note: z.string().optional(),
        paymentId: z.string().optional(),
      })
      .parse(await req.json());

    const donation = await prisma.donation.create({
      data: {
        userId: session.sub,
        amount: body.amount,
        note: body.note,
        paymentId: body.paymentId,
      },
    });
    return created(donation);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if (e instanceof z.ZodError) return fromZod(e);
    return fail("Failed to create donation", 500);
  }
}
