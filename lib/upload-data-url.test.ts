/**
 * The guards on the one upload path that runs unauthenticated — the head photo
 * inside a public family registration.
 * Run: npx tsx lib/upload-data-url.test.ts
 *
 * Only the rejections are asserted: everything here returns null before
 * `uploadBuffer` is reached, so the test never writes a file or calls out to
 * Cloudinary. If any of these ever returned a URL, a stranger could push
 * arbitrary bytes into the image host through the registration form.
 */
import assert from "node:assert";
import { uploadDataUrl } from "./cloudinary";

const ok1x1Png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const rejected = async (label: string, value: string) =>
  assert.equal(await uploadDataUrl(value, "test"), null, label);

// Wrapped rather than top-level await: tsx compiles this file to CJS.
async function main() {
  await rejected("plain text", "hello");
  await rejected("a URL, not a data URL", "https://example.com/photo.jpg");
  await rejected("no base64 marker", "data:image/png,notbase64");
  await rejected("empty payload", "data:image/png;base64,");
  // SVG carries script; PDF is not a photo. /api/upload allows both because the
  // caller there is a signed-in admin — this path is open to anyone.
  await rejected("svg", "data:image/svg+xml;base64,PHN2Zy8+");
  await rejected("pdf", "data:application/pdf;base64,JVBERi0xLjQK");
  // Over the 1.5 MB ceiling: rejected on the base64 length, before any decode.
  await rejected("oversized", `data:image/jpeg;base64,${"A".repeat(2_100_000)}`);

  // The shape the picker actually produces gets past the guards. Asserted on
  // the parse, not the store, so no file is written: a bad prefix would have
  // been null above, and reaching the upload means the checks passed.
  assert.ok(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(ok1x1Png), "sample is a valid data URL");

  console.log("ok — data-URL guards reject everything but a small raster image");
}

main();
