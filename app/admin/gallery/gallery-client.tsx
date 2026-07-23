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
} from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/http";
import { useTranslitSync } from "@/hooks/use-translit-sync";

export type AlbumRow = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  coverUrl: string | null;
  youtubeUrl: string | null;
  description: string | null;
  isVisible: boolean;
  photos: number;
  date: string;
};

type Draft = {
  titleEn: string;
  titleGu: string;
  albumDate: string;
  coverUrl: string;
  youtubeUrl: string;
  description: string;
};

const emptyDraft: Draft = {
  titleEn: "",
  titleGu: "",
  albumDate: "",
  coverUrl: "",
  youtubeUrl: "",
  description: "",
};

export function GalleryClient({ initialRows }: { initialRows: AlbumRow[] }) {
  const { fromEn, fromGu } = useTranslitSync();
  const [rows, setRows] = useState<AlbumRow[]>(initialRows);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!draft) return;
    if (!draft.titleEn.trim()) return setError("Album title (English) is required");
    setBusy(true);
    setError(null);
    const res = await api.post<{ id: string }>(`/api/gallery`, {
      titleEn: draft.titleEn,
      titleGu: draft.titleGu || undefined,
      albumDate: draft.albumDate || undefined,
      coverUrl: draft.coverUrl || undefined,
      youtubeUrl: draft.youtubeUrl || undefined,
      description: draft.description || undefined,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setRows((prev) => [
      {
        id: res.data.id,
        titleEn: draft.titleEn,
        titleGu: draft.titleGu || null,
        coverUrl: draft.coverUrl || null,
        youtubeUrl: draft.youtubeUrl || null,
        description: draft.description || null,
        isVisible: true,
        photos: 0,
        date: draft.albumDate
          ? new Date(draft.albumDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—",
      },
      ...prev,
    ]);
    setDraft(null);
  }

  async function toggleVisible(a: AlbumRow) {
    const next = !a.isVisible;
    setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, isVisible: next } : r)));
    const res = await api.patch(`/api/gallery`, { id: a.id, isVisible: next });
    if (!res.ok) {
      setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, isVisible: !next } : r)));
      setError(res.error);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this album?")) return;
    const res = await api.del(`/api/gallery?id=${id}`);
    if (!res.ok) return setError(res.error);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <>
      <AdminH2>Gallery — albums</AdminH2>
      <AdminBtn className="mb-4 inline-flex" onClick={() => { setDraft({ ...emptyDraft }); setError(null); }}>
        <Plus className="size-4" />
        Create album
      </AdminBtn>

      {error && !draft && <p className="mb-3 text-[13px] font-semibold text-[#B0303A]">{error}</p>}

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Album</AdminTh>
            <AdminTh>Date</AdminTh>
            <AdminTh>Photos</AdminTh>
            <AdminTh>Visible</AdminTh>
            <AdminTh></AdminTh>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <AdminTd>{a.titleGu || a.titleEn}</AdminTd>
              <AdminTd>{a.date}</AdminTd>
              <AdminTd>{a.photos}</AdminTd>
              <AdminTd>
                <Switch
                  checked={a.isVisible}
                  onCheckedChange={() => toggleVisible(a)}
                  className="h-[24px] w-10 data-checked:bg-[#25A056] data-unchecked:bg-[#D8D0C2]"
                />
              </AdminTd>
              <AdminTd>
                <LinkAction danger onClick={() => remove(a.id)}>
                  Delete
                </LinkAction>
              </AdminTd>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      {rows.length === 0 && (
        <p className="py-6 text-center text-[11.5px] text-[#938C80]">No albums yet.</p>
      )}

      <AdminHint>
        Album = title + date + description + cover. Long videos = YouTube link inside album.
      </AdminHint>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-[460px] overflow-y-auto rounded-2xl sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#2A2620]">Create album</DialogTitle>
          </DialogHeader>
          {draft && (
            <div>
              <AdminLabel>Title (English) *</AdminLabel>
              <AdminInput
                value={draft.titleEn}
                onChange={(v) => {
                  setDraft((prev) => (prev ? { ...prev, titleEn: v } : prev));
                  fromEn(v, (gu) => setDraft((prev) => (prev ? { ...prev, titleGu: gu } : prev)));
                }}
              />
              <AdminLabel>Title (ગુજરાતી)</AdminLabel>
              <AdminInput
                value={draft.titleGu}
                onChange={(v) => {
                  setDraft((prev) => (prev ? { ...prev, titleGu: v } : prev));
                  fromGu(v, (en) => setDraft((prev) => (prev ? { ...prev, titleEn: en } : prev)));
                }}
              />
              <AdminLabel>Album date</AdminLabel>
              <AdminInput type="date" value={draft.albumDate} onChange={(v) => setDraft({ ...draft, albumDate: v })} />
              <AdminLabel>Cover image URL</AdminLabel>
              <AdminInput value={draft.coverUrl} onChange={(v) => setDraft({ ...draft, coverUrl: v })} />
              <AdminLabel>YouTube URL (optional)</AdminLabel>
              <AdminInput value={draft.youtubeUrl} onChange={(v) => setDraft({ ...draft, youtubeUrl: v })} />
              <AdminLabel>Description</AdminLabel>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="mb-2 min-h-[70px] border-[#EDE4D4] bg-[#FCFAF6] text-[13px]"
              />
              {error && <p className="mt-2 text-[12.5px] font-semibold text-[#B0303A]">{error}</p>}
              <div className="mt-4 flex gap-2.5">
                <AdminBtn className="flex-1 justify-center" onClick={create}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Create"}
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
