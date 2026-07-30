import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api";
import { requireAdmin, handleApiError } from "@/lib/admin-guard";

export async function GET() {
  try {
    const { communityId } = await requireAdmin();
    const [community, settings] = await Promise.all([
      prisma.community.findUnique({
        where: { id: communityId },
        select: {
          showDirectoryPhones: true,
          contactPhone: true,
          whatsapp: true,
          email: true,
          website: true,
          descEn: true,
          descGu: true,
          logoUrl: true,
          bannerUrl: true,
          primaryColor: true,
          secondaryColor: true,
          nameEn: true,
          nameGu: true,
          estd: true,
          village: true,
          addressEn: true,
          addressGu: true,
          taluka: true,
          district: true,
          state: true,
          country: true,
          pincode: true,
          mapUrl: true,
        },
      }),
      prisma.setting.findMany({ where: { communityId } }),
    ]);
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    return ok({ community, settings: map });
  } catch (e) {
    return handleApiError(e, "Failed to load settings");
  }
}

const schema = z.object({
  showDirectoryPhones: z.boolean().optional(),
  contactPhone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  descEn: z.string().optional(),
  descGu: z.string().optional(),
  // Branding images shown on the member app's Community Information screen.
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  // "Basic information" block of the Community info screen.
  nameEn: z.string().min(1).optional(),
  nameGu: z.string().optional(),
  estd: z.string().optional(),
  village: z.string().optional(),
  addressEn: z.string().optional(),
  addressGu: z.string().optional(),
  taluka: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.string().optional(),
  mapUrl: z.string().optional(),
  settings: z.record(z.string(), z.string()).optional(),
});

export async function PATCH(req: Request) {
  try {
    const { communityId } = await requireAdmin();
    const { settings, ...communityFields } = schema.parse(await req.json());

    if (Object.keys(communityFields).length > 0) {
      await prisma.community.update({ where: { id: communityId }, data: communityFields });
    }

    if (settings) {
      await Promise.all(
        Object.entries(settings).map(([key, value]) =>
          prisma.setting.upsert({
            where: { communityId_key: { communityId, key } },
            update: { value },
            create: { communityId, key, value },
          }),
        ),
      );
    }

    return ok({ saved: true });
  } catch (e) {
    return handleApiError(e, "Failed to save settings");
  }
}
