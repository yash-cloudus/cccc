import { prisma } from "@/lib/prisma";
import { communitySettingOn, getCommunitySettingsMap } from "@/lib/community-settings";

/**
 * Fan out an in-app notification for a news post to every approved member.
 *
 * The Settings toggle is enforced here rather than at each call site, so both
 * the create and the update route obey it without repeating the check.
 */
export async function notifyNewsPost(
  news: {
    id: string;
    titleEn: string;
    titleGu: string | null;
    contentEn: string;
    contentGu: string | null;
  },
  communityId: string,
) {
  const settings = await getCommunitySettingsMap(communityId);
  if (!communitySettingOn(settings, "notifications", "newsPublished")) return;

  const notification = await prisma.notification.create({
    data: {
      titleEn: news.titleEn,
      titleGu: news.titleGu,
      bodyEn: news.contentEn.slice(0, 280),
      bodyGu: news.contentGu?.slice(0, 280),
      linkUrl: `/news/${news.id}`,
      channel: "IN_APP",
    },
  });
  const users = await prisma.user.findMany({
    where: { status: "APPROVED", communityId },
    select: { id: true },
  });
  if (users.length) {
    await prisma.notificationLog.createMany({
      data: users.map((u) => ({ notificationId: notification.id, userId: u.id })),
    });
  }
}

/**
 * Tell an ad's submitter their business listing or paid banner was decided on.
 *
 * A premium ad also carries a `businessId` (paying upgrades the business's own
 * ad row), so the wording keys off `type` — otherwise a rejected *payment*
 * would tell the member their whole business was rejected.
 */
export async function notifyAdDecision(
  ad: {
    name: string;
    ownerId: string | null;
    businessId: string | null;
    type: string;
  },
  communityId: string,
  decision: "APPROVED" | "REJECTED",
  rejectReason?: string | null,
  /**
   * True when a rejected premium ad's business was already approved/live —
   * only a paid banner upgrade was declined, so it must be reported as
   * banner-only, not as the business itself being rejected. False for a
   * premium ad on a business that was never approved — there the rejection
   * ends the business submission too.
   */
  businessWasLive = false,
) {
  if (!ad.ownerId) return;

  const settings = await getCommunitySettingsMap(communityId);
  if (!communitySettingOn(settings, "notifications", "adApproved")) return;

  const isBusiness =
    Boolean(ad.businessId) && (ad.type !== "premium" || (decision === "REJECTED" && !businessWasLive));

  const titleEn = isBusiness
    ? decision === "APPROVED"
      ? "Your business was approved"
      : "Your business was rejected"
    : decision === "APPROVED"
      ? "Your banner was approved"
      : "Your banner payment was rejected";
  const titleGu = isBusiness
    ? decision === "APPROVED"
      ? "તમારો ધંધો મંજૂર થયો"
      : "તમારો ધંધો નામંજૂર થયો"
    : decision === "APPROVED"
      ? "તમારું બેનર મંજૂર થયું"
      : "તમારા બેનરની ચૂકવણી નામંજૂર થઈ";

  const bodyEn = isBusiness
    ? decision === "APPROVED"
      ? `"${ad.name}" is now live in the business directory.`
      : `"${ad.name}" was rejected.${rejectReason ? ` Reason: ${rejectReason}` : ""}`
    : decision === "APPROVED"
      ? `"${ad.name}" is now running on the home screen.`
      : `The payment for "${ad.name}" was not accepted, so the banner did not start.${
          rejectReason ? ` Reason: ${rejectReason}` : ""
        } You can submit the payment again.`;
  const bodyGu = isBusiness
    ? decision === "APPROVED"
      ? `"${ad.name}" હવે ધંધા ડિરેક્ટરીમાં લાઇવ છે.`
      : `"${ad.name}" નામંજૂર થયું.${rejectReason ? ` કારણ: ${rejectReason}` : ""}`
    : decision === "APPROVED"
      ? `"${ad.name}" હવે હોમ સ્ક્રીન પર ચાલુ છે.`
      : `"${ad.name}" ની ચૂકવણી સ્વીકારાઈ નથી, તેથી બેનર શરૂ થયું નથી.${
          rejectReason ? ` કારણ: ${rejectReason}` : ""
        } તમે ફરીથી ચૂકવણી મોકલી શકો છો.`;

  await prisma.notification.create({
    data: {
      titleEn,
      titleGu,
      bodyEn,
      bodyGu,
      linkUrl: isBusiness ? "/business" : "/ads",
      channel: "IN_APP",
      logs: { create: { userId: ad.ownerId } },
    },
  });
}
