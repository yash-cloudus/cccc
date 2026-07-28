"use client";

import { useEffect, useState } from "react";
import {
  AdminField,
  AdminModal,
  AdminModalActions,
  AdminPasswordField,
  generatePassword,
} from "@/components/admin/admin-form";
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
    if (password.trim().length < 4) return setLocalError("Password must be at least 4 characters");
    if (password !== confirm) return setLocalError("Password and confirm password do not match");
    setLocalError(null);
    onSubmit(password.trim());
  }

  return (
    <AdminModal
      open={row !== null}
      onClose={onClose}
      title="Reset password"
      subtitle={row ? [row.nameGu || row.name, row.username].filter(Boolean).join(" · ") : undefined}
      width="sm"
      footer={
        <AdminModalActions onSave={submit} onCancel={onClose} saveLabel="Set password" busy={busy} />
      }
    >
      <AdminField label="New password" required>
        <AdminPasswordField
          value={password}
          onChange={setPassword}
          onGenerate={() => {
            setPassword(generatePassword());
            setConfirm("");
          }}
        />
      </AdminField>
      <AdminField label="Confirm password" required>
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
