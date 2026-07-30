"use client";

/**
 * Shared admin form primitives.
 *
 * Every admin dialog is built from these — one place controls modal chrome,
 * field spacing, segmented buttons, file pickers and password fields, so the
 * forms cannot drift apart again. Screen files should contain form *content*,
 * never form *chrome*.
 */

import { useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminBtn, AdminInfoTip } from "@/components/admin/admin-ui";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";

/* ══════════════════════════ modal shell ══════════════════════════ */

export function AdminModal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Pre-styled badge shown left of the title — confirms use one to carry their tone. */
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  const max = { sm: "380px", md: "520px", lg: "680px" }[width];
  const heading = (
    <>
      <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
        {title}
      </DialogTitle>
      {subtitle && (
        <DialogDescription className="text-[12.5px] text-[var(--faint)]">
          {subtitle}
        </DialogDescription>
      )}
    </>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ maxWidth: max }}
      >
        <DialogHeader>
          {icon ? (
            <div className="flex items-center gap-3">
              {icon}
              <div className="flex flex-col gap-1">{heading}</div>
            </div>
          ) : (
            heading
          )}
        </DialogHeader>
        <div>{children}</div>
        {footer && <div className="mt-5 flex flex-wrap gap-2.5">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}

/** Standard Save / Cancel pair used by every dialog footer. */
export function AdminModalActions({
  onSave,
  onCancel,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  variant = "primary",
  busy,
  disabled,
}: {
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  /** "danger" for destructive confirms (delete, deactivate) — red instead of brand. */
  variant?: "primary" | "danger";
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      <AdminBtn
        variant={variant === "danger" ? "danger" : "primary"}
        className="flex-1 justify-center"
        onClick={onSave}
        disabled={busy || disabled}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : saveLabel}
      </AdminBtn>
      <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={onCancel}>
        {cancelLabel}
      </AdminBtn>
    </>
  );
}

/* ══════════════════════════ layout ══════════════════════════ */

/** Numbered step header — "1 · MEMBER" (Admins & roles form). */
export function AdminFormSection({
  step,
  title,
  className,
  info,
}: {
  step?: number;
  title: string;
  className?: string;
  /** Explanatory note, shown behind an (i) button beside the heading. */
  info?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-2.5 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-[var(--brand)] uppercase",
        className,
      )}
    >
      <span>
        {step != null ? `${step} · ` : ""}
        {title}
      </span>
      {info && <AdminInfoTip>{info}</AdminInfoTip>}
    </div>
  );
}

/** Responsive 2-column field grid; collapses to 1 column on mobile. */
export function AdminFormRow({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 1 | 2;
}) {
  return (
    <div className={cn("grid gap-3", cols === 2 ? "sm:grid-cols-2" : "grid-cols-1")}>
      {children}
    </div>
  );
}

/** Label + control + optional hint/error. */
export function AdminField({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("mb-3 block", className)}>
      {label && (
        <span className="mb-1 block text-[11.5px] font-bold text-[var(--muted)]">
          {label}
          {required && <span className="text-[var(--danger)]"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && (
        <span className="mt-1 block text-[11px] text-[var(--faint)]">{hint}</span>
      )}
      {error && (
        <span className="mt-1 block text-[11.5px] font-semibold text-[var(--danger)]">{error}</span>
      )}
    </label>
  );
}

/* ══════════════════════════ controls ══════════════════════════ */

/**
 * Two-or-more mutually exclusive buttons — the prototype's Status
 * (Draft|Published), (Active|Hidden) and (Existing business|Create new) control.
 */
export function AdminSegmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "h-[42px] cursor-pointer rounded-[11px] border-[1.5px] text-[13px] font-bold transition",
              on
                ? "border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]"
                : "border-[var(--line-input)] bg-white text-[var(--ink-mid)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Selectable pill row — role chips ("pre-fills permissions"). */
export function AdminChoiceChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "cursor-pointer rounded-[20px] border-[1.5px] px-3.5 py-[7px] text-xs font-bold transition",
              on
                ? "border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]"
                : "border-[var(--line-admin)] bg-white text-[var(--ink-dim)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Checkbox row used for menu permissions / assigned surnames. */
export function AdminCheck({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] font-semibold",
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-[var(--surface-admin)]",
        checked ? "text-[var(--ink)]" : "text-[var(--ink-dim)]",
      )}
    >
      <span
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px]",
          checked
            ? "border-[var(--brand)] bg-[var(--brand)] text-white"
            : "border-[var(--line-input)] bg-white",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

/**
 * File picker that uploads through /api/upload and returns the stored URL.
 * Falls back to public/uploads when Cloudinary is not configured.
 */
