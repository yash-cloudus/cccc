"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ListTree, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  AdminToggle,
  FilterButton,
  FilterChip,
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
import { useAdminT, type AdminKey } from "@/lib/i18n/admin-dictionary";
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
  chipKey: AdminKey;
  nounKey: AdminKey;
  api: "surname-groups" | "dropdowns" | "villages" | null;
  hasStatus: boolean;
  occupationChild?: "student" | "vepar";
  readOnlyNoteKey?: AdminKey;
  /** DropdownOption.type when api is dropdowns */
  optionType?: string;
};

function categoriesForType(communityType: "PARIVAR" | "GAM"): Category[] {
  const shared: Category[] = [
    {
      id: "occupation",
      chipKey: "drop.catOccupation",
      nounKey: "drop.catOccupation",
      api: "dropdowns",
      hasStatus: true,
      optionType: "occupation",
    },
    {
      id: "student",
      chipKey: "drop.catStudent",
      nounKey: "drop.nounEducationLevel",
      api: "dropdowns",
      hasStatus: true,
      occupationChild: "student",
      optionType: "occupation",
    },
    {
      id: "vepar",
      chipKey: "drop.catVepar",
      nounKey: "drop.nounBusinessType",
      api: "dropdowns",
      hasStatus: true,
      occupationChild: "vepar",
      optionType: "occupation",
    },
    {
      id: "relationship",
      chipKey: "drop.catRelationship",
      nounKey: "drop.catRelationship",
      api: "dropdowns",
      hasStatus: true,
      optionType: "relationship",
    },
    {
      id: "blood",
      chipKey: "drop.catBlood",
      nounKey: "drop.catBlood",
      api: null,
      hasStatus: false,
      readOnlyNoteKey: "drop.bloodNote",
    },
  ];

  if (communityType === "PARIVAR") {
    return [
      {
        id: "city",
        chipKey: "drop.catCity",
        nounKey: "drop.catCity",
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
      chipKey: "drop.catSurname",
      nounKey: "drop.catSurname",
      api: "surname-groups",
      hasStatus: false,
    },
    {
      id: "village",
      chipKey: "drop.catVillage",
      nounKey: "drop.catVillage",
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
  const { t, tf, lang } = useAdminT();
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
  const noun = t(cat.nounKey);
  /** Row label in the reader's language — both halves live on every row. */
  const rowName = (r: { nameEn: string; nameGu: string }) =>
    (lang === "en" ? r.nameEn || r.nameGu : r.nameGu || r.nameEn);
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
      toast.error(res.error || t("drop.errCreateOccupation"));
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
      setError(t("drop.errBothRequired"));
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
    toast.success(tf(edit.id ? "drop.toastUpdated" : "drop.toastAdded", { noun }));
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
      toast.error(res.error || t("drop.errStatus"));
    }
  }

  async function remove(row: DropdownRow) {
    if (!cat.api) return;
    const ok = await confirmDialog({
      title: tf("drop.confirmDeleteTitle", { name: rowName(row) }),
      description:
        row.inUse > 0
          ? tf("drop.confirmDeleteInUse", { n: row.inUse })
          : catId === "occupation" || cat.occupationChild
            ? t("drop.confirmDeleteNested")
            : undefined,
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;

    const res = await api.del(`/api/admin/${cat.api}?id=${row.id}`);
    if (!res.ok) {
      toast.error(res.error || t("drop.errDelete"));
      return;
    }
    if (expandedId === row.id) setExpandedId(null);
    patchRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success(tf("drop.toastDeleted", { noun }));
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
              {t("drop.infoA")}{" "}
              <b>{communityType === "PARIVAR" ? t("drop.typeParivar") : t("drop.typeGam")}</b>{" "}
              {t("drop.infoB")}
            </>
          }
        >
          {t("drop.title")}
        </AdminH2>
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={t("drop.searchPh")}
            className="min-w-0 flex-1 sm:w-[220px] sm:flex-none"
          />
          {cat.api && (
            <AdminBtn onClick={() => openEdit()}>
              <Plus className="size-4" />
              {tf("drop.addNoun", { noun })}
            </AdminBtn>
          )}
        </div>
      </div>

      {lockedSurname && (
        <p className="mb-4 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand-tint)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--brand)]">
          {tf("drop.lockedSurname", {
            name: `${lockedSurname.nameEn}${lockedSurname.nameGu ? ` · ${lockedSurname.nameGu}` : ""}`,
          })}
        </p>
      )}

      {/* Category chips (left) · status filter (right) — one row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              label={t(c.chipKey)}
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
                ariaLabel={t("drop.filterByStatus")}
                className="w-[140px] shrink-0"
                options={[
                  { value: "all", label: t("drop.statusAll") },
                  { value: "enabled", label: t("drop.enabled") },
                  { value: "disabled", label: t("drop.disabled") },
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
              <SheetTitle>{t("drop.filters")}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4 pb-4">
              <AdminSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as "all" | "enabled" | "disabled")}
                ariaLabel={t("drop.filterByStatus")}
                className="w-full"
                options={[
                  { value: "all", label: t("drop.statusAll") },
                  { value: "enabled", label: t("drop.enabled") },
                  { value: "disabled", label: t("drop.disabled") },
                ]}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {cat.readOnlyNoteKey && (
        <p className="mb-4 rounded-xl border border-[var(--info)]/25 bg-[var(--info-tint)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--info)]">
          {t(cat.readOnlyNoteKey)}
        </p>
      )}

      {cat.occupationChild && (
        <p className="mb-4 rounded-xl border border-[var(--line-admin)] bg-[var(--surface-admin)] px-3.5 py-2.5 text-[12.5px] text-[var(--ink-dim)]">
          {t("drop.linkedToOccA")}{" "}
          <b className="text-[var(--ink)]">
            {cat.occupationChild === "student" ? t("drop.catStudent") : t("drop.catVepar")}
          </b>
          {t("drop.linkedToOccB")}
        </p>
      )}

      {error && !edit && (
        <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>
      )}

      <AdminTable>
        <thead>
          <tr>
            {usesExpandRows && <AdminTh className="w-10" />}
            <AdminTh>{t("drop.thEnglish")}</AdminTh>
            <AdminTh>{t("drop.thGujarati")}</AdminTh>
            <AdminTh>{t("drop.thStatus")}</AdminTh>
            {usesExpandRows && <AdminTh>{t("drop.thSubs")}</AdminTh>}
            <AdminTh className="text-right">{t("drop.thActions")}</AdminTh>
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
                          aria-label={isOpen ? t("drop.collapse") : t("drop.expand")}
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
                        {isPending(row) ? t("drop.pillPending") : t("drop.pillFlagged")}
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
                          label={tf("drop.toggleAria", { name: rowName(row) })}
                          onChange={() => toggleActive(row)}
                        />
                        <span
                          className={
                            row.isActive
                              ? "text-[12px] font-bold text-[var(--success)]"
                              : "text-[12px] font-bold text-[var(--faint)]"
                          }
                        >
                          {row.isActive ? t("drop.enabled") : t("drop.disabled")}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[12px] font-bold text-[var(--success)]">
                        {t("drop.enabled")}
                      </span>
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
                      <div className="flex flex-nowrap items-center justify-end gap-1.5">
                        {showNestedAction(row) && (
                          <ActionBtn
                            icon={ListTree}
                            label={
                              catId === "occupation"
                                ? isStudentOccupation(row.nameEn, row.nameGu) ||
                                  isVeparOccupation(row.nameEn, row.nameGu)
                                  ? t("drop.openTab")
                                  : t("drop.subCategories")
                                : isOpen
                                  ? t("drop.hide")
                                  : t("drop.nested")
                            }
                            onClick={() => openNested(row)}
                          />
                        )}
                        <ActionBtn
                          icon={Pencil}
                          label={t("common.edit")}
                          onClick={() => openEdit(row)}
                        />
                        <ActionBtn
                          icon={Trash2}
                          label={t("common.delete")}
                          tone="danger"
                          onClick={() => remove(row)}
                        />
                      </div>
                    ) : (
                      <span className="text-[12px] text-[var(--faint)]">{t("drop.readOnly")}</span>
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
                  ? tf("drop.noMatch", { q: q.trim() })
                  : tf("drop.noOptions", { noun: noun.toLowerCase() })}
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
              {tf(edit?.id ? "drop.editNoun" : "drop.addNoun", { noun })}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <div>
              <AdminLabel>{t("drop.thEnglish")} *</AdminLabel>
              <AdminInput
                value={edit.nameEn}
                onChange={(v) => {
                  setEdit((prev) => (prev ? { ...prev, nameEn: v } : prev));
                  fromEn(v, (gu) => setEdit((prev) => (prev ? { ...prev, nameGu: gu } : prev)));
                }}
              />
              <AdminLabel>{t("drop.thGujarati")} *</AdminLabel>
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
                  {busy ? <Loader2 className="size-4 animate-spin" /> : t("common.save")}
                </AdminBtn>
                <AdminBtn
                  variant="ghost"
                  className="flex-1 justify-center"
                  onClick={() => setEdit(null)}
                >
                  {t("common.cancel")}
                </AdminBtn>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
