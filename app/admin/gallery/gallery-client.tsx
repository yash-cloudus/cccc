"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, ImageIcon, Plus, Trash2, Upload } from "lucide-react";
import {
  ActionBtn,
  AdminBtn,
  AdminColorSelect,
  AdminH2,
  AdminInput,
  AdminSelect,
  FilterButton,
  SearchInput,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import {
  accentGradient,
  accentVarStyle,
  ALBUM_HOVER_SHADOW,
  formatDateDMY,
  pickText,
} from "@/lib/format";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import { DateField, todayISO } from "@/components/ui/date-field";
import { useAdminT } from "@/lib/i18n/admin-dictionary";

export type AlbumImage = { imageUrl: string; caption: string | null };

export type AlbumRow = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  coverUrl: string | null;
  accent: string | null;
  startDateISO: string | null;
  endDateISO: string | null;
  youtubeUrl: string | null;
  description: string | null;
  descriptionEn: string | null;
  isVisible: boolean;
  photos: number;
  images: AlbumImage[];
};

type Draft = {
  id: string | null;
  titleEn: string;
  titleGu: string;
  startDate: string;
  endDate: string;
  accent: string;
  coverUrl: string;
  youtubeUrl: string;
  description: string;
  descriptionEn: string;
  isVisible: boolean;
  images: string[];
};

const emptyDraft: Draft = {
  id: null,
  titleEn: "",
  titleGu: "",
  startDate: "",
  endDate: "",
  accent: "#8E2230",
  coverUrl: "",
  youtubeUrl: "",
  description: "",
  descriptionEn: "",
  isVisible: true,
  images: [],
};

/** Past-end-date albums are lazily flipped to `isVisible: false` server-side
 * on next read; this just lets the card show *why* it's hidden. */
const isExpired = (endDateISO: string | null) =>
  !!endDateISO && new Date(new Date(endDateISO).getTime() + 86_400_000).getTime() <= Date.now();

/** Colour the end date like the status badge as it approaches/passes: red once
 * expired, amber inside the last 10 days, otherwise the card's normal text colour. */
function endDateUrgencyClass(endDateISO: string | null): string {
  if (!endDateISO) return "";
  const daysLeft = Math.ceil(
    (new Date(endDateISO).getTime() - Date.now()) / 86_400_000,
  );
  if (daysLeft < 0) return "text-[var(--danger)]";
  if (daysLeft <= 10) return "text-[var(--warn)]";
  return "";
}

