"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AdminBtn,
  AdminH2,
  AdminHint,
  AdminInput,
  AdminLabel,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminToggle,
  FilterChip,
  LinkAction,
  PillWarning,
  SearchInput,
} from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OccupationSubDrawer } from "@/components/admin/occupation-sub-drawer";
import { api } from "@/lib/http";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import { isDiplomaLevel, isStreamLevel } from "@/lib/occupation-defaults";

export type DropdownRow = {
  id: string;
  nameEn: string;
  nameGu: string;
  isActive: boolean;
  inUse: number;
  needsReview?: boolean;
};

type CategoryId =
  | "surname"
  | "occupation"
  | "student"
  | "vepar"
  | "relationship"
  | "blood";

type Category = {
  id: CategoryId;
  chip: string;
  noun: string;
  api: "surname-groups" | "dropdowns" | null;
  hasStatus: boolean;
  /** Nested occupation tab — children of Student / Vepar roots. */
  occupationChild?: "student" | "vepar";
  readOnlyNote?: string;
};

const CATEGORIES: Category[] = [
  { id: "surname", chip: "Surname · અટક", noun: "Surname", api: "surname-groups", hasStatus: false },
  { id: "occupation", chip: "Occupation · વ્યવસાય", noun: "Occupation", api: "dropdowns", hasStatus: true },
  {
    id: "student",
    chip: "Student · વિદ્યાર્થી",
    noun: "Education level",
    api: "dropdowns",
    hasStatus: true,
    occupationChild: "student",
  },
  {
    id: "vepar",
    chip: "Vepar (Business) · વેપાર",
    noun: "Business type",
    api: "dropdowns",
    hasStatus: true,
    occupationChild: "vepar",
  },
  { id: "relationship", chip: "Relationship · સંબંધ", noun: "Relationship", api: "dropdowns", hasStatus: true },
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

type EditState = { id: string | null; nameEn: string; nameGu: string } | null;

export function DropdownsClient({
  initialRows,
  roots,
}: {
  initialRows: Record<string, DropdownRow[]>;
  roots: { student: DropdownRow | null; vepar: DropdownRow | null };
}) {
  const { fromEn, guInput } = useTranslitSync();
  const [rows, setRows] = useState<Record<string, DropdownRow[]>>(initialRows);
  const [rootIds, setRootIds] = useState(roots);
  const [catId, setCatId] = useState<CategoryId>("surname");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<EditState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subDrawer, setSubDrawer] = useState<DropdownRow | null>(null);

  const cat = CATEGORIES.find((c) => c.id === catId)!;
  const visible = useMemo(() => {
    const list = rows[catId] ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (r) => r.nameEn.toLowerCase().includes(needle) || r.nameGu.toLowerCase().includes(needle),
    );
  }, [rows, catId, q]);

  async function refreshChildTab(kind: "student" | "vepar") {
    const root = kind === "student" ? rootIds.student : rootIds.vepar;
    if (!root) return;
    const res = await api.get<
      { id: string; nameEn: string; nameGu: string; isActive: boolean; parentId: string | null }[]
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
        payload = { ...base, type: catId, parentId: null };
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
        : [...prev, { ...saved, isActive: true, inUse: 0 }],
    );
    setEdit(null);
    toast.success(`${cat.noun} ${edit.id ? "updated" : "added"}`);
  }

  async function toggleActive(row: DropdownRow) {
    const next = !row.isActive;
    patchRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: next } : r)));
    const res = await api.patch("/api/admin/dropdowns", { id: row.id, isActive: next });
    if (!res.ok) {
      patchRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: !next } : r)));
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
    patchRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success(`${cat.noun} deleted`);
  }

  const showNestedAction = (row: DropdownRow) => {
    if (catId === "occupation") return true;
    if (catId === "student") return isStreamLevel(row.nameEn) || isDiplomaLevel(row.nameEn);
    if (catId === "vepar") return true; // allow deeper nesting under business types
    return false;
  };

  return (
    <>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <AdminH2 className="mb-0">Dropdown lists (masters)</AdminH2>
        {cat.api && (
          <AdminBtn onClick={() => openEdit()}>
            <Plus className="size-4" />
            Add {cat.noun}
          </AdminBtn>
        )}
      </div>

      <AdminHint className="mt-0 mb-4 max-w-3xl text-[12.5px]">
        Each option is saved in English + ગુજરાતી. Disabled options stay on old records but no
        longer appear in the app’s dropdowns.{" "}
        <b>Student</b> and <b>Vepar (Business)</b> tabs manage sub-categories linked to those
        occupations (same data as the Occupation drawer). New communities get the default lists
        automatically.
      </AdminHint>

      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c.id}
            label={c.chip}
            active={c.id === catId}
            onClick={() => {
              setCatId(c.id);
              setQ("");
            }}
          />
        ))}
      </div>

      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Search options…"
        className="mb-4 max-w-md"
      />

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
          . Changes here appear in member forms and the Occupation sub-categories drawer.
        </p>
      )}

      {error && !edit && (
        <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>
      )}

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>English</AdminTh>
            <AdminTh>ગુજરાતી</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh className="text-right">Actions</AdminTh>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id}>
              <AdminTd>
                <span className="font-semibold text-[var(--ink)]">{row.nameEn}</span>
                {row.needsReview && <PillWarning>flagged</PillWarning>}
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
              <AdminTd className="text-right">
                {cat.api ? (
                  <span className="flex flex-wrap justify-end gap-2.5">
                    {showNestedAction(row) && (
                      <LinkAction onClick={() => setSubDrawer(row)}>
                        {catId === "occupation" ? "Sub-categories" : "Nested"}
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
          ))}
          {visible.length === 0 && (
            <tr>
              <AdminTd colSpan={4} className="py-8 text-center text-[var(--faint)]">
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
          if (cat.occupationChild) refreshChildTab(cat.occupationChild);
        }}
        onChanged={() => {
          if (cat.occupationChild) refreshChildTab(cat.occupationChild);
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
