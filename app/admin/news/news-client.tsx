"use client";

import { useState } from "react";
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
  PillActive,
} from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
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
  isPinned: boolean;
  isPublished: boolean;
  notificationSent: boolean;
  publishedAt: string;
};

type Draft = {
  id: string | null;
  titleEn: string;
  titleGu: string;
  contentEn: string;
  contentGu: string;
  imageUrl: string;
  isPinned: boolean;
  isPublished: boolean;
  sendNotification: boolean;
};

const emptyDraft: Draft = {
  id: null,
  titleEn: "",
  titleGu: "",
  contentEn: "",
  contentGu: "",
  imageUrl: "",
  isPinned: false,
  isPublished: true,
  sendNotification: false,
};

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
      titleEn: r.titleEn,
      titleGu: r.titleGu || "",
      contentEn: r.contentEn,
      contentGu: r.contentGu || "",
      imageUrl: r.imageUrl || "",
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
        isPinned: draft.isPinned,
        isPublished: draft.isPublished,
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
        isPinned: draft.isPinned,
        isPublished: draft.isPublished,
        sendNotification: draft.sendNotification,
      });
      setBusy(false);
      if (!res.ok) return setError(res.error);
      setRows((prev) => [
        {
          id: res.data.id,
          titleEn: draft.titleEn,
          titleGu: draft.titleGu || null,
          contentEn: draft.contentEn,
          contentGu: draft.contentGu || null,
          imageUrl: draft.imageUrl || null,
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

  return (
    <>
      <AdminH2>News</AdminH2>
      <AdminBtn className="mb-4 inline-flex" onClick={openNew}>
        <Plus className="size-4" />
        New post
      </AdminBtn>

      {error && !draft && <p className="mb-3 text-[13px] font-semibold text-[#B0303A]">{error}</p>}

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Title</AdminTh>
            <AdminTh>Date</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh>Notify?</AdminTh>
            <AdminTh></AdminTh>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n.id}>
              <AdminTd>
                {n.isPinned && "📌 "}
                {n.titleGu || n.titleEn}
              </AdminTd>
              <AdminTd>{n.publishedAt}</AdminTd>
              <AdminTd>
                {n.isPublished ? (
                  <PillActive>Published</PillActive>
                ) : (
                  <span className="text-[#B0801E]">Draft</span>
                )}
              </AdminTd>
              <AdminTd>
                {n.notificationSent ? (
                  <PillActive>✓ sent</PillActive>
                ) : (
                  <span className="text-[#938C80]">—</span>
                )}
              </AdminTd>
              <AdminTd>
                <span className="flex gap-2">
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
        <p className="py-6 text-center text-[11.5px] text-[#938C80]">No news posts yet.</p>
      )}

      <AdminHint>
        &quot;Send notification&quot; pushes an in-app alert to all approved members. Use for
        important updates only.
      </AdminHint>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-[520px] overflow-y-auto rounded-2xl sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#2A2620]">
              {draft?.id ? "Edit post" : "New post"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div>
              <AdminLabel>Title (English) *</AdminLabel>
              <AdminInput
                value={draft.titleEn}
                onChange={(v) => {
                  setDraft((prev) => (prev ? { ...prev, titleEn: v } : prev));
                  fromEn(v, (gu) => setDraft((prev) => (prev ? { ...prev, titleGu: gu } : prev)), "title");
                }}
              />
              <AdminLabel>Title (ગુજરાતી)</AdminLabel>
              <AdminInput
                value={draft.titleGu}
                onChange={(v) => {
                  setDraft((prev) => (prev ? { ...prev, titleGu: v } : prev));
                  fromGu(v, (en) => setDraft((prev) => (prev ? { ...prev, titleEn: en } : prev)), "title");
                }}
              />
              <AdminLabel>Content (English) *</AdminLabel>
              <Textarea
                value={draft.contentEn}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((prev) => (prev ? { ...prev, contentEn: v } : prev));
                  fromEn(v, (gu) => setDraft((prev) => (prev ? { ...prev, contentGu: gu } : prev)), "content");
                }}
                className="mb-2 min-h-[80px] border-[#EDE4D4] bg-[#FCFAF6] text-[13px]"
              />
              <AdminLabel>Content (ગુજરાતી)</AdminLabel>
              <Textarea
                value={draft.contentGu}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((prev) => (prev ? { ...prev, contentGu: v } : prev));
                  fromGu(v, (en) => setDraft((prev) => (prev ? { ...prev, contentEn: en } : prev)), "content");
                }}
                className="mb-2 min-h-[80px] border-[#EDE4D4] bg-[#FCFAF6] text-[13px]"
              />
              <AdminLabel>Image URL</AdminLabel>
              <AdminInput value={draft.imageUrl} onChange={(v) => setDraft({ ...draft, imageUrl: v })} />

              <div className="mt-3 flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-[12.5px] font-bold text-[#57524A]">
                  <Switch checked={draft.isPinned} onCheckedChange={(v) => setDraft({ ...draft, isPinned: v })} />
                  Pin to top
                </label>
                <label className="flex items-center gap-2 text-[12.5px] font-bold text-[#57524A]">
                  <Switch checked={draft.isPublished} onCheckedChange={(v) => setDraft({ ...draft, isPublished: v })} />
                  Published
                </label>
                {!draft.id && (
                  <label className="flex items-center gap-2 text-[12.5px] font-bold text-[#57524A]">
                    <Switch
                      checked={draft.sendNotification}
                      onCheckedChange={(v) => setDraft({ ...draft, sendNotification: v })}
                    />
                    Send notification
                  </label>
                )}
              </div>

              {error && <p className="mt-3 text-[12.5px] font-semibold text-[#B0303A]">{error}</p>}
              <div className="mt-4 flex gap-2.5">
                <AdminBtn className="flex-1 justify-center" onClick={save}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                </AdminBtn>
                <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setDraft(null)}>
                  Cancel
                </AdminBtn>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
