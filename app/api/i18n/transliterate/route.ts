import { z } from "zod";
import { fail, fromZod, ok } from "@/lib/api";
import {
  hasGujarati,
  hasLatin,
  translitEnToGuLocal,
  translitGuToEnLocal,
} from "@/lib/gujarati-translit";

export const dynamic = "force-dynamic";

/**
 * Bidirectional name conversion for admin forms.
 *
 * EN → GU: Google Input Tools (phonetic transliteration) — best for names like
 *          "Mota Zinzuda Samaj" → "મોટા ઝીંઝુડા સમાજ"
 * GU → EN: Google Translate free endpoint — good for Gujarati script → English
 *
 * Both fall back to local dictionary + rule engine when online APIs fail.
 */
const schema = z.object({
  text: z.string().max(5000),
  /** Direction: en2gu | gu2en (auto-detected if omitted) */
  direction: z.enum(["en2gu", "gu2en"]).optional(),
});

async function googleInputToolsGu(word: string): Promise<string | null> {
  const url =
    "https://inputtools.google.com/request?text=" +
    encodeURIComponent(word) +
    "&itc=gu-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8";
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  // Shape: ["SUCCESS", [[word, [suggestion, ...], ...], ...]]
  if (!Array.isArray(data) || data[0] !== "SUCCESS") return null;
  const row = data[1]?.[0];
  const suggestion = row?.[1]?.[0];
  return typeof suggestion === "string" && suggestion ? suggestion : null;
}

async function googleTranslate(text: string, sl: string, tl: string): Promise<string | null> {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
    sl +
    "&tl=" +
    tl +
    "&dt=t&q=" +
    encodeURIComponent(text);
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  // Shape: [[["translated","source",...],...], ...]
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const parts = (data[0] as unknown[])
    .map((chunk) => (Array.isArray(chunk) && typeof chunk[0] === "string" ? chunk[0] : ""))
    .join("");
  return parts.trim() || null;
}

async function enToGu(text: string): Promise<{ result: string; source: string }> {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (!words.length) return { result: "", source: "empty" };

  // Longer prose → Translate; short names → phonetic Input Tools
  if (trimmed.length > 60 || words.length > 6) {
    try {
      const online = await googleTranslate(trimmed, "en", "gu");
      if (online) return { result: online, source: "google-translate" };
    } catch {
      /* fall through to phonetic */
    }
  }

  try {
    const parts = await Promise.all(
      words.map(async (w) => {
        try {
          const online = await googleInputToolsGu(w);
          return online || translitEnToGuLocal(w);
        } catch {
          return translitEnToGuLocal(w);
        }
      }),
    );
    return { result: parts.join(" "), source: "google-inputtools+local" };
  } catch {
    return { result: translitEnToGuLocal(trimmed), source: "local" };
  }
}

async function guToEn(text: string): Promise<{ result: string; source: string }> {
  try {
    const online = await googleTranslate(text, "gu", "en");
    if (online) return { result: online, source: "google-translate" };
  } catch {
    /* fall through */
  }
  return { result: translitGuToEnLocal(text), source: "local" };
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const text = body.text.trim();
    if (!text) return ok({ result: "", source: "empty", direction: "en2gu" });

    let direction = body.direction;
    if (!direction) {
      if (hasGujarati(text) && !hasLatin(text)) direction = "gu2en";
      else direction = "en2gu";
    }

    const out = direction === "gu2en" ? await guToEn(text) : await enToGu(text);
    return ok({ ...out, direction });
  } catch (e) {
    if (e instanceof z.ZodError) return fromZod(e);
    console.error(e);
    return fail("Transliteration failed", 500);
  }
}
