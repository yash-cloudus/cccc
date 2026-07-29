"use client";

/**
 * The member app's dropdown — same interaction as the admin side's
 * `AdminSelect` (Base UI Select: floating list, brand-tint highlight,
 * checkmark on the selected row), styled to match the app's own field
 * chrome (`.samaj-fld`) instead of the admin's dense desktop inputs.
 */

import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "@/lib/utils";

export function AppSelect({
  value,
  onChange,
  options,
  placeholder = "—",
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const selected = options.find((o) => o.value === value);

  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          // Mirrors `.samaj-fld` (the app's shared field chrome) as plain
          // Tailwind utilities, not the CSS class itself — so a caller's
          // `className` (e.g. a page-local field style) can cleanly
          // override border/background via twMerge instead of fighting
          // globals.css's unlayered specificity.
          "flex min-h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-[13px] border-[1.5px] border-[var(--line-field)] bg-[var(--field)] px-3.5 py-3 text-left text-[14px] text-[var(--ink)] outline-none select-none",
          "transition-colors",
          "data-[popup-open]:border-[var(--brand)] data-[popup-open]:bg-white data-[popup-open]:shadow-[0_0_0_3px_rgb(var(--brand-rgb)/0.1)]",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} className="flex-1 truncate text-left">
          {selected?.label ?? placeholder}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon render={<span />}>
          <ChevronDown
            className="size-5 shrink-0 text-[var(--brand)] transition-transform duration-200 [[data-popup-open]_&]:rotate-180"
            strokeWidth={2.1}
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          sideOffset={4}
          alignItemWithTrigger={false}
          className="isolate z-[9999]"
        >
          <SelectPrimitive.Popup
            className={cn(
              "max-h-56 w-(--anchor-width) min-w-[140px] overflow-y-auto",
              "rounded-[14px] border border-[var(--line-soft)] bg-white shadow-[0_16px_34px_-10px_rgba(42,35,32,.4)]",
              "origin-(--transform-origin)",
              "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
              "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
              "transition-[opacity,transform] duration-150 ease-out",
            )}
          >
            <SelectPrimitive.ScrollUpArrow className="sticky top-0 z-10 flex w-full cursor-default justify-center bg-white/90 py-1 text-[var(--faint)]">
              <ChevronDown className="size-3.5 rotate-180" strokeWidth={2.5} />
            </SelectPrimitive.ScrollUpArrow>

            <SelectPrimitive.List className="p-1.5">
              {options.map((o) => (
                <SelectPrimitive.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className={cn(
                    "group relative flex cursor-pointer items-center gap-2 rounded-[10px] py-2.5 pr-8 pl-3 select-none",
                    "text-[13.5px] font-semibold text-[var(--ink)]",
                    "outline-none transition-colors",
                    "hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]",
                    "data-[highlighted]:bg-[var(--brand-tint)] data-[highlighted]:text-[var(--brand)]",
                    "data-[selected]:bg-[var(--brand-tint)] data-[selected]:font-bold data-[selected]:text-[var(--brand)]",
                    "data-[disabled]:cursor-not-allowed data-[disabled]:text-[var(--faint)] data-[disabled]:hover:bg-transparent data-[disabled]:hover:text-[var(--faint)]",
                  )}
                >
                  <SelectPrimitive.ItemText className="flex-1 truncate">
                    {o.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator
                    render={
                      <span className="pointer-events-none absolute right-2.5 flex size-4 items-center justify-center opacity-0 group-data-[selected]:opacity-100" />
                    }
                  >
                    <Check className="size-[13px] text-[var(--brand)]" strokeWidth={2.8} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>

            <SelectPrimitive.ScrollDownArrow className="sticky bottom-0 z-10 flex w-full cursor-default justify-center bg-white/90 py-1 text-[var(--faint)]">
              <ChevronDown className="size-3.5" strokeWidth={2.5} />
            </SelectPrimitive.ScrollDownArrow>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
