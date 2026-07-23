import { fail, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { uploadBuffer } from "@/lib/cloudinary";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
]);

export async function POST(req: Request) {
  try {
    await requireSession();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("file is required");

    const max = Number(process.env.UPLOAD_MAX_BYTES || 5_242_880);
    if (file.size > max) return fail("File too large", 413);
    if (!ALLOWED.has(file.type)) return fail("Unsupported file type (use PNG, JPG, WEBP, or SVG)", 415);

    const buffer = Buffer.from(await file.arrayBuffer());
    const folder = String(form.get("folder") || "community-app");
    const result = await uploadBuffer(
      buffer,
      folder,
      file.type === "application/pdf" ? "raw" : "image",
      file.type,
    );

    return ok({
      url: result.secure_url,
      publicId: result.public_id,
      type: file.type,
      size: file.size,
    });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return fail("Unauthorized", 401);
    console.error(e);
    return fail("Upload failed", 500);
  }
}
