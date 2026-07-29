"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  AdminBtn,
  AdminH2,
  AdminHint,
  AdminTable,
  AdminTd,
  AdminTh,
  FilterChip,
  LinkAction,
  SearchInput,
} from "@/components/admin/admin-ui";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import {
  ROLE_TEMPLATES,
  fmtDate,
  matchesTemplate,
  roleLabel,
  type AdminRow,
  type MemberOption,
  type RoleTemplate,
} from "./admin-roles";
import { AdminFormModal, type AdminFormValues } from "./admin-form-modal";
import { AdminViewModal } from "./admin-view-modal";
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
    if (row.id === currentUserId) return "You cannot change your own account here.";
    if (row.status === "APPROVED" && activeCount <= 1) {
      return "This is the last active admin — promote another admin first.";
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
    if (!v.username.trim()) return setError("Login ID is required");
    if (v.username.trim().length < 3) return setError("Login ID must be at least 3 characters");
    if (v.roles.length === 0) return setError("Pick a role");
    if (v.password && v.password !== v.confirmPassword) {
      return setError("Password and confirm password do not match");
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
        title: `Deactivate ${row.name}?`,
        description: "They will no longer be able to sign in.",
        confirmLabel: "Deactivate",
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
      title: `Delete admin ${row.name}?`,
      confirmLabel: "Delete",
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
              <p>
                create login credentials and assign menu permissions. You cannot delete or
                deactivate your own account or the last active admin.
              </p>
              <p className="mt-2">
                Role filters follow the templates in the Add admin form. One person can hold
                multiple roles. Admins sign in with username &amp; password — <b>reset</b> sets a
                new one.
              </p>
            </>
          }
        >
          Admins &amp; roles
        </AdminH2>
        <AdminBtn onClick={openAdd}>
          <Plus className="size-4" />
          Add admin
        </AdminBtn>
      </div>
      <AdminHint className="mt-0 mb-4 max-w-3xl text-[12.5px]">
        <b>{activeCount}</b> active of <b>{rows.length}</b> admins
      </AdminHint>

      {error && !formOpen && !resetRow && (
        <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>
      )}

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search name, login ID or mobile…"
        className="mb-3 max-w-[360px]"
      />

      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-bold tracking-wide text-[var(--faint)] uppercase">
          Status
        </span>
        {(
          [
            { v: "all", l: "All" },
            { v: "active", l: "Active" },
            { v: "inactive", l: "Inactive" },
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
          Role
        </span>
        <FilterChip label="All" active={roleFilter === "all"} onClick={() => setRoleFilter("all")} />
        {ROLE_TEMPLATES.map((o) => (
          <FilterChip
            key={o.value}
            label={o.label}
            active={roleFilter === o.value}
            onClick={() => setRoleFilter(o.value)}
          />
        ))}
      </div>

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Admin</AdminTh>
            <AdminTh>Login ID</AdminTh>
            <AdminTh>Mobile</AdminTh>
            <AdminTh>Role</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh>Last login</AdminTh>
            <AdminTh>Created</AdminTh>
            <AdminTh className="text-right">Actions</AdminTh>
          </tr>
        </thead>
        <tbody>
          {visible.map((a) => (
            <tr key={a.id}>
              <AdminTd>
                <span className="flex items-center gap-2.5">
                  <AvatarInitial name={a.nameGu || a.name} />
                  <span className="min-w-0">
                    <b>{a.nameGu || a.name}</b>
                    {a.id === currentUserId && (
                      <span className="ml-1.5 rounded-full bg-[var(--brand-tint)] px-1.5 py-px text-[9.5px] font-extrabold tracking-wide text-[var(--brand)]">
                        YOU
                      </span>
                    )}
                  </span>
                </span>
              </AdminTd>
              <AdminTd className="font-mono text-[12px]">{a.username || "—"}</AdminTd>
              <AdminTd className="font-mono text-[12px]">
                {/^[6-9]\d{9}$/.test(a.mobile) ? a.mobile : "—"}
              </AdminTd>
              <AdminTd>
                {a.roles.map((r) => (
                  <span
                    key={r}
                    className={cn(
                      "mr-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                      r === "OWNER"
                        ? "bg-[var(--success-tint)] text-[var(--success)]"
                        : "bg-[#EEF1F6] text-[#4A5B72]",
                    )}
                  >
                    {roleLabel(r)}
                  </span>
                ))}
              </AdminTd>
              <AdminTd>
                <span
                  className={
                    a.status === "APPROVED" ? "text-[var(--success)]" : "text-[var(--danger)]"
                  }
                >
                  {a.status === "APPROVED" ? "Active" : "Inactive"}
                </span>
              </AdminTd>
              <AdminTd className="whitespace-nowrap">{fmtDate(a.lastLoginAt)}</AdminTd>
              <AdminTd className="whitespace-nowrap">{fmtDate(a.createdAt)}</AdminTd>
              <AdminTd className="text-right">
                {(() => {
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
                    <span className="flex flex-wrap justify-end gap-2">
                      <LinkAction onClick={() => setViewRow(a)}>view</LinkAction>
                      <LinkAction onClick={() => openEdit(a)}>edit</LinkAction>
                      <LinkAction onClick={() => setResetRow(a)}>reset</LinkAction>
                      {active ? (
                        guarded("deactivate", () => setStatus(a, "SUSPENDED"))
                      ) : (
                        <LinkAction onClick={() => setStatus(a, "APPROVED")}>activate</LinkAction>
                      )}
                      {guarded("delete", () => remove(a))}
                    </span>
                  );
                })()}
              </AdminTd>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <AdminTd colSpan={8} className="py-8 text-center text-[var(--faint)]">
                {rows.length === 0 ? "No admins yet." : "No admins match your filters."}
              </AdminTd>
            </tr>
          )}
        </tbody>
      </AdminTable>

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
