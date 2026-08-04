"use client";

import { AdminBtn } from "@/components/admin/admin-ui";
import { AdminModal } from "@/components/admin/admin-form";
import { useAdminT, type AdminKey } from "@/lib/i18n/admin-dictionary";
import { fmtDate, type AdminRow } from "./admin-roles";
import { menuKey } from "./admin-form-modal";
import { AvatarInitial } from "./avatar-initial";
import { phoneText } from "@/lib/format";
import { isValidNumber } from "@/lib/phone";

/**
 * Stored role → dictionary key. The labels in `admin-roles` are the English
 * source; the rendered text comes from here so both languages stay in sync.
 */
export const ROLE_KEY: Record<string, AdminKey> = {
  OWNER: "adm.roleOwner",
  DATA_MANAGER: "adm.roleDataManager",
  CONTENT_MANAGER: "adm.roleContentManager",
  MODERATOR: "adm.roleModerator",
  ADMIN: "adm.roleCommunityAdmin",
};

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
  const { t } = useAdminT();
  const active = row?.status === "APPROVED";
  const rows: [string, string][] = row
    ? [
        [t("adm.loginId"), row.username || "—"],
        [
          t("adm.mobile"),
          isValidNumber(row.mobile, row.mobileIso) ? phoneText(row.mobile, row.mobileIso) : "—",
        ],
        [t("adm.family"), row.family || "—"],
        [t("adm.surname"), row.surname || "—"],
        [t("adm.stepContact"), row.showPhone ? t("adm.on") : t("adm.off")],
        [t("adm.lastLogin"), row.lastLoginAt ? fmtDate(row.lastLoginAt) : t("adm.never")],
        [t("adm.created"), fmtDate(row.createdAt)],
      ]
    : [];

  return (
    <AdminModal
      open={row !== null}
      onClose={onClose}
      title={t("adm.adminDetails")}
      footer={
        row ? (
          <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => onEdit(row)}>
            {t("adm.editAdmin")}
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
                    {ROLE_KEY[r] ? t(ROLE_KEY[r]) : r}
                  </span>
                ))}
                <span
                  className={
                    active
                      ? "rounded-full bg-[var(--success-tint)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--success)]"
                      : "rounded-full bg-[var(--danger-tint)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--danger)]"
                  }
                >
                  {active ? t("adm.active") : t("adm.inactive")}
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
                    label === t("adm.loginId")
                      ? "font-mono text-[12.5px] font-semibold text-[var(--ink)]"
                      : "text-[12.5px] font-semibold text-[var(--ink)]"
                  }
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mb-1 text-[12.5px] font-bold text-[var(--faint)]">
            {t("adm.stepMenus")}
          </div>
          {row.menus.length === 0 ? (
            <p className="text-[12px] font-semibold text-[var(--faint)]">{t("adm.menusNotSet")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {row.menus.map((k) => (
                <span
                  key={k}
                  className="rounded-full bg-[#EEF1F6] px-2.5 py-1 text-[11.5px] font-bold text-[#4A5B72]"
                >
                  {t(menuKey(k))}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </AdminModal>
  );
}
