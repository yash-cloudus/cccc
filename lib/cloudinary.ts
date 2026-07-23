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

export { cloudinary };