export function GalleryClient({ initialRows }: { initialRows: AlbumRow[] }) {
  const { t, tf, lang } = useAdminT();
  const { fromEn, guInput } = useTranslitSync();
  const [rows, setRows] = useState<AlbumRow[]>(initialRows);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<AlbumRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "visible" | "expired"
  >("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const statusFilterOptions = [
    { value: "all", label: t("gal.filterAll") },
    { value: "visible", label: t("gal.visible") },
    { value: "expired", label: t("gal.expired") },
  ];

  /** Album accent colours — same set as Admin.dc.html `accentOpts`. */
  const accents = [
    { value: "#8E2230", label: t("gal.accentMaroon") },
    { value: "#B26A1E", label: t("gal.accentAmber") },
    { value: "#3D6B8C", label: t("gal.accentBlue") },
    { value: "#6A4E9C", label: t("gal.accentPurple") },
    { value: "#4E7A45", label: t("gal.accentGreen") },
  ];

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();

    return rows.filter((a) => {
      const expired = isExpired(a.endDateISO);
      if (statusFilter === "visible" && !(a.isVisible && !expired))
        return false;
      if (statusFilter === "expired" && !expired) return false;

      if (!term) return true;
      return (
        a.titleEn.toLowerCase().includes(term) ||
        (a.titleGu || "").toLowerCase().includes(term)
      );
    });
  }, [rows, q, statusFilter]);

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
      startDate: a.startDateISO ? a.startDateISO.slice(0, 10) : "",
      endDate: a.endDateISO ? a.endDateISO.slice(0, 10) : "",
      accent: a.accent || "#8E2230",
      coverUrl: a.coverUrl || "",
      youtubeUrl: a.youtubeUrl || "",
      description: a.description || "",
      descriptionEn: a.descriptionEn || "",
      isVisible: a.isVisible,
      images: a.images.map((i) => i.imageUrl),
    });
  }

  /** Create or update in one path — the dialog is the same for both. */
  async function saveAlbum() {
    if (!draft) return;
    if (!draft.titleGu.trim() && !draft.titleEn.trim()) {
      return setError(t("gal.errNameRequired"));
    }
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      return setError(t("gal.errEndBeforeStart"));
    }
    setBusy(true);
    setError(null);

    const payload = {
      titleEn: draft.titleEn.trim() || draft.titleGu.trim(),
      titleGu: draft.titleGu.trim() || undefined,
      startDate: draft.startDate || undefined,
      endDate: draft.endDate || undefined,
      accent: draft.accent || undefined,
      coverUrl: draft.coverUrl || undefined,
      youtubeUrl: draft.youtubeUrl || undefined,
      description: draft.description || undefined,
      descriptionEn: draft.descriptionEn || undefined,
      isVisible: draft.isVisible,
      images: draft.images.map((imageUrl) => ({ imageUrl })),
    };

    const res = draft.id
      ? await api.patch<{ id: string }>(`/api/gallery`, {
          id: draft.id,
          ...payload,
        })
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
      descriptionEn: draft.descriptionEn || null,
      isVisible: draft.isVisible,
      photos: draft.images.length,
      images: draft.images.map((imageUrl) => ({ imageUrl, caption: null })),
      startDateISO: draft.startDate || null,
      endDateISO: draft.endDate || null,
    };

    setRows((prev) =>
      draft.id
        ? prev.map((r) => (r.id === draft.id ? row : r))
        : [row, ...prev],
    );
    setDraft(null);
    toast.success(draft.id ? t("gal.toastUpdated") : t("gal.toastCreated"));
  }

  async function toggleVisible(a: AlbumRow) {
    const next = !a.isVisible;
    const ok = await confirmDialog({
      title: next ? t("gal.confirmShowTitle") : t("gal.confirmHideTitle"),
      description: next ? t("gal.confirmShowDesc") : t("gal.confirmHideDesc"),
      confirmLabel: next ? t("gal.show") : t("gal.hide"),
      cancelLabel: t("common.cancel"),
      tone: next ? "primary" : "danger",
    });
    if (!ok) return;
    setRows((prev) =>
      prev.map((r) => (r.id === a.id ? { ...r, isVisible: next } : r)),
    );
    const res = await api.patch(`/api/gallery`, { id: a.id, isVisible: next });
    if (!res.ok) {
      setRows((prev) =>
        prev.map((r) => (r.id === a.id ? { ...r, isVisible: !next } : r)),
      );
      toast.error(res.error || t("gal.errUpdate"));
      return;
    }
    toast.success(next ? t("gal.toastShown") : t("gal.toastHidden"));
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: t("gal.confirmDeleteTitle"),
      description: t("gal.confirmDeleteDesc"),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    const res = await api.del(`/api/gallery?id=${id}`);
    if (!res.ok) {
      toast.error(res.error || t("gal.errDelete"));
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success(t("gal.toastDeleted"));
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminH2
          className="mb-0 shrink-0"
          info={
            <>
              <p>{t("gal.info1")}</p>
              <p className="mt-1.5">{t("gal.info2")}</p>
            </>
          }
        >
          {t("gal.heading")}
        </AdminH2>

        <div className="flex w-full items-center gap-2.5 md:w-auto">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={t("gal.searchPlaceholder")}
            className="min-w-0 flex-1 md:w-[210px] md:flex-none"
          />
          <FilterButton
            className="md:hidden"
            active={statusFilter !== "all"}
            onClick={() => setFiltersOpen(true)}
          />
          <div className="hidden items-center gap-2.5 md:flex">
            <AdminSelect
              value={statusFilter}
              onChange={(v) =>
                setStatusFilter(v as "all" | "visible" | "expired")
              }
              options={statusFilterOptions}
              className="w-[150px] shrink-0"
              ariaLabel={t("gal.filterByStatus")}
            />
            <AdminBtn className="shrink-0" onClick={openCreate}>
              <Plus className="size-4" />
              {t("gal.createAlbum")}
            </AdminBtn>
          </div>
        </div>
        <AdminBtn
          className="w-full justify-center md:hidden"
          onClick={openCreate}
        >
          <Plus className="size-4" />
          {t("gal.createAlbum")}
        </AdminBtn>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>{t("gal.filters")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <AdminSelect
              value={statusFilter}
              onChange={(v) =>
                setStatusFilter(v as "all" | "visible" | "expired")
              }
              options={statusFilterOptions}
              className="w-full"
              ariaLabel={t("gal.filterByStatus")}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {filteredRows.map((a) => {
          const expired = isExpired(a.endDateISO);
          const statusLabel = a.isVisible
            ? t("gal.visible")
            : expired
              ? t("gal.expired")
              : t("gal.hidden");
          return (
            <article
              key={a.id}
              style={accentVarStyle(a.accent)}
              className={cn(
                "flex flex-col overflow-hidden rounded-2xl border border-[var(--line-admin)] bg-white",
                ALBUM_HOVER_SHADOW,
              )}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPreview(a)}
                onKeyDown={(e) => e.key === "Enter" && setPreview(a)}
                style={{ background: accentGradient(a.accent) }}
                className="relative h-[132px] cursor-pointer"
              >
                {a.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.coverUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center">
                    <ImageIcon
                      className="size-8 text-white/85"
                      strokeWidth={1.6}
                    />
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col p-3.5">
                <h3 className="truncate text-[14px] font-extrabold text-[var(--ink)]">
                  {pickText(a.titleGu, a.titleEn, lang)}
                </h3>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[11.5px] font-semibold text-[var(--faint)]">
                    {a.startDateISO || a.endDateISO ? (
                      <>
                        {a.startDateISO && formatDateDMY(a.startDateISO)}
                        {a.startDateISO && a.endDateISO && " – "}
                        {a.endDateISO && (
                          <span className={endDateUrgencyClass(a.endDateISO)}>
                            {formatDateDMY(a.endDateISO)}
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                    <span className="mx-1">&middot;</span>
                    {tf(a.photos === 1 ? "gal.photoOne" : "gal.photoMany", {
                      n: a.photos,
                    })}
                    {a.youtubeUrl ? ` · ${t("gal.video")}` : ""}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                      a.isVisible
                        ? "bg-[var(--success-tint)] text-[var(--success)]"
                        : expired
                          ? "bg-[var(--danger-tint)] text-[var(--danger)]"
                          : "bg-[var(--line-soft)] text-[var(--muted)]",
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--line-soft)] pt-3">
                  <ActionBtn
                    icon={Upload}
                    label={t("gal.uploadManage")}
                    onClick={() => openEdit(a)}
                  />
                  <ActionBtn
                    icon={a.isVisible ? EyeOff : Eye}
                    label={a.isVisible ? t("gal.hide") : t("gal.show")}
                    tone={a.isVisible ? "warn" : "success"}
                    onClick={() => toggleVisible(a)}
                  />
                  <ActionBtn
                    icon={Trash2}
                    label={t("common.delete")}
                    tone="danger"
                    onClick={() => remove(a.id)}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {filteredRows.length === 0 && (
        <p className="py-10 text-center text-[13px] text-[var(--faint)]">
          {rows.length === 0 ? t("gal.emptyNone") : t("gal.emptyMatch")}
        </p>
      )}

      <AdminModal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t("gal.editAlbum") : t("gal.newAlbum")}
        subtitle={t("gal.modalSubtitle")}
        width="xl"
        footer={
          <AdminModalActions
            onSave={saveAlbum}
            onCancel={() => setDraft(null)}
            saveLabel={draft?.id ? t("gal.saveAlbum") : t("gal.create")}
            cancelLabel={t("common.cancel")}
            busy={busy}
          />
        }
      >
        {draft && (
          /* Wide screens split the form: details on the left, images on the
             right. Below `lg` it collapses back to one column. */
          <div className="grid gap-x-6 lg:grid-cols-2">
            <div className="min-w-0">
              <AdminField label={t("gal.folderNameEn")}>
                <AdminInput
                  speech
                  value={draft.titleEn}
                  placeholder={t("gal.folderNamePlaceholder")}
                  onChange={(v) => {
                    setDraft((d) => (d ? { ...d, titleEn: v } : d));
                    fromEn(v, (gu) =>
                      setDraft((d) => (d ? { ...d, titleGu: gu } : d)),
                    );
                  }}
                />
              </AdminField>

              <AdminField label={t("gal.folderNameGu")} required>
                <AdminInput
                  gujarati
                  value={draft.titleGu}
                  placeholder={t("gal.folderNamePlaceholder")}
                  onChange={(v) => {
                    setDraft((d) => (d ? { ...d, titleGu: v } : d));
                    guInput(
                      v,
                      (gu) => setDraft((d) => (d ? { ...d, titleGu: gu } : d)),
                      "title:gu",
                    );
                  }}
                />
              </AdminField>

              <AdminFormRow>
                <AdminField label={t("gal.startDate")}>
                  <DateField
                    variant="admin"
                    value={draft.startDate}
                    min={draft.id ? undefined : todayISO()}
                    onChange={(v) => setDraft({ ...draft, startDate: v })}
                  />
                </AdminField>
                <AdminField
                  label={t("gal.endDate")}
                  hint={t("gal.endDateHint")}
                >
                  <DateField
                    variant="admin"
                    value={draft.endDate}
                    min={draft.startDate || (draft.id ? undefined : todayISO())}
                    onChange={(v) => setDraft({ ...draft, endDate: v })}
                  />
                </AdminField>
              </AdminFormRow>

              <AdminField label={t("gal.accentColor")}>
                <AdminColorSelect
                  value={draft.accent}
                  onChange={(v) => setDraft({ ...draft, accent: v })}
                  className="w-full"
                  options={accents}
                />
              </AdminField>

              <AdminField label={t("gal.descEn")}>
                <AdminInput
                  speech
                  multiline
                  value={draft.descriptionEn}
                  placeholder={t("gal.descPlaceholder")}
                  onChange={(v) => {
                    setDraft((d) => (d ? { ...d, descriptionEn: v } : d));
                    fromEn(
                      v,
                      (gu) =>
                        setDraft((d) => (d ? { ...d, description: gu } : d)),
                      "desc",
                    );
                  }}
                />
              </AdminField>

              <AdminField label={t("gal.descGu")}>
                <AdminInput
                  gujarati
                  multiline
                  value={draft.description}
                  placeholder={t("gal.descPlaceholder")}
                  onChange={(v) => setDraft({ ...draft, description: v })}
                />
              </AdminField>

              <AdminField label={t("gal.status")}>
                <AdminSegmented
                  value={draft.isVisible ? "active" : "hidden"}
                  onChange={(v) =>
                    setDraft({ ...draft, isVisible: v === "active" })
                  }
                  options={[
                    { value: "active", label: t("gal.active") },
                    { value: "hidden", label: t("gal.hidden") },
                  ]}
                />
              </AdminField>
            </div>

            <div className="min-w-0">
              <AdminField label={t("gal.coverImage")}>
                <AdminFilePicker
                  value={draft.coverUrl}
                  folder="gallery"
                  hint={t("gal.coverHint")}
                  onChange={(url) =>
                    setDraft((d) => (d ? { ...d, coverUrl: url } : d))
                  }
                />
              </AdminField>

              <AdminField
                label={tf("gal.photosCount", { n: draft.images.length })}
              >
                <AdminMultiImagePicker
                  images={draft.images}
                  onChange={(next) =>
                    setDraft((d) => (d ? { ...d, images: next } : d))
                  }
                />
              </AdminField>

              <AdminField label={t("gal.youtubeUrl")}>
                <AdminInput
                  value={draft.youtubeUrl}
                  onChange={(v) => setDraft({ ...draft, youtubeUrl: v })}
                />
              </AdminField>

              {error && (
                <p className="text-[12.5px] font-semibold text-[var(--danger)]">
                  {error}
                </p>
              )}
            </div>
          </div>
        )}
      </AdminModal>

      <AdminModal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview ? pickText(preview.titleGu, preview.titleEn, lang) : ""}
        subtitle={t("gal.previewSubtitle")}
        width="lg"
      >
        {preview && (
          <div className="overflow-hidden rounded-2xl border border-[var(--line-admin)]">
            <div
              className="flex h-[160px] items-center justify-center overflow-hidden text-white"
              style={{ background: accentGradient(preview.accent) }}
            >
              {preview.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.coverUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="size-11" strokeWidth={1.6} />
              )}
            </div>
            <div className="p-4">
              {(() => {
                const expired = isExpired(preview.endDateISO);
                const statusLabel = preview.isVisible
                  ? t("gal.visible")
                  : expired
                    ? t("gal.expired")
                    : t("gal.hidden");
                return (
                  <span
                    className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                      preview.isVisible
                        ? "bg-[var(--success-tint)] text-[var(--success)]"
                        : expired
                          ? "bg-[var(--danger-tint)] text-[var(--danger)]"
                          : "bg-[var(--line-soft)] text-[var(--muted)]",
                    )}
                  >
                    {statusLabel}
                  </span>
                );
              })()}
              <h3 className="mt-2 font-[family-name:var(--font-noto-serif-gujarati)] text-lg font-bold text-[var(--ink)]">
                {pickText(preview.titleGu, preview.titleEn, lang)}
              </h3>
              <p className="mt-1 text-[11.5px] font-semibold text-[var(--faint)]">
                {preview.startDateISO || preview.endDateISO ? (
                  <>
                    {preview.startDateISO &&
                      formatDateDMY(preview.startDateISO)}
                    {preview.startDateISO && preview.endDateISO && " – "}
                    {preview.endDateISO && (
                      <span className={endDateUrgencyClass(preview.endDateISO)}>
                        {formatDateDMY(preview.endDateISO)}
                      </span>
                    )}
                  </>
                ) : (
                  "—"
                )}
                <span className="mx-1">&middot;</span>
                {tf(preview.photos === 1 ? "gal.photoOne" : "gal.photoMany", {
                  n: preview.photos,
                })}
              </p>
              {preview.description && (
                <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                  {preview.description}
                </p>
              )}

              {preview.images.length === 0 ? (
                <p className="mt-4 py-6 text-center text-[13px] text-[var(--faint)]">
                  {t("gal.noPhotos")}
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {preview.images.map((img, i) => (
                    <div
                      key={`${img.imageUrl}-${i}`}
                      className="relative overflow-hidden rounded-[10px] border border-[var(--line)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.imageUrl}
                        alt={img.caption || ""}
                        className="h-16 w-full object-cover"
                      />
                      <a
                        href={img.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t("gal.viewPhoto")}
                        title={t("gal.viewPhoto")}
                        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/55 text-white"
                      >
                        <Eye className="size-3" strokeWidth={2.3} />
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {preview.youtubeUrl && (
                <a
                  href={preview.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--line-admin)] p-3"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--info-tint)] text-[var(--info)]">
                    <ImageIcon className="size-[18px]" strokeWidth={1.85} />
                  </div>
                  <span className="text-[13px] font-bold text-[var(--ink)]">
                    {t("gal.watchVideo")}
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
