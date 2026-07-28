"use client";

import { useCallback, useEffect, useState, Fragment } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AdminBtn,
  AdminInput,
  AdminLabel,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminToggle,
  LinkAction,
} from "@/components/admin/admin-ui";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/http";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import {
  type OccupationTreeNode,
  DEFAULT_DIPLOMA_FIELDS,
  DEFAULT_STREAMS,
  buildOccupationTree,
  choiceLabel,
  findOccupationNodeById,
  isDiplomaLevel,
  isStreamLevel,
} from "@/lib/occupation-defaults";
import { cn } from "@/lib/utils";

type FlatRow = {
  id: string;
  nameEn: string;
  nameGu: string;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null;
};

type EditState = { id: string | null; parentId: string | null; nameEn: string; nameGu: string } | null;

function SubRow({
  node,
  depth,
  onEdit,
  onToggle,
  onDelete,
  onAddChild,
}: {
  node: OccupationTreeNode;
  depth: number;
  onEdit: (node: OccupationTreeNode) => void;
  onToggle: (node: OccupationTreeNode) => void;
  onDelete: (node: OccupationTreeNode) => void;
  onAddChild?: (parentId: string) => void;
}) {
  const showStreams = isStreamLevel(node.nameEn);
  const showFields = isDiplomaLevel(node.nameEn);

  return (
    <div className={cn(depth > 0 && "ml-4 border-l border-[var(--line-soft)] pl-3")}>
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line-admin)] bg-white px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-[var(--ink)]">{node.nameEn}</div>
          <div className="text-[12px] text-[var(--faint)]">{node.nameGu}</div>
        </div>
        <AdminToggle
          on={node.isActive}
          label={`${node.nameEn} enabled`}
          onChange={() => onToggle(node)}
        />
        <LinkAction onClick={() => onEdit(node)}>edit</LinkAction>
        {onAddChild && (
          <LinkAction onClick={() => onAddChild(node.id)}>+ nested</LinkAction>
        )}
        <LinkAction danger onClick={() => onDelete(node)}>
          delete
        </LinkAction>
      </div>

      {showStreams && node.children.length > 0 && (
        <div className="mb-2">
          <div className="mb-1.5 text-[10.5px] font-extrabold tracking-wide text-[var(--faint)] uppercase">
            Streams · પ્રવાહ
          </div>
          {node.children.map((c) => (
            <SubRow
              key={c.id}
              node={c}
              depth={depth + 1}
              onEdit={onEdit}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {showFields && node.children.length > 0 && (
        <div className="mb-2">
          <div className="mb-1.5 text-[10.5px] font-extrabold tracking-wide text-[var(--faint)] uppercase">
            Diploma fields · ક્ષેત્ર
          </div>
          {node.children.map((c) => (
            <SubRow
              key={c.id}
              node={c}
              depth={depth + 1}
              onEdit={onEdit}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {!showStreams && !showFields && node.children.length > 0 && (
        <div className="mb-2 space-y-2">
          {node.children.map((c) => (
            <SubRow
              key={c.id}
              node={c}
              depth={depth + 1}
              onEdit={onEdit}
              onToggle={onToggle}
              onDelete={onDelete}
              onAddChild={
                isStreamLevel(c.nameEn) || isDiplomaLevel(c.nameEn) ? undefined : onAddChild
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Maroon full-width buttons for Std 11/12 streams (Science · Commerce · Arts)
 * and Diploma fields — same visual language as "+ Add sub-category".
 */
function QuickOptionButtons({
  defaults,
  existing,
  busyKey,
  onAdd,
  onEdit,
  onDelete,
}: {
  defaults: readonly { nameEn: string; nameGu: string; sortOrder: number }[];
  existing: OccupationTreeNode[];
  busyKey: string | null;
  onAdd: (opt: { nameEn: string; nameGu: string; sortOrder: number }) => void;
  onEdit: (node: OccupationTreeNode) => void;
  onDelete: (node: OccupationTreeNode) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {defaults.map((opt) => {
        const node = existing.find(
          (c) => c.nameEn.toLowerCase() === opt.nameEn.toLowerCase(),
        );
        const adding = busyKey === opt.nameEn;
        if (node) {
          return (
            <div
              key={opt.nameEn}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] px-[18px] py-[11px] text-white"
            >
              <Check className="size-4 shrink-0" strokeWidth={2.5} />
              <div className="min-w-0 flex-1 text-left">
                <div className="text-[13px] font-bold">{opt.nameEn}</div>
                <div className="text-[11.5px] font-semibold opacity-90">{opt.nameGu}</div>
              </div>
              <button
                type="button"
                onClick={() => onEdit(node)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11.5px] font-bold hover:bg-white/25"
              >
                <Pencil className="size-3.5" />
                edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(node)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-black/15 px-2.5 py-1.5 text-[11.5px] font-bold hover:bg-black/25"
              >
                <Trash2 className="size-3.5" />
                delete
              </button>
            </div>
          );
        }
        return (
          <AdminBtn
            key={opt.nameEn}
            className="w-full justify-center"
            disabled={adding}
            onClick={() => onAdd(opt)}
          >
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {opt.nameEn} · {opt.nameGu}
          </AdminBtn>
        );
      })}
    </div>
  );
}

/** Inline nested editor — cards (drawer) or nested table (expandable rows). */
export function OccupationNestedPanel({
  root,
  active = true,
  variant = "cards",
  onChanged,
}: {
  root: { id: string; nameEn: string; nameGu: string };
  /** When false, skip loading (e.g. drawer closed). */
  active?: boolean;
  /** `table` = accordion nested table; `cards` = drawer / maroon buttons. */
  variant?: "cards" | "table";
  onChanged?: () => void;
}) {
  const { fromEn, guInput } = useTranslitSync();
  const [tree, setTree] = useState<OccupationTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<EditState>(null);
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Deeper expand inside table variant (e.g. College → B.Tech → branches). */
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);

  const isStreamRoot = isStreamLevel(root.nameEn);
  const isDiplomaRoot = isDiplomaLevel(root.nameEn);
  const isQuickPickRoot = isStreamRoot || isDiplomaRoot;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<FlatRow[]>("/api/admin/dropdowns?type=occupation");
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Could not load sub-categories");
      return;
    }
    const full = buildOccupationTree(res.data);
    // Std 11/12 live under Student — must search the whole tree, not only roots.
    const node = findOccupationNodeById(full, root.id);
    setTree(node?.children ?? []);
  }, [root.id]);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  function openEdit(parentId: string | null, row?: OccupationTreeNode) {
    setError(null);
    setEdit({
      id: row?.id ?? null,
      parentId,
      nameEn: row?.nameEn ?? "",
      nameGu: row?.nameGu ?? "",
    });
  }

  async function createChild(opt: { nameEn: string; nameGu: string; sortOrder: number }) {
    setBusyKey(opt.nameEn);
    const res = await api.post("/api/admin/dropdowns", {
      type: "occupation",
      nameEn: opt.nameEn,
      nameGu: opt.nameGu,
      parentId: root.id,
      sortOrder: opt.sortOrder,
    });
    setBusyKey(null);
    if (!res.ok) {
      toast.error(res.error || "Could not add");
      return;
    }
    await load();
    onChanged?.();
    toast.success(`${opt.nameEn} added`);
  }

  async function save() {
    if (!edit) return;
    if (!edit.nameEn.trim() || !edit.nameGu.trim()) {
      setError("Both English and ગુજરાતી are required");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      type: "occupation",
      nameEn: edit.nameEn.trim(),
      nameGu: edit.nameGu.trim(),
      parentId: edit.parentId ?? root.id,
    };
    const res = edit.id
      ? await api.patch("/api/admin/dropdowns", { id: edit.id, ...payload })
      : await api.post("/api/admin/dropdowns", payload);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEdit(null);
    await load();
    onChanged?.();
    toast.success(edit.id ? "Sub-category updated" : "Sub-category added");
  }

  async function toggleActive(node: OccupationTreeNode) {
    const next = !node.isActive;
    const res = await api.patch("/api/admin/dropdowns", { id: node.id, isActive: next });
    if (!res.ok) {
      toast.error(res.error || "Could not change status");
      return;
    }
    await load();
    onChanged?.();
  }

  async function remove(node: OccupationTreeNode) {
    const ok = await confirmDialog({
      title: `Delete “${node.nameEn}”?`,
      description: "Nested sub-categories will also be removed.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await api.del(`/api/admin/dropdowns?id=${node.id}`);
    if (!res.ok) {
      toast.error(res.error || "Could not delete");
      return;
    }
    await load();
    onChanged?.();
    toast.success("Deleted");
  }

  async function addAllDefaults() {
    const defaults = isStreamRoot ? DEFAULT_STREAMS : DEFAULT_DIPLOMA_FIELDS;
    const missing = defaults.filter(
      (d) => !tree.some((c) => c.nameEn.toLowerCase() === d.nameEn.toLowerCase()),
    );
    if (missing.length === 0) {
      toast.message("All defaults are already added");
      return;
    }
    setBusy(true);
    for (const opt of missing) {
      const res = await api.post("/api/admin/dropdowns", {
        type: "occupation",
        nameEn: opt.nameEn,
        nameGu: opt.nameGu,
        parentId: root.id,
        sortOrder: opt.sortOrder,
      });
      if (!res.ok) {
        toast.error(res.error || `Could not add ${opt.nameEn}`);
        break;
      }
    }
    setBusy(false);
    await load();
    onChanged?.();
    toast.success("Default options added");
  }

  const sectionTitle = isStreamRoot
    ? "Streams · પ્રવાહ"
    : isDiplomaRoot
      ? "Diploma fields · ડિપ્લોમા ક્ષેત્ર"
      : "Sub-categories";

  if (variant === "table") {
    /** Under Std 11/12 / Diploma, children are leaf streams/fields — no further Nested. */
    const childCanNest = !isQuickPickRoot;

    return (
      <>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-extrabold tracking-wide text-[var(--faint)] uppercase">
            {sectionTitle}
          </div>
          <div className="flex flex-wrap gap-2">
            {isQuickPickRoot && (
              <LinkAction onClick={addAllDefaults}>
                {busy ? "…" : isStreamRoot ? "+ Add all streams" : "+ Add all fields"}
              </LinkAction>
            )}
            <LinkAction onClick={() => openEdit(root.id)}>+ Add</LinkAction>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
          </div>
        ) : (
          <AdminTable bordered={false} className="rounded-xl border border-[var(--line-soft)] bg-white">
            <thead>
              <tr>
                {childCanNest && <AdminTh className="w-10" />}
                <AdminTh>English</AdminTh>
                <AdminTh>ગુજરાતી</AdminTh>
                <AdminTh>Status</AdminTh>
                {childCanNest && <AdminTh>Subs</AdminTh>}
                <AdminTh className="text-right">Actions</AdminTh>
              </tr>
            </thead>
            <tbody>
              {tree.map((node) => {
                const subs = node.children.length;
                const hasSubs = subs > 0;
                const childOpen = expandedChildId === node.id;
                const nestCols = childCanNest ? 6 : 4;
                return (
                  <Fragment key={node.id}>
                    <tr className={cn(childOpen && "bg-[var(--surface-admin)]/50")}>
                      {childCanNest && (
                        <AdminTd className="w-10 pr-0">
                          {hasSubs ? (
                            <button
                              type="button"
                              aria-label={childOpen ? "Collapse" : "Expand"}
                              onClick={() =>
                                setExpandedChildId((prev) => (prev === node.id ? null : node.id))
                              }
                              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-[var(--ink-dim)] hover:bg-[var(--line-soft)]"
                            >
                              {childOpen ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                            </button>
                          ) : (
                            <span className="inline-block size-7" />
                          )}
                        </AdminTd>
                      )}
                      <AdminTd>
                        <span className="font-semibold text-[var(--ink)]">{node.nameEn}</span>
                      </AdminTd>
                      <AdminTd>{node.nameGu}</AdminTd>
                      <AdminTd>
                        <span className="flex items-center gap-2.5">
                          <AdminToggle
                            on={node.isActive}
                            label={`${node.nameEn} enabled`}
                            onChange={() => toggleActive(node)}
                          />
                          <span
                            className={
                              node.isActive
                                ? "text-[12px] font-bold text-[var(--success)]"
                                : "text-[12px] font-bold text-[var(--faint)]"
                            }
                          >
                            {node.isActive ? "Enabled" : "Disabled"}
                          </span>
                        </span>
                      </AdminTd>
                      {childCanNest && (
                        <AdminTd>
                          {hasSubs ? (
                            <span className="text-[13px] font-bold text-[var(--ink)]">{subs}</span>
                          ) : null}
                        </AdminTd>
                      )}
                      <AdminTd className="text-right">
                        <span className="flex flex-wrap justify-end gap-2.5">
                          {childCanNest && (
                            <LinkAction
                              onClick={() =>
                                setExpandedChildId((prev) => (prev === node.id ? null : node.id))
                              }
                            >
                              {childOpen ? "Hide" : "Nested"}
                            </LinkAction>
                          )}
                          <LinkAction onClick={() => openEdit(node.parentId, node)}>edit</LinkAction>
                          <LinkAction danger onClick={() => remove(node)}>
                            delete
                          </LinkAction>
                        </span>
                      </AdminTd>
                    </tr>
                    {childCanNest && childOpen && (
                      <tr className="bg-[var(--surface-admin)]/30">
                        <AdminTd
                          colSpan={nestCols}
                          className="border-b border-[var(--line-admin)] px-4 py-3"
                        >
                          <div className="ml-2 sm:ml-4">
                            <OccupationNestedPanel
                              root={node}
                              variant="table"
                              onChanged={() => {
                                void load();
                                onChanged?.();
                              }}
                            />
                          </div>
                        </AdminTd>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {tree.length === 0 && (
                <tr>
                  <AdminTd
                    colSpan={childCanNest ? 6 : 4}
                    className="py-6 text-center text-[var(--faint)]"
                  >
                    No nested options yet. Use + Add
                    {isQuickPickRoot
                      ? isStreamRoot
                        ? " or + Add all streams"
                        : " or + Add all fields"
                      : ""}
                    .
                  </AdminTd>
                </tr>
              )}
            </tbody>
          </AdminTable>
        )}

        {/* Missing defaults as one-click add chips */}
        {isQuickPickRoot && !loading && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {(isStreamRoot ? DEFAULT_STREAMS : DEFAULT_DIPLOMA_FIELDS)
              .filter(
                (d) => !tree.some((c) => c.nameEn.toLowerCase() === d.nameEn.toLowerCase()),
              )
              .map((opt) => (
                <button
                  key={opt.nameEn}
                  type="button"
                  disabled={busyKey === opt.nameEn}
                  onClick={() => createChild(opt)}
                  className="cursor-pointer rounded-lg border border-dashed border-[var(--brand)]/40 bg-white px-2.5 py-1.5 text-[12px] font-bold text-[var(--brand)] hover:bg-[var(--brand)]/5 disabled:opacity-60"
                >
                  {busyKey === opt.nameEn ? "…" : `+ ${opt.nameEn} · ${opt.nameGu}`}
                </button>
              ))}
          </div>
        )}

        <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-w-[360px] rounded-2xl sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
                {edit?.id ? "Edit" : "Add"} nested option
              </DialogTitle>
            </DialogHeader>
            {edit && (
              <div>
                <AdminLabel>English *</AdminLabel>
                <AdminInput
                  value={edit.nameEn}
                  onChange={(v) => {
                    setEdit((prev) => (prev ? { ...prev, nameEn: v } : prev));
                    fromEn(v, (gu) => setEdit((prev) => (prev ? { ...prev, nameGu: gu } : prev)));
                  }}
                />
                <AdminLabel>ગુજરાતી *</AdminLabel>
                <AdminInput
                  gujarati
                  value={edit.nameGu}
                  onChange={(v) => {
                    setEdit((prev) => (prev ? { ...prev, nameGu: v } : prev));
                    guInput(
                      v,
                      (gu) => setEdit((prev) => (prev ? { ...prev, nameGu: gu } : prev)),
                      "gu",
                    );
                  }}
                />
                {error && (
                  <p className="mt-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>
                )}
                <div className="mt-4 flex gap-2.5">
                  <AdminBtn className="flex-1 justify-center" onClick={save} disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                  </AdminBtn>
                  <AdminBtn
                    variant="ghost"
                    className="flex-1 justify-center"
                    onClick={() => setEdit(null)}
                  >
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

  return (
    <>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
        </div>
      ) : isQuickPickRoot ? (
        <>
          <p className="mb-3 text-[12.5px] font-semibold text-[var(--ink-dim)]">
            {isStreamRoot
              ? "Streams · પ્રવાહ — Science, Commerce, Arts"
              : "Diploma fields · ડિપ્લોમા ક્ષેત્ર"}
          </p>

          <QuickOptionButtons
            defaults={isStreamRoot ? DEFAULT_STREAMS : DEFAULT_DIPLOMA_FIELDS}
            existing={tree}
            busyKey={busyKey}
            onAdd={createChild}
            onEdit={(n) => openEdit(n.parentId, n)}
            onDelete={remove}
          />

          {tree.some(
            (c) =>
              !(isStreamRoot ? DEFAULT_STREAMS : DEFAULT_DIPLOMA_FIELDS).some(
                (d) => d.nameEn.toLowerCase() === c.nameEn.toLowerCase(),
              ),
          ) && (
            <div className="mt-4 space-y-2 border-t border-[var(--line-soft)] pt-4">
              <div className="mb-1.5 text-[10.5px] font-extrabold tracking-wide text-[var(--faint)] uppercase">
                Other custom options
              </div>
              {tree
                .filter(
                  (c) =>
                    !(isStreamRoot ? DEFAULT_STREAMS : DEFAULT_DIPLOMA_FIELDS).some(
                      (d) => d.nameEn.toLowerCase() === c.nameEn.toLowerCase(),
                    ),
                )
                .map((node) => (
                  <SubRow
                    key={node.id}
                    node={node}
                    depth={0}
                    onEdit={(n) => openEdit(n.parentId, n)}
                    onToggle={toggleActive}
                    onDelete={remove}
                  />
                ))}
            </div>
          )}

          <div className="mt-4 flex max-w-md flex-col gap-2.5">
            <AdminBtn className="w-full justify-center" disabled={busy} onClick={addAllDefaults}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {isStreamRoot
                ? "Add all streams (Science · Commerce · Arts)"
                : "Add all default diploma fields"}
            </AdminBtn>
            <AdminBtn
              variant="ghost"
              className="w-full justify-center"
              onClick={() => openEdit(root.id)}
            >
              <Plus className="size-4" />
              Add custom option
            </AdminBtn>
          </div>
        </>
      ) : (
        <>
          <AdminBtn className="mb-4 justify-center" onClick={() => openEdit(root.id)}>
            <Plus className="size-4" />
            Add sub-category
          </AdminBtn>

          {tree.length === 0 ? (
            <p className="py-6 text-[13px] text-[var(--faint)]">
              No sub-categories yet. Add the first one above.
            </p>
          ) : (
            tree.map((node) => (
              <SubRow
                key={node.id}
                node={node}
                depth={0}
                onEdit={(n) => openEdit(n.parentId, n)}
                onToggle={toggleActive}
                onDelete={remove}
                onAddChild={(parentId) => openEdit(parentId)}
              />
            ))
          )}
        </>
      )}

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-[360px] rounded-2xl sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              {edit?.id ? "Edit" : "Add"} sub-category
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <div>
              <AdminLabel>English *</AdminLabel>
              <AdminInput
                value={edit.nameEn}
                onChange={(v) => {
                  setEdit((prev) => (prev ? { ...prev, nameEn: v } : prev));
                  fromEn(v, (gu) => setEdit((prev) => (prev ? { ...prev, nameGu: gu } : prev)));
                }}
              />
              <AdminLabel>ગુજરાતી *</AdminLabel>
              <AdminInput
                gujarati
                value={edit.nameGu}
                onChange={(v) => {
                  setEdit((prev) => (prev ? { ...prev, nameGu: v } : prev));
                  guInput(v, (gu) => setEdit((prev) => (prev ? { ...prev, nameGu: gu } : prev)), "gu");
                }}
              />
              {error && (
                <p className="mt-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>
              )}
              <div className="mt-4 flex gap-2.5">
                <AdminBtn className="flex-1 justify-center" onClick={save} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                </AdminBtn>
                <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setEdit(null)}>
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

/** Side drawer — used only from Occupation tab. */
export function OccupationSubDrawer({
  open,
  root,
  onClose,
  onChanged,
}: {
  open: boolean;
  root: { id: string; nameEn: string; nameGu: string } | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full !max-w-[min(92vw,720px)] overflow-y-auto p-0 sm:!max-w-[720px]"
      >
        <SheetHeader className="border-b border-[var(--line-admin)] px-5 py-4">
          <SheetTitle className="text-base font-extrabold text-[var(--ink)]">
            Sub-categories — {root ? choiceLabel(root) : ""}
          </SheetTitle>
        </SheetHeader>
        <div className="px-5 py-4">
          {root && (
            <OccupationNestedPanel root={root} active={open} onChanged={onChanged} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
