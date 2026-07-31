"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  AdminBtn,
  AdminH2,
  AdminHint,
  FilterChip,
  LinkAction,
  SearchInput,
} from "@/components/admin/admin-ui";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import { useAdminT } from "@/lib/i18n/admin-dictionary";
import {
  ROLE_TEMPLATES,
  fmtDate,
  matchesTemplate,
  type AdminRow,
  type MemberOption,
  type RoleTemplate,
} from "./admin-roles";
import { AdminFormModal, TEMPLATE_KEY, type AdminFormValues } from "./admin-form-modal";
import { AdminViewModal, ROLE_KEY } from "./admin-view-modal";
import { AdminResetModal } from "./admin-reset-modal";
import { AvatarInitial } from "./avatar-initial";

export type { AdminRow, MemberOption } from "./admin-roles";

export function AdminsClient({
  initialRows,
  currentUserId,
  members = [],
}: {
  initialRows: AdminRow[];
  currentUserId: string | null;
  members?: MemberOption[];
}) {
  const router = useRouter();
  const { t, tf } = useAdminT();
  const roleText = (r: string) => (ROLE_KEY[r] ? t(ROLE_KEY[r]) : r);
  const [rows, setRows] = useState<AdminRow[]>(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState<RoleTemplate | "all">("all");
  const [query, setQuery] = useState("");

  /* One modal at a time: `formRow === null` in Add mode, a row in Edit mode. */
  const [formOpen, setFormOpen] = useState(false);
  const [formRow, setFormRow] = useState<AdminRow | null>(null);
  const [viewRow, setViewRow] = useState<AdminRow | null>(null);
  const [resetRow, setResetRow] = useState<AdminRow | null>(null);

  const activeCount = rows.filter((r) => r.status === "APPROVED").length;

  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (statusFilter === "active" && r.status !== "APPROVED") return false;
    if (statusFilter === "inactive" && r.status === "APPROVED") return false;
    if (roleFilter !== "all" && !matchesTemplate(r, roleFilter)) return false;
    if (q && ![r.name, r.nameGu, r.username, r.mobile].some((v) => v?.toLowerCase().includes(q))) {
      return false;
    }
    return true;
  });

  /**
   * Mirrors the prototype's guard: you cannot deactivate or delete your own
   * account, nor the last remaining active admin — that would lock everyone out.
   */
  function guardReason(row: AdminRow): string | null {
    if (row.id === currentUserId) return t("adm.guardSelf");
    if (row.status === "APPROVED" && activeCount <= 1) {
      return t("adm.guardLast");
    }
    return null;
  }

  function openAdd() {
    setFormRow(null);
    setFormOpen(true);
    setError(null);
  }

  function openEdit(row: AdminRow) {
    setViewRow(null);
    setFormRow(row);
    setFormOpen(true);
    setError(null);
  }

  async function submitForm(v: AdminFormValues) {
    if (!v.username.trim()) return setError(t("adm.errLoginIdRequired"));
    if (v.username.trim().length < 3) return setError(t("adm.errLoginIdShort"));
    if (v.roles.length === 0) return setError(t("adm.errPickRole"));
    if (v.password && v.password !== v.confirmPassword) {
      return setError(t("adm.errPwMismatch"));
    }
    setBusy(true);
    setError(null);
    const res = formRow
      ? await api.patch(`/api/admin/admins`, {
          id: formRow.id,
          roles: v.roles,
          menus: v.menus,
          showPhone: v.showPhone,
          username: v.username.trim().toLowerCase(),
          ...(v.password.trim() ? { password: v.password.trim() } : {}),
        })
      : await api.post<{ id: string; mobile: string }>(`/api/admin/admins`, {
          memberId: v.memberId || undefined,
          fullNameEn: v.fullNameEn.trim(),
          fullNameGu: v.fullNameGu.trim() || undefined,
          mobile: v.mobile,
          username: v.username.trim().toLowerCase(),
          password: v.password,
          roles: v.roles,
          menus: v.menus,
          showPhone: v.showPhone,
        });
    setBusy(false);
    if (!res.ok) {
      const detail = res.issues?.map((i) => i.message).filter(Boolean).join(" · ");
      return setError(detail || res.error);
    }
    setFormOpen(false);
    router.refresh();
  }

  async function resetPassword(password: string) {
    if (!resetRow) return;
    setBusy(true);
    setError(null);
    const res = await api.patch(`/api/admin/admins`, { id: resetRow.id, password });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setResetRow(null);
  }

  /** Suspending is what locks someone out, so only that direction is guarded. */
  async function setStatus(row: AdminRow, next: "APPROVED" | "SUSPENDED") {
    if (next === "SUSPENDED") {
      const blocked = guardReason(row);
      if (blocked) return setError(blocked);
      const ok = await confirmDialog({
        title: tf("adm.confirmDeactivateTitle", { name: row.name }),
        description: t("adm.confirmDeactivateDesc"),
        confirmLabel: t("adm.deactivate"),
        tone: "danger",
      });
      if (!ok) return;
    }
    setError(null);
    const res = await api.patch(`/api/admin/admins`, { id: row.id, status: next });
    if (!res.ok) return setError(res.error);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    router.refresh();
  }

  async function remove(row: AdminRow) {
    const blocked = guardReason(row);
    if (blocked) return setError(blocked);
    const ok = await confirmDialog({
      title: tf("adm.confirmDeleteTitle", { name: row.name }),
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    const res = await api.del(`/api/admin/admins?id=${row.id}`);
    if (!res.ok) return setError(res.error);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    router.refresh();
  }

  return (
    <>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <AdminH2
          className="mb-0"
          info={
            <>
              <p>{t("adm.info1")}</p>
              <p className="mt-2">
                {t("adm.info2")}
                <b>{t("adm.reset")}</b>
                {t("adm.info2End")}
              </p>
            </>
          }
        >
          {t("nav.admins")}
        </AdminH2>
        <AdminBtn onClick={openAdd}>
          <Plus className="size-4" />
          {t("adm.addAdmin")}
        </AdminBtn>
      </div>
      <AdminHint className="mt-0 mb-4 max-w-3xl text-[12.5px]">
        {tf("adm.activeCount", { active: activeCount, total: rows.length })}
      </AdminHint>

      {error && !formOpen && !resetRow && (
        <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>
      )}

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={t("adm.searchPlaceholder")}
        className="mb-3 max-w-[360px]"
      />

      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-bold tracking-wide text-[var(--faint)] uppercase">
          {t("adm.status")}
        </span>
        {(
          [
            { v: "all", l: t("adm.filterAll") },
            { v: "active", l: t("adm.active") },
            { v: "inactive", l: t("adm.inactive") },
          ] as const
        ).map((c) => (
          <FilterChip
            key={c.v}
            label={c.l}
            active={statusFilter === c.v}
            onClick={() => setStatusFilter(c.v)}
          />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-bold tracking-wide text-[var(--faint)] uppercase">
          {t("adm.role")}
        </span>
        <FilterChip
          label={t("adm.filterAll")}
          active={roleFilter === "all"}
          onClick={() => setRoleFilter("all")}
        />
        {ROLE_TEMPLATES.map((o) => (
          <FilterChip
            key={o.value}
            label={t(TEMPLATE_KEY[o.value])}
            active={roleFilter === o.value}
            onClick={() => setRoleFilter(o.value)}
          />
        ))}
      </div>

      <AdminDataTable
        rows={visible}
        rowKey={(a) => a.id}
        empty={
          <p className="py-8 text-center text-[13px] text-[var(--faint)]">
            {rows.length === 0 ? t("adm.emptyNone") : t("adm.emptyFiltered")}
          </p>
        }
        columns={[
          {
            key: "admin",
            header: t("adm.colAdmin"),
            primary: true,
            cell: (a) => (
              <span className="flex items-center gap-2.5">
                <AvatarInitial name={a.nameGu || a.name} />
                <span className="min-w-0">
                  <b>{a.nameGu || a.name}</b>
                  {a.id === currentUserId && (
                    <span className="ml-1.5 rounded-full bg-[var(--brand-tint)] px-1.5 py-px text-[9.5px] font-extrabold tracking-wide text-[var(--brand)]">
                      {t("adm.you")}
                    </span>
                  )}
                </span>
              </span>
            ),
          },
          {
            key: "username",
            header: t("adm.loginId"),
            tdClassName: "font-mono text-[12px]",
            cell: (a) => a.username || "—",
          },
          {
            key: "mobile",
            header: t("adm.mobile"),
            tdClassName: "font-mono text-[12px]",
            cell: (a) => (/^[6-9]\d{9}$/.test(a.mobile) ? a.mobile : "—"),
          },
          {
            key: "roles",
            header: t("adm.role"),
            cell: (a) =>
              a.roles.map((r) => (
                <span
                  key={r}
                  className={cn(
                    "mr-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                    r === "OWNER"
                      ? "bg-[var(--success-tint)] text-[var(--success)]"
                      : "bg-[#EEF1F6] text-[#4A5B72]",
                  )}
                >
                  {roleText(r)}
                </span>
              )),
          },
          {
            key: "status",
            header: t("adm.status"),
            badge: true,
            cell: (a) => (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                  a.status === "APPROVED"
                    ? "bg-[var(--success-tint)] text-[var(--success)]"
                    : "bg-[var(--danger-tint-soft)] text-[var(--danger)]",
                )}
              >
                {a.status === "APPROVED" ? t("adm.active") : t("adm.inactive")}
              </span>
            ),
          },
          {
            key: "lastLogin",
            header: t("adm.lastLogin"),
            tdClassName: "whitespace-nowrap",
            cell: (a) => (a.lastLoginAt ? fmtDate(a.lastLoginAt) : t("adm.never")),
          },
          {
            key: "created",
            header: t("adm.created"),
            tdClassName: "whitespace-nowrap",
            cell: (a) => fmtDate(a.createdAt),
          },
          {
            key: "actions",
            header: t("adm.actions"),
            actions: true,
            cell: (a) => {
              const blocked = guardReason(a);
              const active = a.status === "APPROVED";
              // Deactivate and delete are the destructive pair the guard covers;
              // view / edit / reset stay available on every row.
              const guarded = (label: string, run: () => void) =>
                blocked ? (
                  <span
                    title={blocked}
                    className="cursor-not-allowed text-xs font-bold text-[var(--faint)]"
                  >
                    {label}
                  </span>
                ) : (
                  <LinkAction danger onClick={run}>
                    {label}
                  </LinkAction>
                );
              return (
                <span className="flex flex-wrap gap-2 md:justify-end">
                  <LinkAction onClick={() => setViewRow(a)}>{t("common.view")}</LinkAction>
                  <LinkAction onClick={() => openEdit(a)}>{t("common.edit")}</LinkAction>
                  <LinkAction onClick={() => setResetRow(a)}>{t("adm.reset")}</LinkAction>
                  {active ? (
                    guarded(t("adm.deactivate"), () => setStatus(a, "SUSPENDED"))
                  ) : (
                    <LinkAction onClick={() => setStatus(a, "APPROVED")}>
                      {t("adm.activate")}
                    </LinkAction>
                  )}
                  {guarded(t("common.delete"), () => remove(a))}
                </span>
              );
            },
          },
        ]}
      />

      <AdminFormModal
        open={formOpen}
        row={formRow}
        members={members}
        busy={busy}
        error={formOpen ? error : null}
        onClose={() => setFormOpen(false)}
        onSubmit={submitForm}
      />

      <AdminViewModal row={viewRow} onClose={() => setViewRow(null)} onEdit={openEdit} />

      <AdminResetModal
        row={resetRow}
        busy={busy}
        error={resetRow ? error : null}
        onClose={() => setResetRow(null)}
        onSubmit={resetPassword}
      />
    </>
  );
}
