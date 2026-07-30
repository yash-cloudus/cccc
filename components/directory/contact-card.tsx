"use client";

import { MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { telLink, waLink } from "@/lib/format";

/**
 * Shared building blocks for the business and advertisement detail screens —
 * both describe "an entity with a description, address and contact actions",
 * so they read from the same card/label/action styling rather than drifting
 * into two bespoke looks.
 */

export const WaIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 448 512" fill="currentColor" aria-hidden>
    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zM223.9 431.9c-33.5 0-65.5-8.9-93.5-25.7l-6.7-4-69.8 18.3L72 349.7l-4.4-7.1c-18.5-29.4-28.2-63.5-28.2-98.6 0-102.9 83.9-186.7 187-186.7 49.9 0 96.9 19.5 132.4 54.9 35.4 35.5 57.4 82.5 57.3 132.4 0 103-84.9 186.9-187.9 186.9zm101.2-138.4c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
  </svg>
);

/** Small brand-coloured heading inside a `samaj-card` section. */
export function DetailCardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[11.5px] font-extrabold tracking-wide text-[var(--brand)]">
      {children}
    </div>
  );
}

/** One `label · value` line in a contact card. */
export function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1 text-[13px] text-[var(--ink-soft)]">
      <b className="w-[72px] flex-none font-bold text-[var(--faint)]">{label}</b>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

/**
 * Call / WhatsApp / Map row — tinted pill buttons (brand-on-brand-tint,
 * success-on-success-tint) matching every other CTA row in the app, rather
 * than a solid colour fill that needs white text.
 */
export function ContactActionsRow({
  phone,
  whatsapp,
  mapHref,
  callLabel,
  waLabel,
  mapLabel,
}: {
  phone: string | null;
  whatsapp: string | null;
  mapHref: string | null;
  callLabel: string;
  waLabel: string;
  mapLabel: string;
}) {
  if (!phone && !mapHref) return null;

  return (
    <div className="flex gap-2">
      {phone && (
        <a href={telLink(phone)} className="samaj-btn flex flex-1 items-center justify-center gap-2 py-3.5 text-sm">
          <Phone className="h-4 w-4" /> {callLabel}
        </a>
      )}
      {phone && (
        <a
          href={waLink(whatsapp || phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="samaj-btn-wa flex flex-1 items-center justify-center gap-2 py-3.5 text-sm"
        >
          <WaIcon /> {waLabel}
        </a>
      )}
      {mapHref && (
        <a
          href={mapHref}
          target="_blank"
          rel="noreferrer"
          aria-label={mapLabel}
          title={mapLabel}
          className={cn(
            "samaj-btn-leaf flex items-center justify-center",
            phone ? "h-[52px] w-[52px] flex-none" : "h-12 flex-1 gap-2 text-sm",
          )}
        >
          <MapPin className={phone ? "h-5 w-5" : "h-4 w-4"} strokeWidth={2} />
          {!phone && mapLabel}
        </a>
      )}
    </div>
  );
}
