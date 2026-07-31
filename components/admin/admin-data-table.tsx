"use client";

/**
 * One column definition, two layouts.
 *
 * Admin lists were hand-written `<table>` markup wrapped in `overflow-x-auto`,
 * so on a phone every screen became a sideways-scrolling table — readable only
 * by dragging, with action buttons parked off the right edge. Describe the
 * columns once here and the same data renders as a table on desktop and as
 * cards on mobile, so neither layout can drift from the other.
 *
 * Column roles drive the card:
 *   primary  → the card's heading
 *   badge    → sits top-right next to the heading (status pills)
 *   actions  → pinned to the card footer, full-width touch targets
 *   others   → label / value rows, unless `desktopOnly`
 */

import { AdminTable, AdminTd, AdminTh } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

export type AdminColumn<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** The card heading. Exactly one column should set this. */
  primary?: boolean;
  /** Rendered beside the card heading rather than as a label/value row. */
  badge?: boolean;
  /** Rendered in the card footer, and right-aligned in the table. */
  actions?: boolean;
  /** Kept out of the card — noise on a small screen. */
  desktopOnly?: boolean;
  thClassName?: string;
  tdClassName?: string;
};

export function AdminDataTable<T>({
  rows,
  columns,
  rowKey,
  empty,
  className,
}: {
  rows: T[];
  columns: AdminColumn<T>[];
  rowKey: (row: T, index: number) => string;
  /** Shown in place of both layouts when there is nothing to list. */
  empty?: React.ReactNode;
  className?: string;
}) {
  if (rows.length === 0 && empty) {
    return <div className={className}>{empty}</div>;
  }

  const primary = columns.find((c) => c.primary);
  const badges = columns.filter((c) => c.badge);
  const actions = columns.filter((c) => c.actions);
  const details = columns.filter(
    (c) => !c.primary && !c.badge && !c.actions && !c.desktopOnly,
  );

  return (
    <>
      {/* ── Desktop ── */}
      <AdminTable className={cn("hidden md:block", className)}>
        <thead>
          <tr>
            {columns.map((c) => (
              <AdminTh
                key={c.key}
                className={cn(c.actions && "text-right", c.thClassName)}
              >
                {c.header}
              </AdminTh>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)}>
              {columns.map((c) => (
                <AdminTd
                  key={c.key}
                  className={cn(c.actions && "text-right", c.tdClassName)}
                >
                  {c.cell(row)}
                </AdminTd>
              ))}
            </tr>
          ))}
        </tbody>
      </AdminTable>

      {/* ── Mobile ── */}
      <div className={cn("flex flex-col gap-2.5 md:hidden", className)}>
        {rows.map((row, i) => (
          <div
            key={rowKey(row, i)}
            className="rounded-[14px] border border-[var(--line-admin)] bg-white p-3.5 shadow-[0_1px_2px_rgba(30,25,40,.04)]"
          >
            {(primary || badges.length > 0) && (
              <div className="flex items-start justify-between gap-3">
                {primary && (
                  <div className="min-w-0 flex-1 text-[14.5px] font-extrabold text-[var(--ink)]">
                    {primary.cell(row)}
                  </div>
                )}
                {badges.length > 0 && (
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {badges.map((c) => (
                      <span key={c.key}>{c.cell(row)}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {details.length > 0 && (
              <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 border-t border-[var(--line-soft)] pt-2.5">
                {details.map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-[11.5px] font-extrabold tracking-wide text-[var(--ink-mid)] uppercase">
                      {c.header}
                    </dt>
                    <dd className="min-w-0 text-right text-[13px] font-medium text-[var(--ink-soft)]">
                      {c.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {actions.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line-soft)] pt-3">
                {actions.map((c) => (
                  <div key={c.key} className="flex flex-wrap items-center gap-2">
                    {c.cell(row)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
