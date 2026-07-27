"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  FileText,
  Pencil,
  Plus,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  AdminBtn,
  AdminH2,
  AdminHint,
  AdminInput,
  AdminTable,
  AdminTd,
  AdminTh,
  PillActive,
} from "@/components/admin/admin-ui";
import {
  AdminCheck,
  AdminField,
  AdminFilePicker,
  AdminFormRow,
  AdminModal,
  AdminModalActions,
  AdminSegmented,
} from "@/components/admin/admin-form";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";

/** Small icon+label action chip — action columns felt too bare as plain text links. */
function ActionBtn({
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger" | "warn" | "success";
}) {
  const toneClass = {
    default: "border-[var(--line-admin)] text-[var(--ink-mid)] hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]",
    danger: "border-[var(--danger-tint)] text-[var(--danger)] hover:bg-[var(--danger-tint)]",
    warn: "border-[var(--gold-tint)] text-[var(--warn)] hover:bg-[var(--gold-tint)]",
    success: "border-[var(--success-tint)] text-[var(--success)] hover:bg-[var(--success-tint)]",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-2.5 py-[5px] text-[11.5px] font-bold whitespace-nowrap transition-colors",
        toneClass,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.3} />
      {label}
    </button>
  );
}

export type NewsRow = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  contentEn: string;
  contentGu: string | null;
  imageUrl: string | null;
  documentUrl: string | null;
  documentName: string | null;
  isPinned: boolean;
  isPublished: boolean;
  notificationSent: boolean;
  publishedAt: string;
  publishedAtISO: string;
  author: string | null;
};

type Draft = {
  id: string | null;
  publishDate: string;
  author: string;
  titleEn: string;
  titleGu: string;
  contentEn: string;
  contentGu: string;
  imageUrl: string;
  documentUrl: string;
  documentName: string;
  isPinned: boolean;
  isPublished: boolean;
  sendNotification: boolean;
};

const emptyDraft: Draft = {
  id: null,
  publishDate: new Date().toISOString().slice(0, 10),
  author: "",
  titleEn: "",
  titleGu: "",
  contentEn: "",
  contentGu: "",
  imageUrl: "",
  documentUrl: "",
  documentName: "",
  isPinned: false,
  isPublished: true,
  sendNotification: true,
};

/** ✓ / — cell used for the Cover and PDF columns. */
function HasCell({ on, href, label }: { on: boolean; href?: string | null; label: string }) {
  if (!on) return <span className="text-[var(--faint)]">—</span>;
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-bold text-[var(--info)] underline"
      >
        {label}
      </a>
    );
  }
  return <span className="text-xs font-bold text-[var(--success)]">✓</span>;
}

