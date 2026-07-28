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
  LinkAction,
  SearchInput,
} from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/http";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";

export type CategoryRow = {
  id: string;
  nameEn: string;
  nameGu: string;
  inUse: number;
};

type EditState = { id: string | null; nameEn: string; nameGu: string } | null;

export function BusinessCategoriesClient({ initialRows }: { initialRows: CategoryRow[] }) {
  const { fromEn, guInput } = useTranslitSync();
  const [rows, setRows] = useState<CategoryRow[]>(initialRows);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<EditState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) => r.nameEn.toLowerCase().includes(needle) || r.nameGu.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  function openEdit(row?: CategoryRow) {
    setError(null);
    setEdit({ id: row?.id ?? null, nameEn: row?.nameEn ?? "", nameGu: row?.nameGu ?? "" });
  }

  async function save() {
    if (!edit) return;
    if (!edit.nameEn.trim() || !edit.nameGu.trim()) {
      setError("Both English and ગુજરાતી are required");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = { nameEn: edit.nameEn.trim(), nameGu: edit.nameGu.trim() };
    const res = edit.id
      ? await api.patch<CategoryRow>("/api/admin/business-categories", { id: edit.id, ...payload })
      : await api.post<CategoryRow>("/api/admin/business-categories", payload);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const saved = {
      id: res.data.id,
      nameEn: res.data.nameEn,
      nameGu: res.data.nameGu,
      inUse: edit.id ? rows.find((r) => r.id === edit.id)?.inUse ?? 0 : 0,
    };
    setRows((prev) =>
      edit.id ? prev.map((r) => (r.id === edit.id ? { ...r, ...saved } : r)) : [...prev, saved],
    );
    setEdit(null);
    toast.success(`Category ${edit.id ? "updated" : "added"}`);
  }

  async function remove(row: CategoryRow) {
    const ok = await confirmDialog({
      title: `Delete “${row.nameEn}”?`,
      description:
        row.inUse > 0
          ? `${row.inUse} business(es) use this category. Delete may fail if still linked.`
          : undefined,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await api.del(`/api/admin/business-categories?id=${row.id}`);
    if (!res.ok) {
      toast.error(res.error || "Could not delete");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Category deleted");
  }

  return (
    <>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <AdminH2 className="mb-0">Business categories</AdminH2>
        <AdminBtn onClick={() => openEdit()}>
          <Plus className="size-4" />
          Add category
        </AdminBtn>
      </div>

      <AdminHint className="mt-0 mb-4 max-w-3xl text-[12.5px]">
        Categories used in the Business directory and Advertisements. Managed separately from
        Occupation sub-categories.
      </AdminHint>

      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Search categories…"
        className="mb-4 max-w-md"
      />

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>English</AdminTh>
            <AdminTh>ગુજરાતી</AdminTh>
            <AdminTh>In use</AdminTh>
            <AdminTh className="text-right">Actions</AdminTh>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id}>
              <AdminTd className="font-semibold text-[var(--ink)]">{row.nameEn}</AdminTd>
              <AdminTd>{row.nameGu}</AdminTd>
              <AdminTd>{row.inUse}</AdminTd>
              <AdminTd className="text-right">
                <span className="flex justify-end gap-2.5">
                  <LinkAction onClick={() => openEdit(row)}>edit</LinkAction>
                  <LinkAction danger onClick={() => remove(row)}>
                    delete
                  </LinkAction>
                </span>
              </AdminTd>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <AdminTd colSpan={4} className="py-8 text-center text-[var(--faint)]">
                {q.trim() ? "No category matches your search." : "No business categories yet."}
              </AdminTd>
            </tr>
          )}
        </tbody>
      </AdminTable>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-[360px] rounded-2xl sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              {edit?.id ? "Edit" : "Add"} business category
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
