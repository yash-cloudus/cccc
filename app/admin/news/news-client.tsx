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
  AdminTable,
  AdminTd,
  AdminTh,
  FilterButton,
  PillActive,
  PillWarning,
  SearchInput,
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
import { formatDateDMY } from "@/lib/format";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";

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

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All posts" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

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
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

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
      setError("Title and content (English) are required");
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
    toast.success(draft.id ? "Post updated" : "Post created");
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: "Delete this post?",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await api.del(`/api/news/${id}`);
    if (!res.ok) {
      toast.error(res.error || "Could not delete");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Post deleted");
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
      toast.error(res.error || "Could not update");
      return;
    }
    toast.success(next ? messages.on : messages.off);
  }

  const togglePinned = (row: NewsRow) =>
    toggleFlag(row, "isPinned", { on: "Pinned to top", off: "Unpinned" });
  const togglePublished = (row: NewsRow) =>
    toggleFlag(row, "isPublished", { on: "Published", off: "Unpublished" });

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
      toast.error(res.error || "Could not send notification");
      return;
    }
    toast.success("Notification sent");
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminH2
          className="mb-0 shrink-0"
          info={
            <>
              &quot;Send notification&quot; pushes an in-app alert to all approved members. Use for
              important updates only.
            </>
          }
        >
          News
        </AdminH2>

        <div className="flex w-full items-center gap-3 md:w-auto">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search news…"
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
              options={STATUS_FILTER_OPTIONS}
              className="w-[150px] shrink-0"
              ariaLabel="Filter by status"
            />
            <AdminBtn className="shrink-0" onClick={openNew}>
              <Plus className="size-4" />
              New post
            </AdminBtn>
          </div>
        </div>
        <AdminBtn className="w-full justify-center md:hidden" onClick={openNew}>
          <Plus className="size-4" />
          New post
        </AdminBtn>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div>
              <AdminLabel>Status</AdminLabel>
              <AdminSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as "all" | "published" | "draft")}
                options={STATUS_FILTER_OPTIONS}
                className="w-full"
                ariaLabel="Filter by status"
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
          {filteredRows.map((n) => (
            <tr key={n.id}>
              <AdminTd className="font-semibold text-[var(--ink)]">
                {n.titleGu || n.titleEn}
              </AdminTd>
              <AdminTd className="whitespace-nowrap">{n.publishedAt}</AdminTd>
              <AdminTd>
                {n.isPublished ? (
                  <PillActive>Published</PillActive>
                ) : (
                  <PillWarning>Draft</PillWarning>
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
                <StatusPillButton
                  icon={Pin}
                  active={n.isPinned}
                  activeLabel="Pinned"
                  inactiveLabel="Pin"
                  activeTitle="Click to unpin"
                  inactiveTitle="Click to pin to top"
                  onClick={() => togglePinned(n)}
                  tone="warn"
                />
              </AdminTd>
              <AdminTd>
                <StatusPillButton
                  icon={Bell}
                  active={n.notificationSent}
                  activeLabel="Sent"
                  inactiveLabel="Notify"
                  activeTitle="Notification already sent"
                  inactiveTitle="Send notification now"
                  onClick={() => notifyNow(n)}
                  disabled={n.notificationSent}
                  tone="info"
                />
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

      {filteredRows.length === 0 && (
        <p className="py-6 text-center text-[11.5px] text-[var(--faint)]">
          {rows.length === 0 ? "No news posts yet." : "No matching posts."}
        </p>
      )}

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
                speech
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
              {/* Read-only: the author is the admin who posted, taken from the
                  session — News has no free-text author column to save into. */}
              <AdminField label="Author" hint="The admin who posted this">
                <div className="flex min-h-[42px] items-center rounded-xl border border-[var(--line-admin)] bg-[var(--surface-admin)] px-3.5 text-[13px] font-semibold text-[var(--ink-dim)]">
                  {draft.author || "સમાજ એડમિન"}
                </div>
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
              {/* Same classes as the shadcn <Textarea> base, with `px-2.5` split to
                  `pl-2.5` so SpeechTextarea's `pr-11` mic gutter survives the merge. */}
              <SpeechTextarea
                value={draft.contentEn}
                placeholder="News description…"
                onChange={(v) => {
                  setDraft((d) => (d ? { ...d, contentEn: v } : d));
                  fromEn(v, (gu) => setDraft((d) => (d ? { ...d, contentGu: gu } : d)), "content");
                }}
                textareaClassName="flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent pl-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 min-h-[80px] border-[var(--line-field)] bg-[var(--field)] text-[13px]"
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
                  <PillWarning>Draft</PillWarning>
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
