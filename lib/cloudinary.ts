import { v2 as cloudinary } from "cloudinary";
import { saveLocalUpload } from "@/lib/local-upload";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadBuffer(
  buffer: Buffer,
  folder = "community-app",
  resourceType: "image" | "raw" | "auto" = "auto",
  mimeType = "application/octet-stream",
) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return saveLocalUpload(buffer, folder, mimeType);
  }

  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => {
        if (err || !result) reject(err || new Error("Upload failed"));
        else resolve({ secure_url: result.secure_url, public_id: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

/** Decoded ceiling for a data-URL image, before base64 expansion. The picker
 *  hands over ~100 KB; anything near this is already something else. */
const MAX_DATA_URL_BYTES = 1_500_000;

const DATA_URL_TYPES: Record<string, true> = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
};

/**
 * Stores a browser-produced `data:image/…;base64,…` string, returning its URL.
 *
 * This is the one upload path that runs for a caller with no session — family
 * registration is a public form, so the photo rides inside the form body
 * instead of going through `/api/upload`. Everything it accepts is therefore
 * checked here: only real raster images, only small ones.
 *
 * Returns null instead of throwing. A photo that cannot be stored must never
 * cost a family the registration they just spent ten minutes filling in.
 */
export async function uploadDataUrl(
  dataUrl: string,
  folder = "community-app",
): Promise<string | null> {
  // [\s\S] rather than the `s` flag — tsconfig targets ES2017.
  const match = /^data:([\w/+.-]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!match) return null;

  const [, mimeType, b64] = match;
  if (!DATA_URL_TYPES[mimeType]) return null;
  // 4 base64 chars per 3 bytes — checked before decoding, so an oversized
  // string is never materialised as a Buffer.
  if ((b64.length * 3) / 4 > MAX_DATA_URL_BYTES) return null;

  try {
    const buffer = Buffer.from(b64, "base64");
    if (!buffer.length || buffer.length > MAX_DATA_URL_BYTES) return null;
    const result = await uploadBuffer(buffer, folder, "image", mimeType);
    return result.secure_url;
  } catch (e) {
    console.error("uploadDataUrl failed", e);
    return null;
  }
}

export { cloudinary };
