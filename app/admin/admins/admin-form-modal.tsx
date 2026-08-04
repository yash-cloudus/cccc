"use client";

import { useEffect, useState } from "react";
import { AdminInput, AdminToggle } from "@/components/admin/admin-ui";
import { useAdminT, type AdminKey } from "@/lib/i18n/admin-dictionary";
import { cn } from "@/lib/utils";
import { phoneText } from "@/lib/format";
import { DEFAULT_ISO, isValidNumber } from "@/lib/phone";
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
  templateOf,
  type AdminRow,
  type MemberOption,
  type RoleTemplate,
} from "./admin-roles";
import { AvatarInitial } from "./avatar-initial";

/**
 * Role template → dictionary key. The labels in `admin-roles` are the English
 * source; the rendered text comes from here so both languages stay in sync.
 */
export const TEMPLATE_KEY: Record<RoleTemplate, AdminKey> = {
  community_admin: "adm.roleCommunityAdmin",
  coordinator_head: "adm.tplCoordinatorHead",
  content_manager: "adm.roleContentManager",
  gallery_manager: "adm.tplGalleryManager",
  result_manager: "adm.tplResultManager",
  owner: "adm.roleOwner",
  custom: "adm.tplCustom",
};

/** Menu keys mirror the sidebar, so their labels reuse the `nav.*` entries. */
export const menuKey = (k: string) => `nav.${k}` as AdminKey;

/** Everything the Add / Edit modal collects. */
export type AdminFormValues = {
  memberId: string;
  fullNameEn: string;
  fullNameGu: string;
  mobile: string;
  mobileIso: string;
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
  mobileIso: DEFAULT_ISO,
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
    mobile: isValidNumber(row.mobile, row.mobileIso) ? row.mobile : "",
    mobileIso: row.mobileIso || DEFAULT_ISO,
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
  const { t } = useAdminT();
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
      title={editing ? t("adm.editAdmin") : t("adm.addAdmin")}
      subtitle={t("adm.formSubtitle")}
      footer={
        <AdminModalActions
          onSave={() => onSubmit(form)}
          onCancel={onClose}
          saveLabel={editing ? t("adm.saveChanges") : t("adm.createAdmin")}
          busy={busy}
        />
      }
    >
      <AdminFormSection step={1} title={t("adm.stepMember")} />
      {editing ? (
        <MemberCard
          name={form.fullNameGu || form.fullNameEn}
          mobile={phoneText(form.mobile, form.mobileIso)}
          family={form.family}
          surname={form.surname}
        />
      ) : (
        <>
          <AdminField required hint={t("adm.memberHint")}>
            <AdminSearchSelect
              items={members}
              value={selectedMember}
              placeholder={t("adm.memberSearchPlaceholder")}
              renderLabel={(m) => m.name}
              renderMeta={(m) => [phoneText(m.mobile, m.mobileIso), m.surname].filter(Boolean).join(" · ")}
              emptyText={t("adm.noMemberFound")}
              onChange={(m) =>
                setForm((f) => ({
                  ...f,
                  memberId: m?.id ?? "",
                  fullNameEn: m?.name ?? "",
                  mobile: m?.mobile ?? "",
                  mobileIso: m?.mobileIso ?? DEFAULT_ISO,
                  family: m?.family ?? "",
                  surname: m?.surname ?? "",
                }))
              }
            />
          </AdminField>
          {selectedMember && (
            <MemberCard
              name={form.fullNameEn}
              mobile={phoneText(form.mobile, form.mobileIso)}
              family={form.family}
              surname={form.surname}
            />
          )}
        </>
      )}

      <AdminFormSection step={2} title={t("adm.stepCredentials")} className="mt-5" />
      <AdminField label={t("adm.loginId")} required>
        <AdminInput
          value={form.username}
          placeholder={t("adm.loginIdPlaceholder")}
          onChange={(v) => set("username", v.toLowerCase().replace(/\s+/g, "_"))}
        />
      </AdminField>
      <AdminFormRow>
        <AdminField label={t("adm.password")} required={!editing}>
          <AdminPasswordField
            value={form.password}
            onChange={(v) => set("password", v)}
            onGenerate={() => {
              const pw = generatePassword();
              setForm((f) => ({ ...f, password: pw, confirmPassword: pw }));
            }}
          />
        </AdminField>
        <AdminField label={t("adm.confirmPassword")} required={!editing}>
          <AdminPasswordField
            value={form.confirmPassword}
            onChange={(v) => set("confirmPassword", v)}
          />
        </AdminField>
      </AdminFormRow>
      {editing && (
        <p className="-mt-1 mb-1 text-[11.5px] text-[var(--faint)]">
          {t("adm.keepPasswordHint")}
        </p>
      )}

      <AdminFormSection step={3} title={t("adm.stepRole")} className="mt-5" />
      <AdminChoiceChips
        value={form.roleTemplate}
        onChange={applyTemplate}
        options={ROLE_TEMPLATES.map((o) => ({ value: o.value, label: t(TEMPLATE_KEY[o.value]) }))}
      />

      <div className="mt-5 mb-2.5 flex items-center justify-between">
        <AdminFormSection step={4} title={t("adm.stepMenus")} className="mb-0" />
        <AdminCheck
          label={t("adm.selectAll")}
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
                label={t(menuKey(m.key))}
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

      <AdminFormSection step={5} title={t("adm.stepContact")} className="mt-5" />
      <div className="flex items-center gap-3 rounded-[14px] border border-[var(--line-admin)] bg-[#FBFAF7] p-3.5">
        <div className="flex-1">
          <div className="text-[13px] font-bold text-[var(--ink)]">{t("adm.showContact")}</div>
          <div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
            {t("adm.showContactHelp")}
          </div>
        </div>
        <span className="text-[11.5px] font-extrabold text-[var(--faint)]">
          {form.showPhone ? t("adm.on") : t("adm.off")}
        </span>
        <AdminToggle
          on={form.showPhone}
          onChange={(v) => set("showPhone", v)}
          label={t("adm.showContact")}
        />
      </div>

      <div className="mt-4 rounded-[14px] border border-[#D2D6FB] bg-[var(--platform-tint)] p-3.5">
        <div className="mb-2 text-[11px] font-extrabold tracking-wider text-[#3D6B8C] uppercase">
          {t("adm.accessSummary")}
        </div>
        {form.menus.length === 0 ? (
          <p className="text-[12px] font-semibold text-[var(--faint)]">{t("adm.noMenus")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {form.menus.map((k) => (
              <span
                key={k}
                className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#3A45B0]"
              >
                {t(menuKey(k))}
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
  const { t } = useAdminT();
  return (
    <div className="mt-2 flex gap-3 rounded-[14px] border border-[var(--line-admin)] bg-[#FBFAF7] p-3.5">
      <AvatarInitial name={name} className="size-11 rounded-[14px] text-[17px]" />
      <dl className="grid flex-1 grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-2">
        {(
          [
            [t("adm.name"), name],
            [t("adm.mobile"), mobile || "—"],
            [t("adm.family"), family || "—"],
            [t("adm.surname"), surname || "—"],
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
