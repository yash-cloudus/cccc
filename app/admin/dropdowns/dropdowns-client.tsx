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
import { api } from "@/lib/http";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";

export type DropdownRow = {
  id: string;
  nameEn: string;
  nameGu: string;
  isActive: boolean;
  /** Records already referencing this option — shown so admins know the blast radius. */
  inUse: number;
  needsReview?: boolean;
};

type CategoryId =
  | "surname"
  | "degree"
  | "occupation"
  | "relationship"
  | "blood"
  | "buscat"
  | "standard";

type Category = {
  id: CategoryId;
  /** Pill label — bilingual, matches Admin.dc.html dropCats. */
  chip: string;
  /** Singular noun used in the "+ Add …" button and modal title. */
  noun: string;
  /** Which endpoint backs this category. */
  api: "surname-groups" | "business-categories" | "dropdowns" | null;
  /** Only DropdownOption rows carry a real isActive column. */
  hasStatus: boolean;
  /** Blood groups are a fixed medical enum — never editable. */
  readOnlyNote?: string;
};

const CATEGORIES: Category[] = [
  { id: "surname", chip: "Surname · અટક", noun: "Surname", api: "surname-groups", hasStatus: false },
  { id: "degree", chip: "Degree · ડિગ્રી", noun: "Degree", api: "dropdowns", hasStatus: true },
  { id: "occupation", chip: "Occupation · વ્યવસાય", noun: "Occupation", api: "dropdowns", hasStatus: true },
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
  { id: "buscat", chip: "Business category", noun: "Business category", api: "business-categories", hasStatus: false },
  { id: "standard", chip: "Education Level (Standard) · ધોરણ", noun: "Education Level", api: "dropdowns", hasStatus: true },
];

type EditState = { id: string | null; nameEn: string; nameGu: string } | null;

export function DropdownsClient({ initialRows }: { initialRows: Record<string, DropdownRow[]> }) {
  const { fromEn, guInput } = useTranslitSync();
  const [rows, setRows] = useState<Record<string, DropdownRow[]>>(initialRows);
  const [catId, setCatId] = useState<CategoryId>("surname");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<EditState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cat = CATEGORIES.find((c) => c.id === catId)!;
  const visible = useMemo(() => {
    const list = rows[catId] ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (r) => r.nameEn.toLowerCase().includes(needle) || r.nameGu.toLowerCase().includes(needle),
    );
  }, [rows, catId, q]);

  const patchRows = (next: (prev: DropdownRow[]) => DropdownRow[]) =>
    setRows((prev) => ({ ...prev, [catId]: next(prev[catId] ?? []) }));

  function openEdit(row?: DropdownRow) {
    setError(null);
    setEdit({ id: row?.id ?? null, nameEn: row?.nameEn ?? "", nameGu: row?.nameGu ?? "" });
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
    const payload = cat.api === "dropdowns" ? { ...base, type: catId } : base;

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
        longer appear in the app’s dropdowns. Member/registration forms show these as dropdowns
        with an inline “+ Add new”.
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
                  <span className="flex justify-end gap-2.5">
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
