"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AdminBtn,
  AdminH2,
  AdminInput,
  AdminLabel,
  AdminSelect,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminToggle,
  FilterButton,
  FilterChip,
  LinkAction,
  PillWarning,
  SearchInput,
} from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OccupationNestedPanel, OccupationSubDrawer } from "@/components/admin/occupation-sub-drawer";
import { api } from "@/lib/http";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import { isStudentOccupation, isVeparOccupation } from "@/lib/occupation-defaults";
import { cn } from "@/lib/utils";

export type DropdownRow = {
  id: string;
  nameEn: string;
  nameGu: string;
  isActive: boolean;
  inUse: number;
  needsReview?: boolean;
  /** Direct nested children count (Student / Vepar). 0 = hide chevron & leave cell blank. */
  childCount?: number;
};

/** A member's suggestion: added from a member form, not yet enabled by an admin. */
const isPending = (r: DropdownRow) => Boolean(r.needsReview && !r.isActive);

type CategoryId =
  | "surname"
  | "city"
  | "village"
  | "occupation"
  | "student"
  | "vepar"
  | "relationship"
  | "blood";

type Category = {
  id: CategoryId;
  chip: string;
  noun: string;
  api: "surname-groups" | "dropdowns" | "villages" | null;
  hasStatus: boolean;
  occupationChild?: "student" | "vepar";
  readOnlyNote?: string;
  /** DropdownOption.type when api is dropdowns */
  optionType?: string;
};

function categoriesForType(communityType: "PARIVAR" | "GAM"): Category[] {
  const shared: Category[] = [
    {
      id: "occupation",
      chip: "Occupation · વ્યવસાય",
      noun: "Occupation",
      api: "dropdowns",
      hasStatus: true,
      optionType: "occupation",
    },
    {
      id: "student",
      chip: "Student · વિદ્યાર્થી",
      noun: "Education level",
      api: "dropdowns",
      hasStatus: true,
      occupationChild: "student",
      optionType: "occupation",
    },
    {
      id: "vepar",
      chip: "Vepar (Business) · વેપાર",
      noun: "Business type",
      api: "dropdowns",
      hasStatus: true,
      occupationChild: "vepar",
      optionType: "occupation",
    },
    {
      id: "relationship",
      chip: "Relationship · સંબંધ",
      noun: "Relationship",
      api: "dropdowns",
      hasStatus: true,
      optionType: "relationship",
    },
    {
      id: "blood",
      chip: "Blood group · બ્લડ ગ્રુપ",
      noun: "Blood group",
      api: null,
      hasStatus: false,
      readOnlyNote:
        "Blood groups are a fixed medical list shared by every community — they cannot be added, renamed or removed, because member records reference them directly.",
    },
  ];

  if (communityType === "PARIVAR") {
    return [
      {
        id: "city",
        chip: "City · શહેર",
        noun: "City",
        api: "dropdowns",
        hasStatus: true,
        optionType: "city",
      },
      ...shared,
    ];
  }

  return [
    {
      id: "surname",
      chip: "Surname · અટક",
      noun: "Surname",
      api: "surname-groups",
      hasStatus: false,
    },
    {
      id: "village",
      chip: "Village · ગામ",
      noun: "Village",
      api: "villages",
      hasStatus: false,
    },
    ...shared,
  ];
}

type EditState = { id: string | null; nameEn: string; nameGu: string } | null;

