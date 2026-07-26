"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  AdminBtn,
  AdminH2,
  AdminHint,
  AdminInput,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminToggle,
  LinkAction,
  PillActive,
} from "@/components/admin/admin-ui";
import {
  AdminField,
  AdminFilePicker,
  AdminFormRow,
  AdminModal,
  AdminModalActions,
  AdminSegmented,
} from "@/components/admin/admin-form";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/http";
import { useTranslitSync } from "@/hooks/use-translit-sync";

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
  sendNotification: false,
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
  const { fromEn, fromGu } = useTranslitSync();
  const [rows, setRows] = useState<NewsRow[]>(initialRows);
  const [draft, setDraft] = useState<Draft | null>(null);
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
    if (!window.confirm("Delete this post?")) return;
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
                <span className="flex flex-wrap justify-end gap-2">
                  <LinkAction
                    onClick={() => window.open(`/news/${n.id}`, "_blank", "noopener")}
                  >
                    Preview
                  </LinkAction>
                  <LinkAction onClick={() => togglePublished(n)}>
                    {n.isPublished ? "Unpublish" : "Publish"}
                  </LinkAction>
                  <LinkAction onClick={() => openEdit(n)}>Edit</LinkAction>
                  <LinkAction danger onClick={() => remove(n.id)}>
                    Delete
                  </LinkAction>
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
                value={draft.titleGu}
                onChange={(v) => {
                  setDraft((d) => (d ? { ...d, titleGu: v } : d));
                  fromGu(v, (en) => setDraft((d) => (d ? { ...d, titleEn: en } : d)), "title");
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
                  fromGu(v, (en) => setDraft((d) => (d ? { ...d, contentEn: en } : d)), "content");
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
              <label className="flex items-center gap-2 text-[12.5px] font-bold text-[var(--ink-mid)]">
                <AdminToggle
                  on={draft.isPinned}
                  label="Pin to top"
                  onChange={(v) => setDraft({ ...draft, isPinned: v })}
                />
                Pin to top
              </label>
              {!draft.id && (
                <label className="flex items-center gap-2 text-[12.5px] font-bold text-[var(--ink-mid)]">
                  <AdminToggle
                    on={draft.sendNotification}
                    label="Send notification"
                    onChange={(v) => setDraft({ ...draft, sendNotification: v })}
                  />
                  Send notification
                </label>
              )}
            </div>

            {error && (
              <p className="mt-3 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>
            )}
          </>
        )}
      </AdminModal>
    </>
  );
}
