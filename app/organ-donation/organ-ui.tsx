"use client";

/** Small member-side primitives shared by the three Organ Donation tabs. */

import { cn } from "@/lib/utils";
import {
  DONATION_TYPES,
  ORGAN_TYPES,
  donationTypeLabel,
  organLabel,
  organStatusMeta,
  type OrganDonationType,
  type OrganStatus,
  type OrganType,
} from "@/lib/organ-donation";
import type { Lang } from "@/lib/i18n/dictionary";

export const FIELD =
  "w-full h-12 rounded-[13px] border-[1.5px] border-[#EDE4D4] bg-[#FCFAF6] px-3.5 text-[14px] font-semibold text-[var(--ink)] outline-none";

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 mb-1.5 text-[12px] font-bold text-[#8B8375]">{children}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-16 text-center text-[13.5px] text-[var(--faint)]">{children}</p>
  );
}

/** Filled pill used for both pledge status and request status. */
export function Pill({
  text,
  bg,
  fg,
  className,
}: {
  text: string;
  bg: string;
  fg: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex-none rounded-full px-[11px] py-1.5 text-[11px] font-extrabold whitespace-nowrap",
        className,
      )}
      style={{ background: bg, color: fg }}
    >
      {text}
    </span>
  );
}

export function OrganStatusPill({
  organ,
  status,
  lang,
}: {
  organ: OrganType;
  status: OrganStatus;
  lang: Lang;
}) {
  const meta = organStatusMeta(status, lang);
  return (
    <Pill text={`${organLabel(organ, lang)} · ${meta.label}`} bg={meta.bg} fg={meta.fg} />
  );
}

/** Multi-select organ checkboxes — the form's step 2 and the death checklist. */
export function OrganPicker({
  selected,
  onToggle,
  lang,
  organs,
  disabled,
}: {
  selected: Set<string>;
  onToggle: (organ: OrganType) => void;
  lang: Lang;
  organs: readonly OrganType[];
  disabled?: (organ: OrganType) => boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {organs.map((organ) => {
        const on = selected.has(organ);
        const off = disabled?.(organ) ?? false;
        return (
          <button
            key={organ}
            type="button"
            disabled={off}
            onClick={() => onToggle(organ)}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-[13px] border-[1.5px] px-3 py-3 text-left text-[13.5px] font-bold transition",
              on
                ? "border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]"
                : "border-[#EDE4D4] bg-[#FCFAF6] text-[var(--ink-dim)]",
              off && "pointer-events-none opacity-45",
            )}
          >
            <span
              className={cn(
                "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[6px] border-[1.5px] text-[11px] font-black",
                on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[#D9CFBB]",
              )}
            >
              {on ? "✓" : ""}
            </span>
            {organLabel(organ, lang)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The organ checklist where each ticked organ opens its own type selector.
 *
 * One row per organ rather than a two-column grid: a ticked row has to hold
 * three type buttons, and squeezing those into half a phone's width made them
 * unreadable. Untouched organs stay a plain checkbox, so the extra choice only
 * appears for organs actually committed to.
 *
 * `locked` organs (already donated / not-donated) render fixed and unclickable —
 * their type records what really happened and must not be rewritten after.
 */
export function OrganTypePicker({
  selected,
  onToggle,
  onSetType,
  lang,
  T,
  locked,
}: {
  selected: Map<OrganType, OrganDonationType>;
  onToggle: (organ: OrganType) => void;
  onSetType: (organ: OrganType, type: OrganDonationType) => void;
  lang: Lang;
  T: (gu: string, en: string) => string;
  locked?: Set<string>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {ORGAN_TYPES.map((organ) => {
        const type = selected.get(organ);
        const on = type !== undefined;
        const off = locked?.has(organ) ?? false;
        return (
          <div
            key={organ}
            className={cn(
              "rounded-[13px] border-[1.5px] transition",
              on ? "border-[var(--brand)] bg-[var(--brand-tint)]" : "border-[#EDE4D4] bg-[#FCFAF6]",
              off && "opacity-55",
            )}
          >
            <button
              type="button"
              disabled={off}
              onClick={() => onToggle(organ)}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-3 text-left text-[13.5px] font-bold",
                off ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[6px] border-[1.5px] text-[11px] font-black",
                  on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[#D9CFBB]",
                )}
              >
                {on ? "✓" : ""}
              </span>
              <span className={on ? "text-[var(--brand)]" : "text-[var(--ink-dim)]"}>
                {organLabel(organ, lang)}
              </span>
            </button>

            {on && (
              <div className="px-3 pb-3">
                <div className="mb-1.5 text-[11px] font-bold text-[#8B7A55]">
                  {T("ક્યારે આપી શકાય?", "When can it be given?")}
                </div>
                <div className="flex gap-1.5">
                  {DONATION_TYPES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={off}
                      onClick={() => onSetType(organ, v)}
                      className={cn(
                        "h-9 flex-1 rounded-[10px] border-[1.5px] text-[11.5px] font-extrabold transition",
                        off ? "cursor-not-allowed" : "cursor-pointer",
                        type === v
                          ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                          : "border-[#EDE4D4] bg-white text-[var(--ink-dim)]",
                      )}
                    >
                      {donationTypeLabel(v, lang)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Full-screen sheet used for donor detail, request and death-report forms. */
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(42,38,32,.5)] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[20px] bg-white shadow-[0_30px_60px_rgba(0,0,0,.34)] sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-none items-center justify-between border-b border-[#F1EBDE] px-5 py-4">
          <div className="text-[15.5px] font-extrabold text-[var(--ink)]">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#F6F1E8] text-[15px] font-bold text-[#8B8375]"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex-none border-t border-[#F1EBDE] px-5 py-3.5">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function PrimaryBtn({
  children,
  onClick,
  disabled,
  type = "button",
  tone = "brand",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  tone?: "brand" | "danger" | "ghost";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-12 w-full cursor-pointer rounded-[13px] text-[14.5px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-55",
        tone === "brand" && "bg-[var(--brand)] text-white",
        tone === "danger" && "bg-[var(--danger)] text-white",
        tone === "ghost" && "border-[1.5px] border-[#EDE4D4] bg-white text-[var(--ink-dim)]",
        className,
      )}
    >
      {children}
    </button>
  );
}