export function DropdownsClient({
  communityType,
  lockedSurname,
  initialRows,
  roots,
}: {
  communityType: "PARIVAR" | "GAM";
  lockedSurname: { nameEn: string; nameGu: string } | null;
  initialRows: Record<string, DropdownRow[]>;
  roots: { student: DropdownRow | null; vepar: DropdownRow | null };
}) {
  const categories = useMemo(() => categoriesForType(communityType), [communityType]);
  const { fromEn, guInput } = useTranslitSync();
  const [rows, setRows] = useState<Record<string, DropdownRow[]>>(initialRows);
  const [rootIds, setRootIds] = useState(roots);
  const [catId, setCatId] = useState<CategoryId>(categories[0]?.id ?? "occupation");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [edit, setEdit] = useState<EditState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subDrawer, setSubDrawer] = useState<DropdownRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const cat = categories.find((c) => c.id === catId) ?? categories[0]!;
  const usesExpandRows = catId === "student" || catId === "vepar";
  const visible = useMemo(() => {
    const list = rows[catId] ?? [];
    const needle = q.trim().toLowerCase();
    const found = list.filter((r) => {
      if (cat.hasStatus && statusFilter !== "all") {
        if (statusFilter === "enabled" && !r.isActive) return false;
        if (statusFilter === "disabled" && r.isActive) return false;
      }
      if (needle && !(r.nameEn.toLowerCase().includes(needle) || r.nameGu.toLowerCase().includes(needle))) {
        return false;
      }
      return true;
    });
    // Options a member added float to the top — buried among a hundred rows
    // they would never get approved.
    return [...found].sort((a, b) => Number(isPending(b)) - Number(isPending(a)));
  }, [rows, catId, q, statusFilter, cat.hasStatus]);

  async function refreshChildTab(kind: "student" | "vepar") {
    const root = kind === "student" ? rootIds.student : rootIds.vepar;
    if (!root) return;
    const res = await api.get<
      {
        id: string;
        nameEn: string;
        nameGu: string;
        isActive: boolean;
        parentId: string | null;
        _count?: { children: number };
      }[]
    >(`/api/admin/dropdowns?type=occupation&parentId=${root.id}`);
    if (!res.ok) return;
    setRows((prev) => ({
      ...prev,
      [kind]: res.data.map((o) => ({
        id: o.id,
        nameEn: o.nameEn,
        nameGu: o.nameGu,
        isActive: o.isActive,
        inUse: 0,
        childCount: o._count?.children ?? 0,
      })),
    }));
  }

  const patchRows = (next: (prev: DropdownRow[]) => DropdownRow[]) =>
    setRows((prev) => ({ ...prev, [catId]: next(prev[catId] ?? []) }));

  function openEdit(row?: DropdownRow) {
    setError(null);
    setEdit({ id: row?.id ?? null, nameEn: row?.nameEn ?? "", nameGu: row?.nameGu ?? "" });
  }

  async function ensureOccupationRoot(
    kind: "student" | "vepar",
  ): Promise<DropdownRow | null> {
    const existing = kind === "student" ? rootIds.student : rootIds.vepar;
    if (existing) return existing;

    const payload =
      kind === "student"
        ? { type: "occupation", nameEn: "Student", nameGu: "વિદ્યાર્થી", parentId: null }
        : {
            type: "occupation",
            nameEn: "Vepar (Business)",
            nameGu: "વેપાર",
            parentId: null,
          };

    const res = await api.post<DropdownRow>("/api/admin/dropdowns", payload);
    if (!res.ok) {
      toast.error(res.error || `Could not create ${kind} occupation`);
      return null;
    }
    const root = {
      id: res.data.id,
      nameEn: res.data.nameEn,
      nameGu: res.data.nameGu,
      isActive: true,
      inUse: 0,
    };
    setRootIds((prev) => ({ ...prev, [kind]: root }));
    setRows((prev) => ({
      ...prev,
      occupation: [...(prev.occupation ?? []), root],
    }));
    return root;
  }

  async function save() {
    if (!edit || !cat.api) return;
    if (!edit.nameEn.trim() || !edit.nameGu.trim()) {
      setError("Both English and ગુજરાતી are required");
      return;
    }
    setBusy(true);
    setError(null);

    const url = `/api/admin/${cat.api}`;
    const base = { nameEn: edit.nameEn.trim(), nameGu: edit.nameGu.trim() };

    let payload: Record<string, unknown> = base;
    if (cat.api === "dropdowns") {
      if (cat.occupationChild) {
        const root = await ensureOccupationRoot(cat.occupationChild);
        if (!root) {
          setBusy(false);
          return;
        }
        payload = { ...base, type: "occupation", parentId: root.id };
      } else {
        payload = { ...base, type: cat.optionType ?? catId, parentId: null };
      }
    }

    const res = edit.id
      ? await api.patch<DropdownRow>(url, { id: edit.id, ...payload })
      : await api.post<DropdownRow>(url, payload);

    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    const saved = { id: res.data.id, nameEn: res.data.nameEn, nameGu: res.data.nameGu };
    patchRows((prev) =>
      edit.id
        ? prev.map((r) => (r.id === edit.id ? { ...r, ...saved } : r))
        : [...prev, { ...saved, isActive: true, inUse: 0, childCount: 0 }],
    );
    setEdit(null);
    toast.success(`${cat.noun} ${edit.id ? "updated" : "added"}`);
  }

  async function toggleActive(row: DropdownRow) {
    const next = !row.isActive;
    // Enabling a member's suggestion IS the approval — it stops being flagged.
    const reviewed = next ? { needsReview: false } : {};
    patchRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, isActive: next, ...reviewed } : r)),
    );
    const res = await api.patch("/api/admin/dropdowns", {
      id: row.id,
      isActive: next,
      ...reviewed,
    });
    if (!res.ok) {
      patchRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, isActive: !next, needsReview: row.needsReview } : r,
        ),
      );
      toast.error(res.error || "Could not change status");
    }
  }

  async function remove(row: DropdownRow) {
    if (!cat.api) return;
    const ok = await confirmDialog({
      title: `Delete “${row.nameEn}”?`,
      description:
        row.inUse > 0
          ? `This option is used by ${row.inUse} record(s). Deleting it won't change those records, but it will no longer appear in the app's dropdowns.`
          : catId === "occupation" || cat.occupationChild
            ? "Nested sub-categories under this option will also be removed."
            : undefined,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;

    const res = await api.del(`/api/admin/${cat.api}?id=${row.id}`);
    if (!res.ok) {
      toast.error(res.error || "Could not delete");
      return;
    }
    if (expandedId === row.id) setExpandedId(null);
    patchRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success(`${cat.noun} deleted`);
  }

  const showNestedAction = (row: DropdownRow) => {
    if (catId === "occupation") return true;
    // Same tree as Occupation → Student / Vepar — every level can nest (College, Std 11, …).
    if (catId === "student" || catId === "vepar") return true;
    return false;
  };

  function openNested(row: DropdownRow) {
    // Occupation → Student / Vepar roots open the connected tab (same data + same expand UI).
    if (catId === "occupation") {
      if (isStudentOccupation(row.nameEn, row.nameGu)) {
        setCatId("student");
        setExpandedId(null);
        setQ("");
        setStatusFilter("all");
        return;
      }
      if (isVeparOccupation(row.nameEn, row.nameGu)) {
        setCatId("vepar");
        setExpandedId(null);
        setQ("");
        setStatusFilter("all");
        return;
      }
      setSubDrawer(row);
      return;
    }
    if (usesExpandRows) {
      setExpandedId((prev) => (prev === row.id ? null : row.id));
    }
  }

  const colCount = usesExpandRows ? 6 : 4;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <AdminH2
          className="mb-0"
          info={
            <>
              Each option is saved in English + ગુજરાતી. Disabled options stay on old records but no
              longer appear in the app’s dropdowns. Masters adapt to{" "}
              <b>{communityType === "PARIVAR" ? "Parivar" : "Gam"}</b> community type.
            </>
          }
        >
          Dropdown lists (masters)
        </AdminH2>
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search options…"
            className="min-w-0 flex-1 sm:w-[220px] sm:flex-none"
          />
          {cat.api && (
            <AdminBtn onClick={() => openEdit()}>
              <Plus className="size-4" />
              Add {cat.noun}
            </AdminBtn>
          )}
        </div>
      </div>

      {lockedSurname && (
        <p className="mb-4 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand-tint)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--brand)]">
          Community surname (locked): {lockedSurname.nameEn}
          {lockedSurname.nameGu ? ` · ${lockedSurname.nameGu}` : ""}. Families can only use this
          surname.
        </p>
      )}

      {/* Category chips (left) · status filter (right) — one row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              label={c.chip}
              active={c.id === catId}
              onClick={() => {
                setCatId(c.id);
                setExpandedId(null);
                setQ("");
                setStatusFilter("all");
              }}
            />
          ))}
        </div>

        {cat.hasStatus && (
          <div className="flex items-center gap-2.5">
            <FilterButton
              className="md:hidden"
              active={statusFilter !== "all"}
              onClick={() => setFiltersOpen(true)}
            />
            <div className="hidden items-center gap-2.5 md:flex">
              <AdminSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as "all" | "enabled" | "disabled")}
                ariaLabel="Filter by status"
                className="w-[140px] shrink-0"
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "enabled", label: "Enabled" },
                  { value: "disabled", label: "Disabled" },
                ]}
              />
            </div>
          </div>
        )}
      </div>

      {cat.hasStatus && (
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="bottom" className="md:hidden">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4 pb-4">
              <AdminSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as "all" | "enabled" | "disabled")}
                ariaLabel="Filter by status"
                className="w-full"
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "enabled", label: "Enabled" },
                  { value: "disabled", label: "Disabled" },
                ]}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {cat.readOnlyNote && (
        <p className="mb-4 rounded-xl border border-[var(--info)]/25 bg-[var(--info-tint)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--info)]">
          {cat.readOnlyNote}
        </p>
      )}

      {cat.occupationChild && (
        <p className="mb-4 rounded-xl border border-[var(--line-admin)] bg-[var(--surface-admin)] px-3.5 py-2.5 text-[12.5px] text-[var(--ink-dim)]">
          Linked to Occupation →{" "}
          <b className="text-[var(--ink)]">
            {cat.occupationChild === "student"
              ? "Student · વિદ્યાર્થી"
              : "Vepar (Business) · વેપાર"}
          </b>
          . Nested options expand under the row in this table.
        </p>
      )}

      {error && !edit && (
        <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>
      )}

      <AdminTable>
        <thead>
          <tr>
            {usesExpandRows && <AdminTh className="w-10" />}
            <AdminTh>English</AdminTh>
            <AdminTh>ગુજરાતી</AdminTh>
            <AdminTh>Status</AdminTh>
            {usesExpandRows && <AdminTh>Subs</AdminTh>}
            <AdminTh className="text-right">Actions</AdminTh>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const subs = row.childCount ?? 0;
            const canExpand = usesExpandRows && showNestedAction(row);
            const hasSubs = canExpand && subs > 0;
            const isOpen = expandedId === row.id;
            return (
              <Fragment key={row.id}>
                <tr className={cn(isOpen && "bg-[var(--surface-admin)]/60")}>
                  {usesExpandRows && (
                    <AdminTd className="w-10 pr-0">
                      {hasSubs ? (
                        <button
                          type="button"
                          aria-label={isOpen ? "Collapse" : "Expand"}
                          onClick={() => openNested(row)}
                          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-[var(--ink-dim)] hover:bg-[var(--line-soft)]"
                        >
                          {isOpen ? (
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
                    <span className="font-semibold text-[var(--ink)]">{row.nameEn}</span>
                    {row.needsReview && (
                      <PillWarning>
                        {isPending(row) ? "pending approval" : "flagged"}
                      </PillWarning>
                    )}
                    {row.inUse > 0 && (
                      <span className="ml-1.5 text-[11px] text-[var(--faint)]">({row.inUse})</span>
                    )}
                  </AdminTd>
                  <AdminTd>{row.nameGu}</AdminTd>
                  <AdminTd>
                    {cat.hasStatus ? (
                      <span className="flex items-center gap-2.5">
                        <AdminToggle
                          on={row.isActive}
                          label={`${row.nameEn} enabled`}
                          onChange={() => toggleActive(row)}
                        />
                        <span
                          className={
                            row.isActive
                              ? "text-[12px] font-bold text-[var(--success)]"
                              : "text-[12px] font-bold text-[var(--faint)]"
                          }
                        >
                          {row.isActive ? "Enabled" : "Disabled"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[12px] font-bold text-[var(--success)]">Enabled</span>
                    )}
                  </AdminTd>
                  {usesExpandRows && (
                    <AdminTd>
                      {subs > 0 ? (
                        <span className="text-[13px] font-bold text-[var(--ink)]">{subs}</span>
                      ) : null}
                    </AdminTd>
                  )}
                  <AdminTd className="text-right">
                    {cat.api ? (
                      <span className="flex flex-wrap justify-end gap-2.5">
                        {showNestedAction(row) && (
                          <LinkAction onClick={() => openNested(row)}>
                            {catId === "occupation"
                              ? isStudentOccupation(row.nameEn, row.nameGu) ||
                                isVeparOccupation(row.nameEn, row.nameGu)
                                ? "Open tab"
                                : "Sub-categories"
                              : isOpen
                                ? "Hide"
                                : "Nested"}
                          </LinkAction>
                        )}
                        <LinkAction onClick={() => openEdit(row)}>edit</LinkAction>
                        <LinkAction danger onClick={() => remove(row)}>
                          delete
                        </LinkAction>
                      </span>
                    ) : (
                      <span className="text-[12px] text-[var(--faint)]">read-only</span>
                    )}
                  </AdminTd>
                </tr>
                {canExpand && isOpen && (
                  <tr className="bg-[var(--surface-admin)]/40">
                    <AdminTd colSpan={colCount} className="border-b border-[var(--line-admin)] px-4 py-4">
                      <div className="ml-2 sm:ml-6">
                        <OccupationNestedPanel
                          root={row}
                          variant="table"
                          onChanged={() => {
                            if (cat.occupationChild) void refreshChildTab(cat.occupationChild);
                          }}
                        />
                      </div>
                    </AdminTd>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {visible.length === 0 && (
            <tr>
              <AdminTd colSpan={colCount} className="py-8 text-center text-[var(--faint)]">
                {q.trim()
                  ? `No option matches “${q.trim()}”.`
                  : `No ${cat.noun.toLowerCase()} options yet.`}
              </AdminTd>
            </tr>
          )}
        </tbody>
      </AdminTable>

      <OccupationSubDrawer
        open={subDrawer !== null}
        root={subDrawer}
        onClose={() => {
          setSubDrawer(null);
          void refreshChildTab("student");
          void refreshChildTab("vepar");
        }}
        onChanged={() => {
          void refreshChildTab("student");
          void refreshChildTab("vepar");
        }}
      />

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-[360px] rounded-2xl sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              {edit?.id ? "Edit" : "Add"} {cat.noun}
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
