"use client";

import { useState } from "react";
import { ImageIcon, Plus } from "lucide-react";
import {
  AdminBtn,
  AdminH2,
  AdminHint,
  AdminInput,
  AdminSelect,
  LinkAction,
} from "@/components/admin/admin-ui";
import {
  AdminField,
  AdminFilePicker,
  AdminFormRow,
  AdminModal,
  AdminModalActions,
  AdminMultiImagePicker,
  AdminSegmented,
} from "@/components/admin/admin-form";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";

export type AlbumImage = { imageUrl: string; caption: string | null };

export type AlbumRow = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  coverUrl: string | null;
  accent: string | null;
  albumDateISO: string | null;
  youtubeUrl: string | null;
  description: string | null;
  isVisible: boolean;
  photos: number;
  images: AlbumImage[];
  date: string;
};

type Draft = {
  id: string | null;
  titleEn: string;
  titleGu: string;
  albumDate: string;
  accent: string;
  coverUrl: string;
  youtubeUrl: string;
  description: string;
  isVisible: boolean;
  images: string[];
};

const emptyDraft: Draft = {
  id: null,
  titleEn: "",
  titleGu: "",
  albumDate: "",
  accent: "#8E2230",
  coverUrl: "",
  youtubeUrl: "",
  description: "",
  isVisible: true,
  images: [],
};

/** Album accent colours — same set as Admin.dc.html `accentOpts`. */
const ACCENTS = [
  { value: "#8E2230", label: "Maroon" },
  { value: "#B26A1E", label: "Amber" },
  { value: "#3D6B8C", label: "Blue" },
  { value: "#6A4E9C", label: "Purple" },
  { value: "#4E7A45", label: "Green" },
];

