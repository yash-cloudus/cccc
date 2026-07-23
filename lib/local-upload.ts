import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

function safeFolder(folder: string) {
  return folder.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "misc";
}

/**
 * Store an upload under public/uploads/{folder}/ and return a public URL path.
 * Used when Cloudinary is not configured (local / XAMPP-style dev).
 */
export async function saveLocalUpload(
  buffer: Buffer,
  folder: string,
  mimeType: string,
): Promise<{ secure_url: string; public_id: string }> {
  const dirName = safeFolder(folder);
  const ext = EXT_BY_MIME[mimeType] || "bin";
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const fileName = `${id}.${ext}`;
  const absDir = path.join(process.cwd(), "public", "uploads", dirName);
  await mkdir(absDir, { recursive: true });
  await writeFile(path.join(absDir, fileName), buffer);
  return {
    secure_url: `/uploads/${dirName}/${fileName}`,
    public_id: `local/${dirName}/${fileName}`,
  };
}
