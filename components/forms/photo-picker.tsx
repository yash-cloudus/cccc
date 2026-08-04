"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Longest edge of the stored image. A directory avatar is never shown larger. */
const MAX_EDGE = 640;

/**
 * Shrinks a picked photo in the browser and hands back a JPEG data URL.
 *
 * Registration is a public form — the person filling it has no session, so it
 * cannot upload through `/api/upload`. The image travels inside the same
 * request as the rest of the form instead, which is why it has to be small:
 * a 4 MB phone photo becomes ~60 KB here, and the server never has to accept a
 * multi-megabyte body from an unauthenticated caller.
 */
async function toSmallDataUrl(file: File): Promise<string> {
  // <img> rather than createImageBitmap: same result, but it also works on the
  // older phones this community actually uses, and it honours the photo's EXIF
  // rotation, so a portrait shot does not arrive on its side.
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("unreadable image"));
      el.src = url;
    });

    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoPicker({
  value,
  onChange,
  label,
  hint,
  error,
  className,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFailed(null);
    try {
      onChange(await toSmallDataUrl(file));
    } catch {
      setFailed(label);
    } finally {
      setBusy(false);
      // Let the same file be picked again after a remove.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cn("flex items-center gap-3.5", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex size-[72px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-[1.5px] border-dashed",
          value
            ? "border-transparent"
            : "border-[var(--line-input)] bg-[var(--brand-tint)] text-[var(--brand)]",
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="size-full object-cover" />
        ) : (
          <Camera className="size-6" strokeWidth={1.9} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-[var(--ink)]">{label}</div>
        {hint ? (
          <div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--faint)]">{hint}</div>
        ) : null}
        <div className="mt-1.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer text-[12px] font-extrabold text-[var(--brand)]"
          >
            {value ? "બદલો · Change" : "ફોટો પસંદ કરો · Choose"}
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="flex cursor-pointer items-center gap-1 text-[12px] font-bold text-[var(--faint)]"
            >
              <X className="size-3.5" />
              કાઢી નાખો
            </button>
          ) : null}
        </div>
        {(error || failed) && (
          <div className="mt-1 text-[11.5px] font-semibold text-[var(--danger)]">
            {error || "ફોટો વાંચી શકાયો નહીં — બીજો પસંદ કરો"}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