export function AdminFilePicker({
  value,
  onChange,
  accept = "image/*",
  folder = "community-app",
  label = "Choose image",
  preview = true,
}: {
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  folder?: string;
  label?: string;
  preview?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);
    const res = await api.upload<{ url: string }>("/api/upload", body);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onChange(res.data.url);
  }

  const isImage = accept.startsWith("image");

  return (
    <div>
      <div className="flex items-center gap-3">
        {preview && isImage && (
          <span className="flex h-[46px] w-[62px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[var(--line-field)] bg-[repeating-linear-gradient(45deg,#F4EEE3,#F4EEE3_6px,#FBF8F2_6px,#FBF8F2_12px)]">
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="" className="size-full object-cover" />
            ) : null}
          </span>
        )}
        <input
          ref={ref}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
            e.target.value = "";
          }}
        />
        <AdminBtn variant="ghost" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {label}
        </AdminBtn>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="cursor-pointer text-xs font-bold text-[var(--danger)] underline"
          >
            Remove
          </button>
        )}
      </div>
      {value && !isImage && (
        <p className="mt-1.5 truncate text-[11.5px] text-[var(--faint)]">{value}</p>
      )}
      {error && <p className="mt-1.5 text-[11.5px] font-semibold text-[var(--danger)]">{error}</p>}
    </div>
  );
}

/** Multi-image picker used by the Gallery album form. */
export function AdminMultiImagePicker({
  images,
  onChange,
  folder = "gallery",
}: {
  images: string[];
  onChange: (next: string[]) => void;
  folder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(files: FileList) {
    setBusy(true);
    setError(null);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", folder);
      const res = await api.upload<{ url: string }>("/api/upload", body);
      if (!res.ok) {
        setError(res.error);
        break;
      }
      uploaded.push(res.data.url);
    }
    setBusy(false);
    if (uploaded.length) onChange([...images, ...uploaded]);
  }

  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) pick(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[13px] border-[1.5px] border-dashed border-[var(--brand-border)] bg-[var(--brand-tint-soft)] py-3.5 text-[13px] font-bold text-[var(--brand)] disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <span className="text-base">＋</span>}
        Upload images (select multiple)
      </button>

      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {images.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative overflow-hidden rounded-[10px] border border-[var(--line)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-16 w-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onChange(images.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-1.5 text-[11.5px] font-semibold text-[var(--danger)]">{error}</p>}
    </div>
  );
}

/** Password field with Show toggle + "Generate strong password". */
export function AdminPasswordField({
  value,
  onChange,
  placeholder,
  onGenerate,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onGenerate?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-[42px] w-full rounded-[11px] border-[1.5px] border-[var(--line-field)] bg-[var(--field)] pr-14 pl-3 text-[13.5px] text-[var(--ink)] outline-none"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-[11.5px] font-bold text-[var(--ink-mid)]"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {onGenerate && (
        <button
          type="button"
          onClick={onGenerate}
          className="mt-1.5 cursor-pointer text-[11.5px] font-bold text-[var(--violet)] underline"
        >
          ⟳ Generate strong password
        </button>
      )}
    </div>
  );
}

/** Searchable single-select — "Search & select a member…". */
export function AdminSearchSelect<T extends { id: string }>({
  items,
  value,
  onChange,
  placeholder,
  renderLabel,
  renderMeta,
  emptyText = "No match found",
}: {
  items: T[];
  value: T | null;
  onChange: (item: T | null) => void;
  placeholder: string;
  renderLabel: (item: T) => string;
  renderMeta?: (item: T) => string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? items.filter((i) =>
        `${renderLabel(i)} ${renderMeta?.(i) ?? ""}`.toLowerCase().includes(needle),
      )
    : items;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-[42px] w-full cursor-pointer items-center gap-2 rounded-[11px] border-[1.5px] border-[var(--line-field)] bg-[var(--field)] px-3 text-left text-[13.5px]"
      >
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-[var(--faint-soft)]")}>
          {value ? renderLabel(value) : placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-[var(--faint)]" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--line-admin)] bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-[var(--line-soft)] px-3 py-2">
            <Search className="size-4 shrink-0 text-[var(--brand)]" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full cursor-pointer flex-col items-start px-3 py-2 text-left hover:bg-[var(--brand-tint)]"
              >
                <span className="text-[13px] font-semibold text-[var(--ink)]">
                  {renderLabel(item)}
                </span>
                {renderMeta && (
                  <span className="text-[11.5px] text-[var(--faint)]">{renderMeta(item)}</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-[12.5px] text-[var(--faint)]">{emptyText}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Generate a readable strong password (used by the admin credential forms). */
export function generatePassword(): string {
  const words = ["Samaj", "Parivar", "Gam", "Seva", "Milan", "Sneh"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  const sym = "!@#$%&*"[Math.floor(Math.random() * 7)];
  return `${w}${n}${sym}`;
}
