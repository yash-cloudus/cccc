import { ok, fail } from "@/lib/api";
import { getActiveCommunity } from "@/lib/tenant";

export async function GET() {
  const c = await getActiveCommunity();
  if (!c) return fail("No community", 404);
  return ok({
    community: {
      id: c.id,
      slug: c.slug,
      nameEn: c.nameEn,
      nameGu: c.nameGu,
      logoText: c.logoText,
      logoUrl: c.logoUrl,
      type: c.type,
      authMode: c.authMode,
      status: c.status,
      primaryColor: c.primaryColor,
      secondaryColor: c.secondaryColor,
      groupingLabel: c.groupingLabel,
    },
  });
}
