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
  LinkAction,
} from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";

export type AdminRow = {
  id: string;
  name: string;
  nameGu: string | null;
  username: string | null;
  mobile: string;
  status: string;
  roles: string[];
};

const ROLE_OPTIONS = [
  { value: "OWNER", label: "Owner" },
  { value: "DATA_MANAGER", label: "Data Manager" },
  { value: "CONTENT_MANAGER", label: "Content Manager" },
  { value: "MODERATOR", label: "Moderator" },
];

const roleLabel = (r: string) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;

export function AdminsClient({ initialRows }: { initialRows: AdminRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<AdminRow[]>(initialRows);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    fullNameEn: "",
    fullNameGu: "",
    username: "",
    password: "admin",
    mobile: "",
    roles: ["MODERATOR"] as string[],
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
      return setError("Name, username and password are required");
    }
    if (addForm.roles.length === 0) return setError("Pick at least one role");
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
        roles: addForm.roles,
      },
    ]);
    setAddOpen(false);
    setAddForm({
      fullNameEn: "",
      fullNameGu: "",
      username: "",
      password: "admin",
      mobile: "",
      roles: ["MODERATOR"],
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
    if (!window.confirm(`Reset password for ${editRow.name} to “admin”?`)) return;
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
    if (!window.confirm(`Remove admin ${row.name}?`)) return;
    const res = await api.del(`/api/admin/admins?id=${row.id}`);
    if (!res.ok) return setError(res.error);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    router.refresh();
  }

  return (
    <>
      <AdminH2>Admins &amp; roles</AdminH2>
      <AdminBtn
        className="mb-4 inline-flex"
        onClick={() => {
          setAddOpen(true);
          setError(null);
        }}
      >
        <Plus className="size-4" />
        Add admin
      </AdminBtn>

      {error && !addOpen && !editRow && (
        <p className="mb-3 text-[13px] font-semibold text-[#B0303A]">{error}</p>
      )}

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Admin</AdminTh>
            <AdminTh>Username</AdminTh>
            <AdminTh>Mobile</AdminTh>
            <AdminTh>Roles</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh>Action</AdminTh>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <AdminTd>
                <b>{a.nameGu || a.name}</b>
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
                      r === "OWNER" ? "bg-[#E4F5E9] text-[#1E9E52]" : "bg-[#EEF1F6] text-[#4A5B72]",
                    )}
                  >
                    {roleLabel(r)}
                  </span>
                ))}
              </AdminTd>
              <AdminTd>
                <span className={a.status === "APPROVED" ? "text-[#1E9E52]" : "text-[#B0303A]"}>
                  {a.status === "APPROVED" ? "Active" : a.status}
                </span>
              </AdminTd>
              <AdminTd>
                <span className="flex flex-wrap gap-2">
                  <LinkAction onClick={() => openEdit(a)}>edit</LinkAction>
                  <LinkAction danger onClick={() => remove(a)}>
                    remove
                  </LinkAction>
                </span>
              </AdminTd>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      {rows.length === 0 && (
        <p className="py-6 text-center text-[11.5px] text-[#938C80]">No admins yet.</p>
      )}

      <AdminHint>
        Roles: Owner · Data Manager · Content Manager · Moderator. One person can hold multiple.
        Admins sign in with username &amp; password. Use Edit → Reset password to set password back to{" "}
        <b>admin</b>.
      </AdminHint>

      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="max-w-[420px] rounded-2xl sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#2A2620]">Add admin</DialogTitle>
          </DialogHeader>
          <div>
            <AdminLabel>Full name *</AdminLabel>
            <AdminInput value={addForm.fullNameEn} onChange={(v) => setAddForm({ ...addForm, fullNameEn: v })} />
            <AdminLabel>Mobile</AdminLabel>
            <AdminInput
              value={addForm.mobile}
              onChange={(v) => setAddForm({ ...addForm, mobile: v.replace(/\D/g, "").slice(0, 10) })}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <AdminLabel>Username *</AdminLabel>
                <AdminInput value={addForm.username} onChange={(v) => setAddForm({ ...addForm, username: v })} />
              </div>
              <div>
                <AdminLabel>Password *</AdminLabel>
                <AdminInput value={addForm.password} onChange={(v) => setAddForm({ ...addForm, password: v })} />
              </div>
            </div>
            <AdminLabel>Roles *</AdminLabel>
            <div className="mb-2 flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((r) => {
                const on = addForm.roles.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setAddForm({ ...addForm, roles: toggle(addForm.roles, r.value) })}
                    className={cn(
                      "cursor-pointer rounded-[11px] border-[1.5px] px-3 py-2 text-[12.5px] font-bold",
                      on ? "border-[#A62A38] bg-[#FBEBEC] text-[#A62A38]" : "border-[#E6E0D3] bg-white text-[#6B6357]",
                    )}
                  >
                    {on ? "☑" : "☐"} {r.label}
                  </button>
                );
              })}
            </div>
            {error && <p className="mt-2 text-[12.5px] font-semibold text-[#B0303A]">{error}</p>}
            <div className="mt-4 flex gap-2.5">
              <AdminBtn className="flex-1 justify-center" onClick={createAdmin}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Create admin"}
              </AdminBtn>
              <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setAddOpen(false)}>
                Cancel
              </AdminBtn>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-[440px] rounded-2xl sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#2A2620]">
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
              className="mb-3 cursor-pointer text-[12.5px] font-bold text-[#A62A38] underline"
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
                      on ? "border-[#A62A38] bg-[#FBEBEC] text-[#A62A38]" : "border-[#E6E0D3] bg-white text-[#6B6357]",
                    )}
                  >
                    {on ? "☑" : "☐"} {r.label}
                  </button>
                );
              })}
            </div>
            {error && <p className="mt-2 text-[12.5px] font-semibold text-[#B0303A]">{error}</p>}
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
