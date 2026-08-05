"use client";

/**
 * One definition of a screen's filters, rendered twice.
 *
 * Every admin list had the same shape hand-written: a search box, inline
 * selects for desktop, a `md:hidden` FilterButton, and a bottom Sheet that
 * repeated all the select definitions verbatim. Seven screens, two copies
 * each — so a new filter option had to be added in two places and drifted
 * whenever someone forgot.
 *
 * Pass the filters once; this renders the desktop row and the mobile sheet
 * from the same array, and owns the sheet's open state so callers no longer
 * carry a `filtersOpen` boolean of their own.
 */

import { useState } from "react";
import { AdminSelect, FilterButton, SearchInput } from "@/components/admin/admin-ui";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAdminT } from "@/lib/i18n/admin-dictionary";
import { cn } from "@/lib/utils";

export type AdminFilter = {
  /** Stable key — also the React key and the select's aria-label source. */
  key: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  /** Value that counts as "not filtering", used for the active dot. Default "all". */
  neutral?: string;
  /** Desktop width. Mobile is always full-width. */
  width?: string;
};

export function AdminFilterBar({
  search,
  filters = [],
  actions,
  className,
}: {
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  };
  filters?: AdminFilter[];
  /** Buttons pinned to the right on desktop, full-width below on mobile. */
  actions?: React.ReactNode;
  className?: string;
}) {
  const { t } = useAdminT();
  const [sheetOpen, setSheetOpen] = useState(false);
  const dirty = filters.some((f) => f.value !== (f.neutral ?? "all"));

  return (
    <div className={cn("flex flex-col gap-2.5 md:flex-row md:items-center", className)}>
      <div className="flex w-full min-w-0 items-center gap-2.5 md:w-auto md:flex-1">
        {search && (
          <SearchInput
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
            className="min-w-0 flex-1 md:w-[280px] md:flex-none"
          />
        )}
        {filters.length > 0 && (
          <FilterButton
            className="md:hidden"
            active={dirty}
            onClick={() => setSheetOpen(true)}
          />
        )}
        {/* Desktop: inline, same row as search. */}
        <div className="hidden items-center gap-2.5 md:flex">
          {filters.map((f) => (
            <AdminSelect
              key={f.key}
              value={f.value}
              onChange={f.onChange}
              ariaLabel={f.label}
              className={cn("shrink-0", f.width ?? "w-[160px]")}
              options={f.options}
            />
          ))}
        </div>
      </div>

      {actions && (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center md:ml-auto">
          {actions}
        </div>
      )}

      {/* Mobile: the same filters, stacked in a bottom sheet. */}
      {filters.length > 0 && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="md:hidden">
            <SheetHeader>
              <SheetTitle>{t("ui.filters")}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4 pb-6">
              {filters.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[var(--ink-mid)]">
                    {f.label}
                  </span>
                  <AdminSelect
                    value={f.value}
                    onChange={f.onChange}
                    ariaLabel={f.label}
                    className="w-full"
                    options={f.options}
                  />
                </label>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
