"use client";

import { useEffect, useState } from "react";
import { AdminInput, AdminToggle } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";
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
import {
  ADMIN_MENUS,
  ALL_MENUS,
  ROLE_TEMPLATES,
  ROLE_TEMPLATE_MENUS,
  ROLE_TEMPLATE_ROLES,
  menuLabel,
  templateOf,
  type AdminRow,
  type MemberOption,
  type RoleTemplate,
} from "./admin-roles";
import { AvatarInitial } from "./avatar-initial";

/** Everything the Add / Edit modal collects. */
export type AdminFormValues = {
  memberId: string;
  fullNameEn: string;
  fullNameGu: string;
  mobile: string;
  family: string;
  surname: string;
  username: string;
  password: string;
  confirmPassword: string;
  roleTemplate: RoleTemplate;
  roles: string[];
  menus: string[];
  showPhone: boolean;
};

const blank = (): AdminFormValues => ({
  memberId: "",
  fullNameEn: "",
  fullNameGu: "",
  mobile: "",
  family: "",
  surname: "",
  username: "",
  password: "admin",
  confirmPassword: "admin",
  roleTemplate: "community_admin",
  roles: ROLE_TEMPLATE_ROLES.community_admin,
  menus: ROLE_TEMPLATE_MENUS.community_admin,
  showPhone: true,
});

/** Prefill from an existing admin; password stays empty = keep current. */
const fromRow = (row: AdminRow): AdminFormValues => {
  const template = templateOf(row);
  return {
    memberId: "",
    fullNameEn: row.name,
    fullNameGu: row.nameGu ?? "",
    mobile: /^[6-9]\d{9}$/.test(row.mobile) ? row.mobile : "",
    family: row.family ?? "",
    surname: row.surname ?? "",
    username: row.username ?? "",
    password: "",
    confirmPassword: "",
    roleTemplate: template,
    roles: row.roles,
    menus: row.menus.length ? row.menus : ROLE_TEMPLATE_MENUS[template],
    showPhone: row.showPhone,
  };
};

const toggle = (list: string[], key: string) =>
  list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

/**
 * The Add admin / Edit admin form. Both modals are the same five steps, so
 * they are one component — `row` decides prefill, labels and which validation
 * applies (a new admin must have a password, an existing one may keep its own).
 */
