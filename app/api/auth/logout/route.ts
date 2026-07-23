import { clearAuthCookies } from "@/lib/auth/cookies";
import { ok } from "@/lib/api";

export async function POST() {
  await clearAuthCookies();
  return ok({ loggedOut: true });
}
