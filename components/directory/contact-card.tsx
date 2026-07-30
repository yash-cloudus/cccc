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

export const WaIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2.2A9.8 9.8 0 0 0 3.5 17L2.2 21.8l5-1.3A9.8 9.8 0 1 0 12 2.2Z" />
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