export function AdminFormModal({
  open,
  row,
  members,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** null = Add mode. */
  row: AdminRow | null;
  members: MemberOption[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: AdminFormValues) => void;
}) {
  const editing = row !== null;
  const [form, setForm] = useState<AdminFormValues>(blank);

  // Re-seed whenever the modal opens so a previous edit never leaks into the next.
  useEffect(() => {
    if (open) setForm(row ? fromRow(row) : blank());
  }, [open, row]);

  const set = <K extends keyof AdminFormValues>(key: K, value: AdminFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectedMember = members.find((m) => m.id === form.memberId) ?? null;
  const allMenus = form.menus.length === ALL_MENUS.length;

  function applyTemplate(t: RoleTemplate) {
    setForm((f) => ({
      ...f,
      roleTemplate: t,
      roles: ROLE_TEMPLATE_ROLES[t],
      // "Custom" keeps whatever is already ticked; templates overwrite.
      menus: t === "custom" ? f.menus : ROLE_TEMPLATE_MENUS[t],
    }));
  }

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={editing ? "Edit admin" : "Add admin"}
      subtitle="Everything for this admin — set up in one place."
      footer={
        <AdminModalActions
          onSave={() => onSubmit(form)}
          onCancel={onClose}
          saveLabel={editing ? "Save changes" : "Create admin"}
          busy={busy}
        />
      }
    >
      <AdminFormSection step={1} title="Member" />
      {editing ? (
        <MemberCard
          name={form.fullNameGu || form.fullNameEn}
          mobile={form.mobile}
          family={form.family}
          surname={form.surname}
        />
      ) : (
        <>
          <AdminField
            required
            hint="The admin's name, mobile and family come from the member you pick."
          >
            <AdminSearchSelect
              items={members}
              value={selectedMember}
              placeholder="Search & select a member…"
              renderLabel={(m) => m.name}
              renderMeta={(m) => [m.mobile, m.surname].filter(Boolean).join(" · ")}
              emptyText="No member found"
              onChange={(m) =>
                setForm((f) => ({
                  ...f,
                  memberId: m?.id ?? "",
                  fullNameEn: m?.name ?? "",
                  mobile: m?.mobile ?? "",
                  family: m?.family ?? "",
                  surname: m?.surname ?? "",
                }))
              }
            />
          </AdminField>
          {selectedMember && (
            <MemberCard
              name={form.fullNameEn}
              mobile={form.mobile}
              family={form.family}
              surname={form.surname}
            />
          )}
        </>
      )}

      <AdminFormSection step={2} title="Login credentials" className="mt-5" />
      <AdminField label="Login ID" required>
        <AdminInput
          value={form.username}
          placeholder="e.g. community_admin_02"
          onChange={(v) => set("username", v.toLowerCase().replace(/\s+/g, "_"))}
        />
      </AdminField>
      <AdminFormRow>
        <AdminField label="Password" required={!editing}>
          <AdminPasswordField
            value={form.password}
            onChange={(v) => set("password", v)}
            onGenerate={() => {
              const pw = generatePassword();
              setForm((f) => ({ ...f, password: pw, confirmPassword: pw }));
            }}
          />
        </AdminField>
        <AdminField label="Confirm password" required={!editing}>
          <AdminPasswordField
            value={form.confirmPassword}
            onChange={(v) => set("confirmPassword", v)}
          />
        </AdminField>
      </AdminFormRow>
      {editing && (
        <p className="-mt-1 mb-1 text-[11.5px] text-[var(--faint)]">
          Leave both blank to keep the current password.
        </p>
      )}

      <AdminFormSection step={3} title="Role (pre-fills permissions)" className="mt-5" />
      <AdminChoiceChips value={form.roleTemplate} onChange={applyTemplate} options={ROLE_TEMPLATES} />

      <div className="mt-5 mb-2.5 flex items-center justify-between">
        <AdminFormSection step={4} title="Menu permissions" className="mb-0" />
        <AdminCheck
          label="Select all"
          checked={allMenus}
          onChange={(next) =>
            setForm((f) => ({
              ...f,
              menus: next ? [...ALL_MENUS] : [],
              roleTemplate: "custom",
            }))
          }
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {ADMIN_MENUS.map((m) => {
          const on = form.menus.includes(m.key);
          return (
            <div
              key={m.key}
              className={cn(
                "rounded-[12px] border-[1.5px] bg-white px-1.5 py-1",
                on ? "border-[var(--brand)]" : "border-[var(--line-admin)]",
              )}
            >
              <AdminCheck
                label={m.label}
                checked={on}
                onChange={() =>
                  setForm((f) => ({
                    ...f,
                    menus: toggle(f.menus, m.key),
                    roleTemplate: "custom",
                  }))
                }
              />
            </div>
          );
        })}
      </div>

      <AdminFormSection step={5} title="Contact visibility" className="mt-5" />
      <div className="flex items-center gap-3 rounded-[14px] border border-[var(--line-admin)] bg-[#FBFAF7] p-3.5">
        <div className="flex-1">
          <div className="text-[13px] font-bold text-[var(--ink)]">Show Contact to Members</div>
          <div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
            ON → contact details are visible to users in the Community app. OFF → hidden.
          </div>
        </div>
        <span className="text-[11.5px] font-extrabold text-[var(--faint)]">
          {form.showPhone ? "ON" : "OFF"}
        </span>
        <AdminToggle
          on={form.showPhone}
          onChange={(v) => set("showPhone", v)}
          label="Show contact to members"
        />
      </div>

      <div className="mt-4 rounded-[14px] border border-[#D2D6FB] bg-[var(--platform-tint)] p-3.5">
        <div className="mb-2 text-[11px] font-extrabold tracking-wider text-[#3D6B8C] uppercase">
          Access summary
        </div>
        {form.menus.length === 0 ? (
          <p className="text-[12px] font-semibold text-[var(--faint)]">No menus granted yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {form.menus.map((k) => (
              <span
                key={k}
                className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#3A45B0]"
              >
                {menuLabel(k)}
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
    </AdminModal>
  );
}

/** Read-only member summary shown under the picker (and in place of it when editing). */
function MemberCard({
  name,
  mobile,
  family,
  surname,
}: {
  name: string;
  mobile: string;
  family: string;
  surname: string;
}) {
  return (
    <div className="mt-2 flex gap-3 rounded-[14px] border border-[var(--line-admin)] bg-[#FBFAF7] p-3.5">
      <AvatarInitial name={name} className="size-11 rounded-[14px] text-[17px]" />
      <dl className="grid flex-1 grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-2">
        {(
          [
            ["Name", name],
            ["Mobile", mobile || "—"],
            ["Family", family || "—"],
            ["Surname", surname || "—"],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex gap-1.5">
            <dt className="font-bold text-[var(--faint)]">{label}:</dt>
            <dd className="min-w-0 truncate font-semibold text-[var(--ink)]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
