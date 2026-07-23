import Razorpay from "razorpay";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { created, fail, fromZod } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";

const schema = z.object({
  amount: z.number().positive(),
  purpose: z.string().min(2),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = schema.parse(await req.json());
    const amountPaise = Math.round(body.amount * 100);

    const payment = await prisma.payment.create({
      data: {
        userId: session.sub,
        amount: body.amount,
        purpose: body.purpose,
        status: "CREATED",
        meta: body.meta as object | undefined,
      },
    });

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return created({
        paymentId: payment.id,
        orderId: `order_demo_${payment.id}`,
        amount: amountPaise,
        currency: "INR",
        demo: true,
      });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: payment.id,
      notes: { purpose: body.purpose, userId: session.sub },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { razorpayOrderId: order.id, status: "PENDING" },
    });

    await prisma.paymentLog.create({
      data: { paymentId: payment.id, event: "order.created", payload: order as object },
    });

    return created({
      paymentId: payment.id,
      orderId: order.id,
      amount: amountPaise,
      currency: "INR",
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Failed to create order", 500);
  }
}