export function NewsClient({ initialRows }: { initialRows: NewsRow[] }) {
  const { fromEn, guInput } = useTranslitSync();
  const [rows, setRows] = useState<NewsRow[]>(initialRows);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<NewsRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setError(null);
    setDraft({ ...emptyDraft });
  }

  function openEdit(r: NewsRow) {
    setError(null);
    setDraft({
      id: r.id,
      publishDate: r.publishedAtISO ? r.publishedAtISO.slice(0, 10) : "",
      author: r.author || "",
      titleEn: r.titleEn,
      titleGu: r.titleGu || "",
      contentEn: r.contentEn,
      contentGu: r.contentGu || "",
      imageUrl: r.imageUrl || "",
      documentUrl: r.documentUrl || "",
      documentName: r.documentName || "",
      isPinned: r.isPinned,
      isPublished: r.isPublished,
      sendNotification: false,
    });
  }

  async function save() {
    if (!draft) return;
    if (!draft.titleEn.trim() || !draft.contentEn.trim()) {
      setError("Title and content (English) are required");
      return;
    }
    setBusy(true);
    setError(null);

    if (draft.id) {
      const res = await api.put<NewsRow>(`/api/news/${draft.id}`, {
        titleEn: draft.titleEn,
        titleGu: draft.titleGu || undefined,
        contentEn: draft.contentEn,
        contentGu: draft.contentGu || undefined,
        imageUrl: draft.imageUrl || undefined,
        documentUrl: draft.documentUrl || undefined,
        documentName: draft.documentName || undefined,
        isPinned: draft.isPinned,
        isPublished: draft.isPublished,
        publishedAt: draft.publishDate
          ? new Date(draft.publishDate).toISOString()
          : undefined,
      });
      setBusy(false);
      if (!res.ok) return setError(res.error);
      setRows((prev) =>
        prev.map((r) =>
          r.id === draft.id
            ? {
                ...r,
                titleEn: draft.titleEn,
                titleGu: draft.titleGu || null,
                contentEn: draft.contentEn,
                contentGu: draft.contentGu || null,
                imageUrl: draft.imageUrl || null,
                isPinned: draft.isPinned,
                isPublished: draft.isPublished,
              }
            : r,
        ),
      );
    } else {
      const res = await api.post<{ id: string; publishedAt: string }>(`/api/news`, {
        titleEn: draft.titleEn,
        titleGu: draft.titleGu || undefined,
        contentEn: draft.contentEn,
        contentGu: draft.contentGu || undefined,
        imageUrl: draft.imageUrl || undefined,
        documentUrl: draft.documentUrl || undefined,
        documentName: draft.documentName || undefined,
        isPinned: draft.isPinned,
        isPublished: draft.isPublished,
        sendNotification: draft.sendNotification,
        publishedAt: draft.publishDate
          ? new Date(draft.publishDate).toISOString()
          : undefined,
      });
      setBusy(false);
      if (!res.ok) return setError(res.error);
      setRows((prev) => [
        {
          id: res.data.id,
          publishedAtISO: draft.publishDate || new Date().toISOString(),
          author: draft.author || null,
          titleEn: draft.titleEn,
          titleGu: draft.titleGu || null,
          contentEn: draft.contentEn,
          contentGu: draft.contentGu || null,
          imageUrl: draft.imageUrl || null,
          documentUrl: draft.documentUrl || null,
          documentName: draft.documentName || null,
          isPinned: draft.isPinned,
          isPublished: draft.isPublished,
          notificationSent: draft.sendNotification,
          publishedAt: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        },
        ...prev,
      ]);
    }
    setDraft(null);
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: "Delete this post?",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await api.del(`/api/news/${id}`);
    if (!res.ok) return setError(res.error);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  /** Optimistic row-level flag flip, rolled back if the API rejects it. */
  async function toggleFlag(row: NewsRow, field: "isPinned" | "isPublished") {
    const next = !row[field];
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [field]: next } : r)));
    const res = await api.put(`/api/news/${row.id}`, { [field]: next });
    if (!res.ok) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [field]: !next } : r)));
      setError(res.error);
    }
  }

  const togglePinned = (row: NewsRow) => toggleFlag(row, "isPinned");
  const togglePublished = (row: NewsRow) => toggleFlag(row, "isPublished");

  return (
    <>
      <AdminH2>News</AdminH2>
      <AdminBtn className="mb-4 inline-flex" onClick={openNew}>
        <Plus className="size-4" />
        New post
      </AdminBtn>

      {error && !draft && <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>}

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Title</AdminTh>
            <AdminTh>Date</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh>Cover</AdminTh>
            <AdminTh>PDF</AdminTh>
            <AdminTh>Pinned</AdminTh>
            <AdminTh>Notify?</AdminTh>
            <AdminTh className="text-right">Actions</AdminTh>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n.id}>
              <AdminTd className="font-semibold text-[var(--ink)]">
                {n.titleGu || n.titleEn}
              </AdminTd>
              <AdminTd className="whitespace-nowrap">{n.publishedAt}</AdminTd>
              <AdminTd>
                {n.isPublished ? (
                  <PillActive>Published</PillActive>
                ) : (
                  <span className="text-xs font-bold text-[var(--warn)]">Draft</span>
                )}
              </AdminTd>
              <AdminTd>
                {n.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={n.imageUrl}
                    alt=""
                    className="h-8 w-[52px] rounded-md border border-[var(--line)] object-cover"
                  />
                ) : (
                  <span className="text-[var(--faint)]">—</span>
                )}
              </AdminTd>
              <AdminTd>
                <HasCell
                  on={!!n.documentUrl}
                  href={n.documentUrl}
                  label={n.documentName || "PDF"}
                />
              </AdminTd>
              <AdminTd>
                <button
                  type="button"
                  onClick={() => togglePinned(n)}
                  className="cursor-pointer text-base leading-none"
                  aria-label={n.isPinned ? "Unpin post" : "Pin post"}
                  title={n.isPinned ? "Unpin" : "Pin to top"}
                >
                  {n.isPinned ? "📌" : <span className="text-[var(--faint)]">—</span>}
                </button>
              </AdminTd>
              <AdminTd>
                {n.notificationSent ? (
                  <PillActive>✓ sent</PillActive>
                ) : (
                  <span className="text-[var(--faint)]">—</span>
                )}
              </AdminTd>
              <AdminTd className="text-right">
                <span className="flex flex-wrap justify-end gap-1.5">
                  <ActionBtn icon={Eye} label="Preview" onClick={() => setPreview(n)} />
                  <ActionBtn
                    icon={n.isPublished ? EyeOff : Send}
                    label={n.isPublished ? "Unpublish" : "Publish"}
                    tone={n.isPublished ? "warn" : "success"}
                    onClick={() => togglePublished(n)}
                  />
                  <ActionBtn icon={Pencil} label="Edit" onClick={() => openEdit(n)} />
                  <ActionBtn
                    icon={Trash2}
                    label="Delete"
                    tone="danger"
                    onClick={() => remove(n.id)}
                  />
                </span>
              </AdminTd>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      {rows.length === 0 && (
        <p className="py-6 text-center text-[11.5px] text-[var(--faint)]">No news posts yet.</p>
      )}

      <AdminHint>
        &quot;Send notification&quot; pushes an in-app alert to all approved members. Use for
        important updates only.
      </AdminHint>

      <AdminModal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit post" : "New post"}
        subtitle="Shows live in the User App News section."
        footer={
          <AdminModalActions
            onSave={save}
            onCancel={() => setDraft(null)}
            busy={busy}
            saveLabel="Save"
          />
        }
      >
        {draft && (
          <>
            <AdminField label="Title (ગુજરાતી)" required>
              <AdminInput
                gujarati
                value={draft.titleGu}
                onChange={(v) => {
                  setDraft((d) => (d ? { ...d, titleGu: v } : d));
                  guInput(v, (gu) => setDraft((d) => (d ? { ...d, titleGu: gu } : d)), "title:gu");
                }}
              />
            </AdminField>

            <AdminField label="Title (English)">
              <AdminInput
                value={draft.titleEn}
                onChange={(v) => {
                  setDraft((d) => (d ? { ...d, titleEn: v } : d));
                  fromEn(v, (gu) => setDraft((d) => (d ? { ...d, titleGu: gu } : d)), "title");
                }}
              />
            </AdminField>

            <AdminFormRow>
              <AdminField label="Date">
                <AdminInput
                  type="date"
                  value={draft.publishDate}
                  onChange={(v) => setDraft({ ...draft, publishDate: v })}
                />
              </AdminField>
              <AdminField label="Author">
                <AdminInput
                  value={draft.author}
                  placeholder="સમાજ એડમિન"
                  onChange={(v) => setDraft({ ...draft, author: v })}
                />
              </AdminField>
            </AdminFormRow>

            <AdminField label="Description (ગુજરાતી)" required>
              <Textarea
                value={draft.contentGu}
                placeholder="સમાચારની વિગત…"
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => (d ? { ...d, contentGu: v } : d));
                  guInput(v, (gu) => setDraft((d) => (d ? { ...d, titleGu: gu } : d)), "title:gu");
                }}
                className="min-h-[80px] border-[var(--line-field)] bg-[var(--field)] text-[13px]"
              />
            </AdminField>

            <AdminField label="Description (English)">
              <Textarea
                value={draft.contentEn}
                placeholder="News description…"
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => (d ? { ...d, contentEn: v } : d));
                  fromEn(v, (gu) => setDraft((d) => (d ? { ...d, contentGu: gu } : d)), "content");
                }}
                className="min-h-[80px] border-[var(--line-field)] bg-[var(--field)] text-[13px]"
              />
            </AdminField>

            <AdminField label="Status">
              <AdminSegmented
                value={draft.isPublished ? "published" : "draft"}
                onChange={(v) => setDraft({ ...draft, isPublished: v === "published" })}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "published", label: "Published" },
                ]}
              />
            </AdminField>

            <AdminField label="Cover image">
              <AdminFilePicker
                value={draft.imageUrl}
                folder="news"
                onChange={(url) => setDraft((d) => (d ? { ...d, imageUrl: url } : d))}
              />
            </AdminField>

            <AdminField label="PDF attachment">
              <AdminFilePicker
                value={draft.documentUrl}
                accept="application/pdf"
                folder="news"
                label="Choose file"
                preview={false}
                onChange={(url) => setDraft((d) => (d ? { ...d, documentUrl: url } : d))}
              />
            </AdminField>

            {draft.documentUrl && (
              <AdminField label="PDF label" hint="Shown instead of the raw link">
                <AdminInput
                  value={draft.documentName}
                  onChange={(v) => setDraft({ ...draft, documentName: v })}
                />
              </AdminField>
            )}

            <div className="flex flex-wrap gap-5">
              <AdminCheck
                checked={draft.isPinned}
                label="Pin to top"
                onChange={(v) => setDraft({ ...draft, isPinned: v })}
              />
              {!draft.id && (
                <AdminCheck
                  checked={draft.sendNotification}
                  label="Send notification"
                  onChange={(v) => setDraft({ ...draft, sendNotification: v })}
                />
              )}
            </div>

            {error && (
              <p className="mt-3 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>
            )}
          </>
        )}
      </AdminModal>

      <AdminModal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="Preview"
        subtitle="How this post appears in the User App."
        width="lg"
      >
        {preview && (
          <div className="overflow-hidden rounded-2xl border border-[var(--line-admin)]">
            <div className="flex h-[160px] items-center justify-center overflow-hidden bg-[linear-gradient(150deg,#8E2230,#B24C3B)] text-white">
              {preview.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <FileText className="size-11" strokeWidth={1.6} />
              )}
            </div>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                {preview.isPinned && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--gold-tint)] px-2 py-0.5 text-[10.5px] font-extrabold text-[var(--warn)]">
                    📌 Pinned
                  </span>
                )}
                {preview.isPublished ? (
                  <PillActive>Published</PillActive>
                ) : (
                  <span className="text-xs font-bold text-[var(--warn)]">Draft</span>
                )}
              </div>
              <h3 className="mt-2 font-[family-name:var(--font-noto-serif-gujarati)] text-lg font-bold text-[var(--ink)]">
                {preview.titleGu || preview.titleEn}
              </h3>
              <p className="mt-1 text-[11.5px] font-semibold text-[var(--faint)]">
                {preview.publishedAt}
                {preview.author ? ` · ${preview.author}` : ""}
              </p>
              <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                {preview.contentGu || preview.contentEn}
              </p>

              {preview.documentUrl && (
                <a
                  href={preview.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--line-admin)] p-3"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--info-tint)] text-[var(--info)]">
                    <FileText className="size-[18px]" strokeWidth={1.85} />
                  </div>
                  <span className="text-[13px] font-bold text-[var(--ink)]">
                    {preview.documentName || "View document"}
                  </span>
                </a>
              )}
            </div>
          </div>
        )}
      </AdminModal>
    </>
  );
}
