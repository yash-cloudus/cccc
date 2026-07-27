"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import {
  AdminBtn,
  AdminH2,
  AdminHint,
  AdminInput,
  AdminLabel,
  AdminTable,
  AdminTd,
  AdminTh,
  FilterChip,
  LinkAction,
} from "@/components/admin/admin-ui";
import {
  AdminCheck,
  AdminChoiceChips,
  AdminField,
  AdminFormRow,
  AdminFormSection,
  AdminModal,
  AdminModalActions,
  AdminPasswordField,
  AdminSearchSelect,
  generatePassword,
} from "@/components/admin/admin-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/admin/confirm-dialog";

export type AdminRow = {
  id: string;
  name: string;
  nameGu: string | null;
  username: string | null;
  mobile: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
};

const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
    : "never";

/** Coloured square with the admin's first letter (Design-Spec AvatarInitial). */
function AvatarInitial({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--brand-tint)] text-[13px] font-extrabold text-[var(--brand)]">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

const ROLE_OPTIONS = [
  { value: "OWNER", label: "Owner" },
  { value: "DATA_MANAGER", label: "Data Manager" },
  { value: "CONTENT_MANAGER", label: "Content Manager" },
  { value: "MODERATOR", label: "Moderator" },
];

const roleLabel = (r: string) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;

/** Sidebar sections an admin can be granted — mirrors Admin.dc.html MENUS(). */
export const ADMIN_MENUS = [
  { key: "dash", label: "Dashboard" },
  { key: "queue", label: "Registration Queue" },
  { key: "families", label: "Families & Members" },
  { key: "drop", label: "Dropdown Lists" },
  { key: "gallery", label: "Gallery" },
  { key: "news", label: "News" },
  { key: "ads", label: "Advertisements" },
  { key: "info", label: "Community Information" },
  { key: "results", label: "Result Drive" },
  { key: "admins", label: "Admins & Roles" },
];

const ALL_MENUS = ADMIN_MENUS.map((m) => m.key);

type RoleTemplate =
  | "community_admin"
  | "coordinator_head"
  | "content_manager"
  | "gallery_manager"
  | "result_manager"
  | "owner"
  | "custom";

const ROLE_TEMPLATES: { value: RoleTemplate; label: string }[] = [
  { value: "community_admin", label: "Community Admin" },
  { value: "coordinator_head", label: "Head of Surname Group Coordinators" },
  { value: "content_manager", label: "Content Manager" },
  { value: "gallery_manager", label: "Gallery Manager" },
  { value: "result_manager", label: "Result Manager" },
  { value: "owner", label: "Owner" },
  { value: "custom", label: "Custom" },
];

/** Each template pre-fills the stored roles… */
const ROLE_TEMPLATE_ROLES: Record<RoleTemplate, string[]> = {
  community_admin: ["ADMIN"],
  coordinator_head: ["MODERATOR"],
  content_manager: ["CONTENT_MANAGER"],
  gallery_manager: ["CONTENT_MANAGER"],
  result_manager: ["DATA_MANAGER"],
  owner: ["OWNER"],
  custom: [],
};

/** …and the menus it can reach (Admin.dc.html rolePerms()). */
const ROLE_TEMPLATE_MENUS: Record<RoleTemplate, string[]> = {
  community_admin: ALL_MENUS,
  owner: ALL_MENUS,
  coordinator_head: ["queue", "families"],
  content_manager: ["dash", "news", "ads", "info"],
  gallery_manager: ["dash", "gallery"],
  result_manager: ["dash", "results"],
  custom: [],
};

