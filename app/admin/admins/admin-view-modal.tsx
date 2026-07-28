"use client";

import { AdminBtn } from "@/components/admin/admin-ui";
import { AdminModal } from "@/components/admin/admin-form";
import { fmtDate, menuLabel, roleLabel, type AdminRow } from "./admin-roles";
import { AvatarInitial } from "./avatar-initial";

/** Read-only "Admin details" sheet opened by the row's `view` action. */
export function AdminViewModal({
  row,
  onClose,
  onEdit,
}: {
  row: AdminRow | null;
  onClose: () => void;
  onEdit: (row: AdminRow) => void;
}) {
  const active = row?.status === "APPROVED";
  const rows: [string, string][] = row
    ? [
        ["Login ID", row.username || "—"],
        ["Mobile", /^[6-9]\d{9}$/.test(row.mobile) ? row.mobile : "—"],
        ["Family", row.family || "—"],
        ["Surname", row.surname || "—"],
        ["Contact visibility", row.showPhone ? "On" : "Off"],
        ["Last login", fmtDate(row.lastLoginAt)],
        ["Created", fmtDate(row.createdAt)],
      ]
    : [];

  return (
    <AdminModal
      open={row !== null}
      onClose={onClose}
      title="Admin details"
      footer={
        row ? (
          <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => onEdit(row)}>
            Edit admin
          </AdminBtn>
        ) : undefined
      }
    >
      {row && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <AvatarInitial
              name={row.nameGu || row.name}
              className="size-12 rounded-[16px] text-[19px]"
            />
            <div className="min-w-0">
              <div className="truncate text-[16px] font-extrabold text-[var(--ink)]">
                {row.nameGu || row.name}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {row.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-[var(--success-tint)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--success)]"
                  >
                    {roleLabel(r)}
                  </span>
                ))}
                <span
                  className={
                    active
                      ? "rounded-full bg-[var(--success-tint)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--success)]"
                      : "rounded-full bg-[var(--danger-tint)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--danger)]"
                  }
                >
                  {active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          <dl className="mb-4">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-[var(--line-admin)] py-2.5 last:border-b-0"
              >
                <dt className="text-[12.5px] font-semibold text-[var(--faint)]">{label}</dt>
                <dd
                  className={
                    label === "Login ID"
                      ? "font-mono text-[12.5px] font-semibold text-[var(--ink)]"
                      : "text-[12.5px] font-semibold text-[var(--ink)]"
                  }
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mb-1 text-[12.5px] font-bold text-[var(--faint)]">Menu permissions</div>
          {row.menus.length === 0 ? (
            <p className="text-[12px] font-semibold text-[var(--faint)]">
              Not set — this admin follows its role template.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {row.menus.map((k) => (
                <span
                  key={k}
                  className="rounded-full bg-[#EEF1F6] px-2.5 py-1 text-[11.5px] font-bold text-[#4A5B72]"
                >
                  {menuLabel(k)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </AdminModal>
  );
}
