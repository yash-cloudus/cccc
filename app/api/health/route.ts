import { ok } from "@/lib/api";

export async function GET() {
  return ok({ status: "ok", service: "community-app", time: new Date().toISOString() });
}