export type MemberOption = { id: string; name: string; mobile: string; surname: string };

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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const activeCount = rows.filter((r) => r.status === "APPROVED").length;

  const visible = rows.filter((r) => {
    if (statusFilter === "active" && r.status !== "APPROVED") return false;
    if (statusFilter === "inactive" && r.status === "APPROVED") return false;
    if (roleFilter !== "all" && !r.roles.includes(roleFilter)) return false;
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

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    memberId: "",
    fullNameEn: "",
    fullNameGu: "",
    username: "",
    password: "admin",
    confirmPassword: "admin",
    mobile: "",
    roleTemplate: "community_admin" as RoleTemplate,
    roles: ROLE_TEMPLATE_ROLES.community_admin,
    menus: ROLE_TEMPLATE_MENUS.community_admin,
  });
  const [busy, setBusy] = useState(false);

  const [editRow, setEditRow] = useState<AdminRow | null>(null);
  const [editForm, setEditForm] = useState({
    fullNameEn: "",
    username: "",
    mobile: "",
    password: "",
    roles: [] as string[],
  });

  const toggle = (list: string[], role: string) =>
    list.includes(role) ? list.filter((r) => r !== role) : [...list, role];

  function openEdit(a: AdminRow) {
    setEditRow(a);
    setEditForm({
      fullNameEn: a.name,
      username: a.username || "",
      mobile: /^[6-9]\d{9}$/.test(a.mobile) ? a.mobile : "",
      password: "",
      roles: a.roles.filter((r) => ROLE_OPTIONS.some((o) => o.value === r)),
    });
    setError(null);
  }

  async function createAdmin() {
    if (!addForm.fullNameEn.trim() || !addForm.username.trim() || !addForm.password.trim()) {
      return setError("Name, login ID and password are required");
    }
    if (addForm.password !== addForm.confirmPassword) {
      return setError("Password and confirm password do not match");
    }
    if (addForm.roles.length === 0) return setError("Pick a role");
    setBusy(true);
    setError(null);
    const res = await api.post<{
      id: string;
      username: string;
      mobile: string;
      name: string;
      roles: string[];
    }>(`/api/admin/admins`, addForm);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setRows((prev) => [
      ...prev,
      {
        id: res.data.id,
        name: addForm.fullNameEn,
        nameGu: addForm.fullNameGu || null,
        username: addForm.username,
        mobile: res.data.mobile || addForm.mobile,
        status: "APPROVED",
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        roles: addForm.roles,
      },
    ]);
    setAddOpen(false);
    setAddForm({
      memberId: "",
      fullNameEn: "",
      fullNameGu: "",
      username: "",
      password: "admin",
      confirmPassword: "admin",
      mobile: "",
      roleTemplate: "community_admin",
      roles: ROLE_TEMPLATE_ROLES.community_admin,
      menus: ROLE_TEMPLATE_MENUS.community_admin,
    });
  }

  async function saveEdit() {
    if (!editRow) return;
    if (editForm.roles.length === 0) return setError("Pick at least one role");
    if (editForm.username.trim().length < 3) return setError("Username must be at least 3 characters");
    if (editForm.mobile && !/^[6-9]\d{9}$/.test(editForm.mobile))
      return setError("Enter a valid 10-digit mobile (starts with 6–9)");
    if (editForm.password && editForm.password.length < 4)
      return setError("New password must be at least 4 characters");

    setBusy(true);
    setError(null);
    const res = await api.patch(`/api/admin/admins`, {
      id: editRow.id,
      roles: editForm.roles.filter((r) => ROLE_OPTIONS.some((o) => o.value === r)),
      fullNameEn: editForm.fullNameEn.trim(),
      username: editForm.username.trim().toLowerCase(),
      ...(editForm.mobile ? { mobile: editForm.mobile } : {}),
      ...(editForm.password.trim() ? { password: editForm.password.trim() } : {}),
    });
    setBusy(false);
    if (!res.ok) {
      const detail = res.issues?.map((i) => i.message).filter(Boolean).join(" · ");
      return setError(detail || res.error);
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === editRow.id
          ? {
              ...r,
              name: editForm.fullNameEn.trim() || r.name,
              username: editForm.username.trim().toLowerCase(),
              mobile: editForm.mobile || r.mobile,
              roles: editForm.roles,
            }
          : r,
      ),
    );
    setEditRow(null);
    router.refresh();
  }

  async function resetPassword() {
    if (!editRow) return;
    const ok = await confirmDialog({
      title: `Reset password for ${editRow.name}?`,
      description: "Their password will be set back to “admin”.",
      confirmLabel: "Reset password",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    const res = await api.patch<{ updated: boolean; password?: string }>(`/api/admin/admins`, {
      id: editRow.id,
      resetPassword: true,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setEditForm((f) => ({ ...f, password: "" }));
    window.alert(`Password reset to: admin`);
  }

  async function remove(row: AdminRow) {
    const blocked = guardReason(row);
    if (blocked) return setError(blocked);
    const ok = await confirmDialog({
      title: `Remove admin ${row.name}?`,
      confirmLabel: "Remove",
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
        <AdminH2 className="mb-0">Admins &amp; roles</AdminH2>
        <AdminBtn
          onClick={() => {
            setAddOpen(true);
            setError(null);
          }}
        >
          <Plus className="size-4" />
          Add admin
        </AdminBtn>
      </div>
      <AdminHint className="mt-0 mb-4 max-w-3xl text-[12.5px]">
        <b>{activeCount}</b> active of <b>{rows.length}</b> admins · create login credentials and
        assign menu permissions. You cannot delete or deactivate your own account or the last
        active admin.
      </AdminHint>

      {error && !addOpen && !editRow && (
        <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>
      )}

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
        {ROLE_OPTIONS.map((o) => (
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
              <AdminTd>{a.username || "—"}</AdminTd>
              <AdminTd className="font-mono text-[12px]">
                {/^[6-9]\d{9}$/.test(a.mobile) ? a.mobile : "—"}
              </AdminTd>
              <AdminTd>
                {a.roles.map((r) => (
                  <span
                    key={r}
                    className={cn(
                      "mr-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                      r === "OWNER" ? "bg-[var(--success-tint)] text-[var(--success)]" : "bg-[#EEF1F6] text-[#4A5B72]",
                    )}
                  >
                    {roleLabel(r)}
                  </span>
                ))}
              </AdminTd>
              <AdminTd>
                <span className={a.status === "APPROVED" ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                  {a.status === "APPROVED" ? "Active" : a.status}
                </span>
              </AdminTd>
              <AdminTd className="whitespace-nowrap">{fmtDateTime(a.lastLoginAt)}</AdminTd>
              <AdminTd className="whitespace-nowrap">{fmtDateTime(a.createdAt)}</AdminTd>
              <AdminTd className="text-right">
                {(() => {
                  const blocked = guardReason(a);
                  return (
                    <span className="flex flex-wrap justify-end gap-2">
                      <LinkAction onClick={() => openEdit(a)}>edit</LinkAction>
                      {blocked ? (
                        <span
                          title={blocked}
                          className="cursor-not-allowed text-xs font-bold text-[var(--faint)]"
                        >
                          remove
                        </span>
                      ) : (
                        <LinkAction danger onClick={() => remove(a)}>
                          remove
                        </LinkAction>
                      )}
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

      <AdminHint>
        Roles: Owner · Data Manager · Content Manager · Moderator. One person can hold multiple.
        Admins sign in with username &amp; password. Use Edit → Reset password to set password back to{" "}
        <b>admin</b>.
      </AdminHint>

      <AdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add admin"
        subtitle="Everything for this admin — set up in one place."
        footer={
          <AdminModalActions
            onSave={createAdmin}
            onCancel={() => setAddOpen(false)}
            saveLabel="Create admin"
            busy={busy}
          />
        }
      >
        <AdminFormSection step={1} title="Member" />
        <AdminField hint="Pick an existing member, or type the name below to create a standalone admin.">
          <AdminSearchSelect
            items={members}
            value={members.find((m) => m.id === addForm.memberId) ?? null}
            placeholder="Search & select a member…"
            renderLabel={(m) => m.name}
            renderMeta={(m) => [m.mobile, m.surname].filter(Boolean).join(" · ")}
            emptyText="No member found"
            onChange={(m) =>
              setAddForm((f) => ({
                ...f,
                memberId: m?.id ?? "",
                fullNameEn: m?.name ?? f.fullNameEn,
                mobile: m?.mobile ?? f.mobile,
              }))
            }
          />
        </AdminField>

        <AdminFormRow>
          <AdminField label="Full name" required>
            <AdminInput
              value={addForm.fullNameEn}
              onChange={(v) => setAddForm({ ...addForm, fullNameEn: v })}
            />
          </AdminField>
          <AdminField label="Mobile">
            <AdminInput
              value={addForm.mobile}
              onChange={(v) => setAddForm({ ...addForm, mobile: v.replace(/\D/g, "").slice(0, 10) })}
            />
          </AdminField>
        </AdminFormRow>

        <AdminFormSection step={2} title="Login credentials" className="mt-5" />
        <AdminField label="Login ID" required>
          <AdminInput
            value={addForm.username}
            placeholder="e.g. community_admin_02"
            onChange={(v) => setAddForm({ ...addForm, username: v })}
          />
        </AdminField>
        <AdminFormRow>
          <AdminField label="Password" required>
            <AdminPasswordField
              value={addForm.password}
              onChange={(v) => setAddForm({ ...addForm, password: v })}
              onGenerate={() => {
                const pw = generatePassword();
                setAddForm((f) => ({ ...f, password: pw, confirmPassword: pw }));
              }}
            />
          </AdminField>
          <AdminField label="Confirm password" required>
            <AdminPasswordField
              value={addForm.confirmPassword}
              onChange={(v) => setAddForm({ ...addForm, confirmPassword: v })}
            />
          </AdminField>
        </AdminFormRow>

        <AdminFormSection step={3} title="Role (pre-fills permissions)" className="mt-5" />
        <AdminChoiceChips
          value={addForm.roleTemplate}
          onChange={(t) =>
            setAddForm((f) => ({
              ...f,
              roleTemplate: t,
              roles: ROLE_TEMPLATE_ROLES[t],
              // "Custom" keeps whatever is already ticked; templates overwrite.
              menus: t === "custom" ? f.menus : ROLE_TEMPLATE_MENUS[t],
            }))
          }
          options={ROLE_TEMPLATES}
        />

        <AdminFormSection step={4} title="Menu permissions" className="mt-5" />
        <div className="grid grid-cols-2 gap-1">
          {ADMIN_MENUS.map((m) => (
            <AdminCheck
              key={m.key}
              label={m.label}
              checked={addForm.menus.includes(m.key)}
              onChange={() =>
                setAddForm((f) => ({ ...f, menus: toggle(f.menus, m.key) }))
              }
            />
          ))}
        </div>

        {error && <p className="mt-3 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
      </AdminModal>

      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-[440px] rounded-2xl sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              Edit admin — {editRow?.name}
            </DialogTitle>
          </DialogHeader>
          <div>
            <AdminLabel>Name *</AdminLabel>
            <AdminInput
              value={editForm.fullNameEn}
              onChange={(v) => setEditForm({ ...editForm, fullNameEn: v })}
            />
            <AdminLabel>Mobile</AdminLabel>
            <AdminInput
              value={editForm.mobile}
              onChange={(v) => setEditForm({ ...editForm, mobile: v.replace(/\D/g, "").slice(0, 10) })}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <AdminLabel>Username *</AdminLabel>
                <AdminInput
                  value={editForm.username}
                  onChange={(v) => setEditForm({ ...editForm, username: v.toLowerCase().replace(/\s+/g, "_") })}
                />
              </div>
              <div>
                <AdminLabel>New password</AdminLabel>
                <AdminInput
                  value={editForm.password}
                  onChange={(v) => setEditForm({ ...editForm, password: v })}
                  placeholder="Leave blank to keep"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={resetPassword}
              className="mb-3 cursor-pointer text-[12.5px] font-bold text-[var(--brand)] underline"
            >
              Reset password to “admin”
            </button>
            <AdminLabel>Roles *</AdminLabel>
            <div className="mb-2 flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((r) => {
                const on = editForm.roles.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, roles: toggle(prev.roles, r.value) }))}
                    className={cn(
                      "cursor-pointer rounded-[11px] border-[1.5px] px-3 py-2 text-[12.5px] font-bold",
                      on ? "border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]" : "border-[var(--line-admin)] bg-white text-[var(--ink-dim)]",
                    )}
                  >
                    {on ? "☑" : "☐"} {r.label}
                  </button>
                );
              })}
            </div>
            {error && <p className="mt-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
            <div className="mt-4 flex gap-2.5">
              <AdminBtn className="flex-1 justify-center" onClick={saveEdit}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </AdminBtn>
              <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setEditRow(null)}>
                Cancel
              </AdminBtn>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
