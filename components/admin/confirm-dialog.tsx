"use client";

/**
 * Themed replacement for `window.confirm()`.
 *
 * `window.confirm` renders the browser's own unstyled popup (title bar shows
 * the raw hostname, no branding) — this renders the same `AdminModal` chrome
 * used by every other admin dialog, so a delete/deactivate confirmation looks
 * like it belongs to the app instead of the OS.
 *
 * Usage — same call shape as `window.confirm`, just async and richer:
 *   const ok = await confirmDialog({
 *     title: "Delete this album?",
 *     description: "This cannot be undone.",
 *     tone: "danger",
 *   });
 *   if (!ok) return;
 *
 * One `<ConfirmDialogHost />` is mounted in the root layout; every call site
 * shares it — no provider or hook wiring needed per screen.
 */

import { useEffect, useState } from "react";
import { AdminModal, AdminModalActions } from "@/components/admin/admin-form";
import { useAdminT } from "@/lib/i18n/admin-dictionary";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" (red confirm button) for destructive actions — delete, deactivate. */
  tone?: "danger" | "primary";
};

type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void };

let notify: ((req: PendingConfirm) => void) | null = null;

/**
 * Ask the user to confirm, returning a Promise<boolean> like a Promise-based
 * `window.confirm`. Falls back to the native confirm if the host isn't
 * mounted yet (e.g. during a fast-refresh edge case) so a call site never
 * silently no-ops.
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!notify) {
      resolve(window.confirm([opts.title, opts.description].filter(Boolean).join("\n\n")));
      return;
    }
    notify({ ...opts, resolve });
  });
}

export function ConfirmDialogHost() {
  const { t } = useAdminT();
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    notify = (req) => setPending(req);
    return () => {
      notify = null;
    };
  }, []);

  function settle(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  return (
    <AdminModal
      open={pending !== null}
      onClose={() => settle(false)}
      title={pending?.title ?? ""}
      subtitle={pending?.description}
      width="sm"
      footer={
        <AdminModalActions
          onSave={() => settle(true)}
          onCancel={() => settle(false)}
          saveLabel={pending?.confirmLabel ?? t("ui.confirm")}
          cancelLabel={pending?.cancelLabel ?? t("common.cancel")}
          variant={pending?.tone === "danger" ? "danger" : "primary"}
        />
      }
    >
      {null}
    </AdminModal>
  );
}
