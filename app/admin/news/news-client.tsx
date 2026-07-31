"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Eye,
  EyeOff,
  FileText,
  Pencil,
  Pin,
  Plus,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  ActionBtn,
  AdminBtn,
  AdminH2,
  AdminInput,
  AdminLabel,
  AdminSelect,
  FilterButton,
  PillActive,
  PillWarning,
  SearchInput,
} from "@/components/admin/admin-ui";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import {
  AdminCheck,
  AdminField,
  AdminFilePicker,
  AdminFormRow,
  AdminModal,
  AdminModalActions,
  AdminSegmented,
} from "@/components/admin/admin-form";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SpeechTextarea } from "@/components/ui/speech-input";
import { toast } from "sonner";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { formatDateDMY, pickText } from "@/lib/format";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import { DateField } from "@/components/ui/date-field";
import { useAdminT } from "@/lib/i18n/admin-dictionary";

/** Pill used for the Pinned/Notify columns — makes the current state and the
 * click action unambiguous (plain icon-only buttons read as decoration, not
 * controls). */
function StatusPillButton({
  icon: Icon,
  active,
  activeLabel,
  inactiveLabel,
  activeTitle,
  inactiveTitle,
  onClick,
  disabled,
  tone = "warn",
}: {
  icon: LucideIcon;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeTitle: string;
  inactiveTitle: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "warn" | "info";
}) {
  const activeClass = {
    warn: "border-[var(--gold-tint)] bg-[var(--gold-tint)] text-[var(--warn)]",
    info: "border-[var(--info-tint)] bg-[var(--info-tint)] text-[var(--info)]",
  }[tone];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={active ? activeTitle : inactiveTitle}
      aria-label={active ? activeTitle : inactiveTitle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors",
        active
          ? activeClass
          : "border-dashed border-[var(--line-admin)] text-[var(--faint)] hover:border-[var(--line-strong)] hover:text-[var(--ink-mid)]",
        disabled ? "cursor-default" : "cursor-pointer",
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.3} />
      {active ? activeLabel : inactiveLabel}
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
  const { t, lang } = useAdminT();
  const { fromEn, guInput } = useTranslitSync();
  const [rows, setRows] = useState<NewsRow[]>(initialRows);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<NewsRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const statusFilterOptions = [
    { value: "all", label: t("news.filterAll") },
    { value: "published", label: t("news.statusPublished") },
    { value: "draft", label: t("news.statusDraft") },
  ];

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (statusFilter === "published" && !r.isPublished) return false;
      if (statusFilter === "draft" && r.isPublished) return false;

      if (!term) return true;
      return (
        r.titleEn.toLowerCase().includes(term) ||
        (r.titleGu || "").toLowerCase().includes(term)
      );
    });
  }, [rows, q, statusFilter]);

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
      setError(t("news.errRequired"));
      return;
    }
    setBusy(true);
    setError(null);

    if (draft.id) {
      // Sent as-is, not `|| undefined`: a blank field is the admin removing the
      // cover image / PDF / Gujarati text, and the API stores that as NULL.
      const res = await api.put<NewsRow>(`/api/news/${draft.id}`, {
        titleEn: draft.titleEn,
        titleGu: draft.titleGu,
        contentEn: draft.contentEn,
        contentGu: draft.contentGu,
        imageUrl: draft.imageUrl,
        documentUrl: draft.documentUrl,
        documentName: draft.documentUrl ? draft.documentName : "",
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
                documentUrl: draft.documentUrl || null,
                documentName: draft.documentUrl ? draft.documentName || null : null,
                isPinned: draft.isPinned,
                isPublished: draft.isPublished,
                publishedAtISO: draft.publishDate
                  ? new Date(draft.publishDate).toISOString()
                  : r.publishedAtISO,
                publishedAt: draft.publishDate
                  ? formatDateDMY(draft.publishDate)
                  : r.publishedAt,
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
          publishedAt: formatDateDMY(draft.publishDate || new Date().toISOString()),
        },
        ...prev,
      ]);
    }
    setDraft(null);
    toast.success(draft.id ? t("news.toastUpdated") : t("news.toastCreated"));
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: t("news.confirmDeleteTitle"),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    const res = await api.del(`/api/news/${id}`);
    if (!res.ok) {
      toast.error(res.error || t("news.errDelete"));
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success(t("news.toastDeleted"));
  }

  /** Optimistic row-level flag flip, rolled back if the API rejects it. */
  async function toggleFlag(
    row: NewsRow,
    field: "isPinned" | "isPublished",
    messages: { on: string; off: string },
  ) {
    const next = !row[field];
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [field]: next } : r)));
    const res = await api.put(`/api/news/${row.id}`, { [field]: next });
    if (!res.ok) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [field]: !next } : r)));
      toast.error(res.error || t("news.errUpdate"));
      return;
    }
    toast.success(next ? messages.on : messages.off);
  }

  const togglePinned = (row: NewsRow) =>
    toggleFlag(row, "isPinned", { on: t("news.toastPinned"), off: t("news.toastUnpinned") });
  const togglePublished = (row: NewsRow) =>
    toggleFlag(row, "isPublished", {
      on: t("news.toastPublished"),
      off: t("news.toastUnpublished"),
    });

  /** One-way — a push notification can't be un-sent, so this never toggles back off. */
  async function notifyNow(row: NewsRow) {
    if (row.notificationSent) return;
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, notificationSent: true } : r)),
    );
    const res = await api.put(`/api/news/${row.id}`, { sendNotification: true });
    if (!res.ok) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, notificationSent: false } : r)),
      );
      toast.error(res.error || t("news.errNotify"));
      return;
    }
    toast.success(t("news.toastNotified"));
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminH2 className="mb-0 shrink-0" info={<>{t("news.info")}</>}>
          {t("nav.news")}
        </AdminH2>

        <div className="flex w-full items-center gap-3 md:w-auto">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={t("news.searchPlaceholder")}
            className="min-w-0 flex-1 md:w-[260px] md:flex-none"
          />
          <FilterButton
            className="md:hidden"
            active={statusFilter !== "all"}
            onClick={() => setFiltersOpen(true)}
          />
          <div className="hidden items-center gap-3 md:flex">
            <AdminSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "all" | "published" | "draft")}
              options={statusFilterOptions}
              className="w-[150px] shrink-0"
              ariaLabel={t("news.filterByStatus")}
            />
            <AdminBtn className="shrink-0" onClick={openNew}>
              <Plus className="size-4" />
              {t("news.newPost")}
            </AdminBtn>
          </div>
        </div>
        <AdminBtn className="w-full justify-center md:hidden" onClick={openNew}>
          <Plus className="size-4" />
          {t("news.newPost")}
        </AdminBtn>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>{t("news.filters")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div>
              <AdminLabel>{t("news.status")}</AdminLabel>
              <AdminSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as "all" | "published" | "draft")}
                options={statusFilterOptions}
                className="w-full"
                ariaLabel={t("news.filterByStatus")}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AdminDataTable
        rows={filteredRows}
        rowKey={(n) => n.id}
        empty={
          <p className="py-8 text-center text-[13px] text-[var(--faint)]">
            {t("news.emptyFiltered")}
          </p>
        }
        columns={[
          {
            key: "title",
            header: t("news.colTitle"),
            primary: true,
            tdClassName: "font-semibold text-[var(--ink)]",
            cell: (n) => pickText(n.titleGu, n.titleEn, lang),
          },
          {
            key: "date",
            header: t("news.colDate"),
            tdClassName: "whitespace-nowrap",
            cell: (n) => n.publishedAt,
          },
          {
            key: "status",
            header: t("news.status"),
            badge: true,
            cell: (n) =>
              n.isPublished ? (
                <PillActive>{t("news.statusPublished")}</PillActive>
              ) : (
                <PillWarning>{t("news.statusDraft")}</PillWarning>
              ),
          },
          {
            key: "cover",
            header: t("news.colCover"),
            // A 52px thumbnail adds nothing to a card that already has the title.
            desktopOnly: true,
            cell: (n) =>
              n.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={n.imageUrl}
                  alt=""
                  className="h-8 w-[52px] rounded-md border border-[var(--line)] object-cover"
                />
              ) : (
                <span className="text-[var(--faint)]">—</span>
              ),
          },
          {
            key: "pdf",
            header: t("news.colPdf"),
            cell: (n) => (
              <HasCell
                on={!!n.documentUrl}
                href={n.documentUrl}
                label={n.documentName || t("news.colPdf")}
              />
            ),
          },
          {
            key: "pinned",
            header: t("news.pinned"),
            cell: (n) => (
              <StatusPillButton
                icon={Pin}
                active={n.isPinned}
                activeLabel={t("news.pinned")}
                inactiveLabel={t("news.pin")}
                activeTitle={t("news.unpinHint")}
                inactiveTitle={t("news.pinHint")}
                onClick={() => togglePinned(n)}
                tone="warn"
              />
            ),
          },
          {
            key: "notify",
            header: t("news.colNotify"),
            cell: (n) => (
              <StatusPillButton
                icon={Bell}
                active={n.notificationSent}
                activeLabel={t("news.sent")}
                inactiveLabel={t("news.notify")}
                activeTitle={t("news.notifySentHint")}
                inactiveTitle={t("news.notifyHint")}
                onClick={() => notifyNow(n)}
                disabled={n.notificationSent}
                tone="info"
              />
            ),
          },
          {
            key: "actions",
            header: t("news.colActions"),
            actions: true,
            cell: (n) => (
              <span className="flex flex-wrap gap-1.5 md:justify-end">
                <ActionBtn icon={Eye} label={t("news.preview")} onClick={() => setPreview(n)} />
                <ActionBtn
                  icon={n.isPublished ? EyeOff : Send}
                  label={n.isPublished ? t("news.unpublish") : t("news.publish")}
                  tone={n.isPublished ? "warn" : "success"}
                  onClick={() => togglePublished(n)}
                />
                <ActionBtn icon={Pencil} label={t("common.edit")} onClick={() => openEdit(n)} />
                <ActionBtn
                  icon={Trash2}
                  label={t("common.delete")}
                  tone="danger"
                  onClick={() => remove(n.id)}
                />
              </span>
            ),
          },
        ]}
      />

      {filteredRows.length === 0 && (
        <p className="py-6 text-center text-[11.5px] text-[var(--faint)]">
          {rows.length === 0 ? t("news.emptyNone") : t("news.emptyMatch")}
        </p>
      )}

      <AdminModal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t("news.editPost") : t("news.newPost")}
        subtitle={t("news.modalSubtitle")}
        footer={
          <AdminModalActions
            onSave={save}
            onCancel={() => setDraft(null)}
            busy={busy}
            saveLabel={t("common.save")}
            cancelLabel={t("common.cancel")}
          />
        }
      >
        {draft && (
          <>
            <AdminField label={t("news.titleGu")} required>
              <AdminInput
                gujarati
                value={draft.titleGu}
                onChange={(v) => {
                  setDraft((d) => (d ? { ...d, titleGu: v } : d));
                  guInput(v, (gu) => setDraft((d) => (d ? { ...d, titleGu: gu } : d)), "title:gu");
                }}
              />
            </AdminField>

            <AdminField label={t("news.titleEn")}>
              <AdminInput
                speech
                value={draft.titleEn}
                onChange={(v) => {
                  setDraft((d) => (d ? { ...d, titleEn: v } : d));
                  fromEn(v, (gu) => setDraft((d) => (d ? { ...d, titleGu: gu } : d)), "title");
                }}
              />
            </AdminField>

            <AdminFormRow>
              <AdminField label={t("news.colDate")}>
                <DateField
                  variant="admin"
                  value={draft.publishDate}
                  onChange={(v) => setDraft({ ...draft, publishDate: v })}
                />
              </AdminField>
              {/* Read-only: the author is the admin who posted, taken from the
                  session — News has no free-text author column to save into. */}
              <AdminField label={t("news.author")} hint={t("news.authorHint")}>
                <div className="flex min-h-[42px] items-center rounded-xl border border-[var(--line-admin)] bg-[var(--surface-admin)] px-3.5 text-[13px] font-semibold text-[var(--ink-dim)]">
                  {draft.author || t("news.defaultAuthor")}
                </div>
              </AdminField>
            </AdminFormRow>

            <AdminField label={t("news.descGu")} required>
              <Textarea
                value={draft.contentGu}
                placeholder={t("news.descPlaceholder")}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => (d ? { ...d, contentGu: v } : d));
                  guInput(v, (gu) => setDraft((d) => (d ? { ...d, titleGu: gu } : d)), "title:gu");
                }}
                className="min-h-[80px] border-[var(--line-field)] bg-[var(--field)] text-[13px]"
              />
            </AdminField>

            <AdminField label={t("news.descEn")}>
              {/* Same classes as the shadcn <Textarea> base, with `px-2.5` split to
                  `pl-2.5` so SpeechTextarea's `pr-11` mic gutter survives the merge. */}
              <SpeechTextarea
                value={draft.contentEn}
                placeholder={t("news.descPlaceholder")}
                onChange={(v) => {
                  setDraft((d) => (d ? { ...d, contentEn: v } : d));
                  fromEn(v, (gu) => setDraft((d) => (d ? { ...d, contentGu: gu } : d)), "content");
                }}
                textareaClassName="flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent pl-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 min-h-[80px] border-[var(--line-field)] bg-[var(--field)] text-[13px]"
              />
            </AdminField>

            <AdminField label={t("news.status")}>
              <AdminSegmented
                value={draft.isPublished ? "published" : "draft"}
                onChange={(v) => setDraft({ ...draft, isPublished: v === "published" })}
                options={[
                  { value: "draft", label: t("news.statusDraft") },
                  { value: "published", label: t("news.statusPublished") },
                ]}
              />
            </AdminField>

            <AdminField label={t("news.coverImage")}>
              <AdminFilePicker
                value={draft.imageUrl}
                folder="news"
                hint={t("news.coverHint")}
                onChange={(url) => setDraft((d) => (d ? { ...d, imageUrl: url } : d))}
              />
            </AdminField>

            <AdminField label={t("news.pdfAttachment")}>
              <AdminFilePicker
                value={draft.documentUrl}
                accept="application/pdf"
                folder="news"
                label={t("news.chooseFile")}
                preview={false}
                onChange={(url) => setDraft((d) => (d ? { ...d, documentUrl: url } : d))}
              />
            </AdminField>

            {draft.documentUrl && (
              <AdminField label={t("news.pdfLabel")} hint={t("news.pdfLabelHint")}>
                <AdminInput
                  value={draft.documentName}
                  onChange={(v) => setDraft({ ...draft, documentName: v })}
                />
              </AdminField>
            )}

            <div className="flex flex-wrap gap-5">
              <AdminCheck
                checked={draft.isPinned}
                label={t("news.pinToTop")}
                onChange={(v) => setDraft({ ...draft, isPinned: v })}
              />
              {!draft.id && (
                <AdminCheck
                  checked={draft.sendNotification}
                  label={t("news.sendNotification")}
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
        title={t("news.preview")}
        subtitle={t("news.previewSubtitle")}
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
                    📌 {t("news.pinned")}
                  </span>
                )}
                {preview.isPublished ? (
                  <PillActive>{t("news.statusPublished")}</PillActive>
                ) : (
                  <PillWarning>{t("news.statusDraft")}</PillWarning>
                )}
              </div>
              <h3 className="mt-2 font-[family-name:var(--font-noto-serif-gujarati)] text-lg font-bold text-[var(--ink)]">
                {pickText(preview.titleGu, preview.titleEn, lang)}
              </h3>
              <p className="mt-1 text-[11.5px] font-semibold text-[var(--faint)]">
                {preview.publishedAt}
                {preview.author ? ` · ${preview.author}` : ""}
              </p>
              <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                {pickText(preview.contentGu, preview.contentEn, lang)}
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
                    {preview.documentName || t("news.viewDocument")}
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
