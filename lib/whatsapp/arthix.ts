/**
 * Per-community WhatsApp sending (ARTHIX).
 *
 * Credentials are per community, not per platform — one Gam's API key must
 * never send on another Parivar's behalf. They live encrypted in
 * `CommunityIntegration` and are decrypted here, server-side only. Nothing in
 * this file may be imported by a client component.
 */
import { prisma } from "@/lib/prisma";
import { tryDecryptSecret } from "@/lib/security/crypto";

/**
 * Flip to `true` in the same commit that fills in `postToArthix` below.
 *
 * Until the ARTHIX HTTP contract is known, every send fails and callers fall
 * back to what the app does today: the admin opens `wa.me` in a side tab and
 * presses send. That fallback is why this is one boolean and not a config
 * toggle — an admin must never be able to switch on a sender that cannot send.
 */
export const SENDER_IMPLEMENTED = false;

export type WaCredentials = {
  apiKey: string;
  firmId: string;
  senderMobile: string;
};

/** Decrypted credentials for one community, or null when not fully configured. */
export async function getWaCredentials(communityId: string): Promise<WaCredentials | null> {
  const row = await prisma.communityIntegration.findUnique({ where: { communityId } });
  if (!row) return null;

  const apiKey = tryDecryptSecret(row.waApiKeyEnc);
  const firmId = tryDecryptSecret(row.waFirmIdEnc);
  const senderMobile = row.waSenderMobile?.trim() || "";
  // Partial credentials are useless — treat them as absent rather than calling
  // the provider with a blank firm id. `tryDecrypt` returning null also covers
  // rows written under a previous ENCRYPTION_KEY.
  if (!apiKey || !firmId || !senderMobile) return null;

  return { apiKey, firmId, senderMobile };
}

/** Whether this community has everything needed to actually deliver a message. */
export async function canSendWhatsApp(communityId: string): Promise<boolean> {
  if (!SENDER_IMPLEMENTED) return false;
  return (await getWaCredentials(communityId)) !== null;
}

/**
 * The one function to fill in when the ARTHIX API contract is available:
 * endpoint URL, payload shape, and how it reports failure. Everything else —
 * storage, encryption, per-community lookup, the OTP branch, the automation
 * gate — is already wired to it.
 */
/* eslint-disable @typescript-eslint/no-unused-vars -- the parameters are the
   contract this stub will be filled in against; removing them would lose it. */
async function postToArthix(
  creds: WaCredentials,
  mobile: string,
  message: string,
): Promise<boolean> {
  // ponytail: stub until the provider contract is known. Returning false keeps
  // every caller on the existing manual `wa.me` side-tab path.
  return false;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Send one WhatsApp message on behalf of a community.
 *
 * Returns false — never throws — when the community cannot send. Callers treat
 * that as "fall back to the manual path", so a messaging outage can never take
 * down a login or an approval.
 */
export async function sendWhatsApp(
  communityId: string,
  mobile: string,
  message: string,
): Promise<boolean> {
  if (!SENDER_IMPLEMENTED) return false;
  const creds = await getWaCredentials(communityId);
  if (!creds) return false;

  const digits = (mobile || "").replace(/\D/g, "");
  if (digits.length < 10) return false;

  try {
    return await postToArthix(creds, digits, message);
  } catch (e) {
    console.error("WhatsApp send failed", e);
    return false;
  }
}