export function GalleryClient({ initialRows }: { initialRows: AlbumRow[] }) {
  const { fromEn, guInput } = useTranslitSync();
  const [rows, setRows] = useState<AlbumRow[]>(initialRows);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setError(null);
    setDraft({ ...emptyDraft });
  }

  function openEdit(a: AlbumRow) {
    setError(null);
    setDraft({
      id: a.id,
      titleEn: a.titleEn,
      titleGu: a.titleGu || "",
      albumDate: a.albumDateISO ? a.albumDateISO.slice(0, 10) : "",
      accent: a.accent || "#8E2230",
      coverUrl: a.coverUrl || "",
      youtubeUrl: a.youtubeUrl || "",
      description: a.description || "",
      isVisible: a.isVisible,
      images: a.images.map((i) => i.imageUrl),
    });
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  /** Create or update in one path — the dialog is the same for both. */
  async function saveAlbum() {
    if (!draft) return;
    if (!draft.titleGu.trim() && !draft.titleEn.trim()) {
      return setError("Folder name is required");
    }
    setBusy(true);
    setError(null);

    const payload = {
      titleEn: draft.titleEn.trim() || draft.titleGu.trim(),
      titleGu: draft.titleGu.trim() || undefined,
      albumDate: draft.albumDate || undefined,
      accent: draft.accent || undefined,
      coverUrl: draft.coverUrl || undefined,
      youtubeUrl: draft.youtubeUrl || undefined,
      description: draft.description || undefined,
      isVisible: draft.isVisible,
      images: draft.images.map((imageUrl) => ({ imageUrl })),
    };

    const res = draft.id
      ? await api.patch<{ id: string }>(`/api/gallery`, { id: draft.id, ...payload })
      : await api.post<{ id: string }>(`/api/gallery`, payload);

    setBusy(false);
    if (!res.ok) return setError(res.error);

    const row: AlbumRow = {
      id: res.data.id,
      titleEn: payload.titleEn,
      titleGu: draft.titleGu || null,
      coverUrl: draft.coverUrl || null,
      accent: draft.accent,
      youtubeUrl: draft.youtubeUrl || null,
      description: draft.description || null,
      isVisible: draft.isVisible,
      photos: draft.images.length,
      images: draft.images.map((imageUrl) => ({ imageUrl, caption: null })),
      albumDateISO: draft.albumDate || null,
      date: draft.albumDate ? fmtDate(draft.albumDate) : "—",
    };

    setRows((prev) =>
      draft.id ? prev.map((r) => (r.id === draft.id ? row : r)) : [row, ...prev],
    );
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
    const ok = await confirmDialog({
      title: "Delete this album?",
      description: "All photos in it will be removed too.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await api.del(`/api/gallery?id=${id}`);
    if (!res.ok) return setError(res.error);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <AdminH2 className="mb-0">Gallery — albums</AdminH2>
        <AdminBtn onClick={openCreate}>
          <Plus className="size-4" />
          Create album (folder)
        </AdminBtn>
      </div>

      <AdminHint className="mt-0 mb-5 max-w-3xl text-[12.5px]">
        Create a folder with a name &amp; date, then upload multiple images into it. Photos appear
        in the User App under that album.
      </AdminHint>

      {error && !draft && <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {rows.map((a) => (
          <article
            key={a.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-[var(--line-admin)] bg-white"
          >
            <div className="relative h-[132px] bg-[var(--surface-admin)]">
              {a.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.coverUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center">
                  <ImageIcon className="size-8 text-[var(--faint-soft)]" strokeWidth={1.6} />
                </span>
              )}
              <span
                className={cn(
                  "absolute top-2.5 right-2.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                  a.isVisible
                    ? "bg-[var(--success-tint)] text-[var(--success)]"
                    : "bg-[var(--line-soft)] text-[var(--muted)]",
                )}
              >
                {a.isVisible ? "Visible" : "Hidden"}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col p-3.5">
              <h3 className="truncate text-[14px] font-extrabold text-[var(--ink)]">
                {a.titleGu || a.titleEn}
              </h3>
              <p className="mt-0.5 text-[11.5px] font-semibold text-[var(--faint)]">
                {a.date} · {a.photos} photo{a.photos === 1 ? "" : "s"}
                {a.youtubeUrl ? " · video" : ""}
              </p>

              <div className="mt-3 flex flex-wrap gap-2.5 border-t border-[var(--line-soft)] pt-3">
                <LinkAction onClick={() => openEdit(a)}>Upload / manage</LinkAction>
                <LinkAction onClick={() => toggleVisible(a)}>
                  {a.isVisible ? "Hide" : "Show"}
                </LinkAction>
                <LinkAction danger onClick={() => remove(a.id)}>
                  Delete
                </LinkAction>
              </div>
            </div>
          </article>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="py-10 text-center text-[13px] text-[var(--faint)]">
          No albums yet — create your first folder.
        </p>
      )}

      <AdminHint>
        Album = title + date + description + cover. Long videos = YouTube link inside album.
      </AdminHint>

      <AdminModal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit album" : "Create album"}
        subtitle="Folder name, date & description."
        footer={
          <AdminModalActions
            onSave={saveAlbum}
            onCancel={() => setDraft(null)}
            saveLabel={draft?.id ? "Save album" : "Create"}
            busy={busy}
          />
        }
      >
        {draft && (
          <>
            <AdminField label="Folder name (ગુજરાતી)" required>
              <AdminInput
                gujarati
                value={draft.titleGu}
                placeholder="દા.ત. પાટોત્સવ 2026"
                onChange={(v) => {
                  setDraft((d) => (d ? { ...d, titleGu: v } : d));
                  guInput(v, (gu) => setDraft((d) => (d ? { ...d, titleGu: gu } : d)), "title:gu");
                }}
              />
            </AdminField>

            <AdminField label="Folder name (English)">
              <AdminInput
                value={draft.titleEn}
                placeholder="e.g. Patotsav 2026"
                onChange={(v) => {
                  setDraft((d) => (d ? { ...d, titleEn: v } : d));
                  fromEn(v, (gu) => setDraft((d) => (d ? { ...d, titleGu: gu } : d)));
                }}
              />
            </AdminField>

            <AdminFormRow>
              <AdminField label="Date">
                <AdminInput
                  type="date"
                  value={draft.albumDate}
                  onChange={(v) => setDraft({ ...draft, albumDate: v })}
                />
              </AdminField>
              <AdminField label="Accent color">
                <AdminSelect
                  value={draft.accent}
                  onChange={(v) => setDraft({ ...draft, accent: v })}
                  className="w-full"
                  options={ACCENTS}
                />
              </AdminField>
            </AdminFormRow>

            <AdminField label="Description (ગુજરાતી)">
              <AdminInput
                value={draft.description}
                placeholder="ટૂંકી વિગત"
                onChange={(v) => setDraft({ ...draft, description: v })}
              />
            </AdminField>

            <AdminField label="Status">
              <AdminSegmented
                value={draft.isVisible ? "active" : "hidden"}
                onChange={(v) => setDraft({ ...draft, isVisible: v === "active" })}
                options={[
                  { value: "active", label: "Active" },
                  { value: "hidden", label: "Hidden" },
                ]}
              />
            </AdminField>

            <AdminField label="Cover image">
              <AdminFilePicker
                value={draft.coverUrl}
                folder="gallery"
                onChange={(url) => setDraft((d) => (d ? { ...d, coverUrl: url } : d))}
              />
            </AdminField>

            <AdminField label="YouTube URL (optional)">
              <AdminInput
                value={draft.youtubeUrl}
                onChange={(v) => setDraft({ ...draft, youtubeUrl: v })}
              />
            </AdminField>

            <AdminField label={`Photos (${draft.images.length})`}>
              <AdminMultiImagePicker
                images={draft.images}
                onChange={(next) => setDraft((d) => (d ? { ...d, images: next } : d))}
              />
            </AdminField>

            {error && <p className="text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
          </>
        )}
      </AdminModal>
    </>
  );
}
