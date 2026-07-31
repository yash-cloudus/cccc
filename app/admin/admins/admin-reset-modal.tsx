"use client";

import { useEffect, useState } from "react";
import {
  AdminField,
  AdminModal,
  AdminModalActions,
  AdminPasswordField,
  generatePassword,
} from "@/components/admin/admin-form";
import { useAdminT } from "@/lib/i18n/admin-dictionary";
import type { AdminRow } from "./admin-roles";

/**
 * Reset password sheet. The admin types (or generates) the new password here
 * instead of it being silently forced to "admin", so nothing has to be read
 * back out of an alert box.
 */
export function AdminResetModal({
  row,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  row: AdminRow | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (password: string) => void;
}) {
  const { t } = useAdminT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (row) {
      setPassword(generatePassword());
      setConfirm("");
      setLocalError(null);
    }
  }, [row]);

  function submit() {
    if (password.trim().length < 4) return setLocalError(t("adm.errPwShort"));
    if (password !== confirm) return setLocalError(t("adm.errPwMismatch"));
    setLocalError(null);
    onSubmit(password.trim());
  }

  return (
    <AdminModal
      open={row !== null}
      onClose={onClose}
      title={t("adm.resetPassword")}
      subtitle={row ? [row.nameGu || row.name, row.username].filter(Boolean).join(" · ") : undefined}
      width="sm"
      footer={
        <AdminModalActions
          onSave={submit}
          onCancel={onClose}
          saveLabel={t("adm.setPassword")}
          busy={busy}
        />
      }
    >
      <AdminField label={t("adm.newPassword")} required>
        <AdminPasswordField
          value={password}
          onChange={setPassword}
          onGenerate={() => {
            setPassword(generatePassword());
            setConfirm("");
          }}
        />
      </AdminField>
      <AdminField label={t("adm.confirmPassword")} required>
        <AdminPasswordField value={confirm} onChange={setConfirm} />
      </AdminField>
      {(localError || error) && (
        <p className="mt-2 text-[12.5px] font-semibold text-[var(--danger)]">
          {localError || error}
        </p>
      )}
    </AdminModal>
  );
}
