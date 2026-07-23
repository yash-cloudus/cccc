"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AdminBtn,
  AdminH2,
  AdminH3,
  AdminHint,
  AdminInput,
  AdminLabel,
  AdminTable,
  AdminTd,
  LinkAction,
  PillWarning,
} from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/http";
import { useTranslitSync } from "@/hooks/use-translit-sync";

export type SurnameItem = {
  id: string;
  nameEn: string;
  nameGu: string;
  needsReview: boolean;
  families: number;
};

export type OptionItem = {
  id: string;
  nameEn: string;
  nameGu: string;
  type: string;
};

type EditState = {
  kind: "surname" | "degree" | "occupation";
  id: string | null; // null => create
  nameEn: string;
  nameGu: string;
} | null;

const LABELS: Record<NonNullable<EditState>["kind"], string> = {
  surname: "Surname",
  degree: "Degree",
  occupation: "Occupation",
};

export function DropdownsClient({
  initialSurnames,
  initialDegrees,
  initialOccupations,
}: {
  initialSurnames: SurnameItem[];
  initialDegrees: OptionItem[];
  initialOccupations: OptionItem[];
}) {
  const { fromEn, fromGu } = useTranslitSync();
  const [surnames, setSurnames] = useState<SurnameItem[]>(initialSurnames);
  const [degrees, setDegrees] = useState<OptionItem[]>(initialDegrees);
  const [occupations, setOccupations] = useState<OptionItem[]>(initialOccupations);

  const [edit, setEdit] = useState<EditState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (kind: NonNullable<EditState>["kind"], item?: { id: string; nameEn: string; nameGu: string }) => {
    setError(null);
    setEdit({ kind, id: item?.id ?? null, nameEn: item?.nameEn ?? "", nameGu: item?.nameGu ?? "" });
  };

  async function save() {
    if (!edit) return;
    if (!edit.nameEn.trim() || !edit.nameGu.trim()) {
      setError("Both English and ગુજરાતી are required");
      return;
    }
    setBusy(true);
    setError(null);

    const isSurname = edit.kind === "surname";
    const url = isSurname ? "/api/admin/surname-groups" : "/api/admin/dropdowns";
    const payload = isSurname
      ? { nameEn: edit.nameEn.trim(), nameGu: edit.nameGu.trim() }
      : { type: edit.kind, nameEn: edit.nameEn.trim(), nameGu: edit.nameGu.trim() };

    const res = edit.id
      ? await api.patch<{ id: string; nameEn: string; nameGu: string }>(url, { id: edit.id, ...payload })
      : await api.post<{ id: string; nameEn: string; nameGu: string }>(url, payload);

    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    const updated = { id: res.data.id, nameEn: res.data.nameEn, nameGu: res.data.nameGu };
    if (isSurname) {
      setSurnames((prev) =>
        edit.id
          ? prev.map((s) => (s.id === edit.id ? { ...s, ...updated } : s))
          : [...prev, { ...updated, needsReview: false, families: 0 }],
      );
    } else {
      const setter = edit.kind === "degree" ? setDegrees : setOccupations;
      setter((prev) =>
        edit.id
          ? prev.map((o) => (o.id === edit.id ? { ...o, ...updated } : o))
          : [...prev, { ...updated, type: edit.kind }],
      );
    }
    setEdit(null);
  }

  async function remove(kind: NonNullable<EditState>["kind"], id: string) {
    if (!window.confirm("Delete this item?")) return;
    const url =
      kind === "surname" ? `/api/admin/surname-groups?id=${id}` : `/api/admin/dropdowns?id=${id}`;
    const res = await api.del(url);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (kind === "surname") setSurnames((prev) => prev.filter((s) => s.id !== id));
    else if (kind === "degree") setDegrees((prev) => prev.filter((o) => o.id !== id));
    else setOccupations((prev) => prev.filter((o) => o.id !== id));
  }

  const renderOptionTable = (
    kind: "degree" | "occupation",
    items: OptionItem[],
    addLabel: string,
  ) => (
    <AdminTable>
      <tbody>
        {items.map((o) => (
          <tr key={o.id}>
            <AdminTd>
              {o.nameEn} · {o.nameGu}
            </AdminTd>
            <AdminTd className="text-right">
              <span className="flex justify-end gap-2">
                <LinkAction onClick={() => open(kind, o)}>edit</LinkAction>
                <LinkAction danger onClick={() => remove(kind, o.id)}>
                  delete
                </LinkAction>
              </span>
            </AdminTd>
          </tr>
        ))}
        <tr>
          <AdminTd colSpan={2}>
            <button
              type="button"
              onClick={() => open(kind)}
              className="cursor-pointer font-bold text-[#A62A38]"
            >
              {addLabel}
            </button>
          </AdminTd>
        </tr>
      </tbody>
    </AdminTable>
  );

  return (
    <>
      <AdminH2>Dropdown lists</AdminH2>
      <AdminHint className="-mt-1.5 mb-5">
        દરેક option English + ગુજરાતી બંને save થાય — યુઝર ફોર્મમાં English dropdown બતાવે, ગુજરાતી
        બાજુ auto-fill થાય.
      </AdminHint>

      {error && !edit && <p className="mb-3 text-[13px] font-semibold text-[#B0303A]">{error}</p>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <AdminH3>Surname groups</AdminH3>
          <AdminTable>
            <tbody>
              {surnames.map((s) => (
                <tr key={s.id}>
                  <AdminTd>
                    {s.nameEn} · {s.nameGu}
                    {s.needsReview && <PillWarning>flagged</PillWarning>}
                    {s.families > 0 && (
                      <span className="ml-1.5 text-[11px] text-[#938C80]">({s.families})</span>
                    )}
                  </AdminTd>
                  <AdminTd className="text-right">
                    <span className="flex justify-end gap-2">
                      <LinkAction onClick={() => open("surname", s)}>edit</LinkAction>
                      <LinkAction danger onClick={() => remove("surname", s.id)}>
                        delete
                      </LinkAction>
                    </span>
                  </AdminTd>
                </tr>
              ))}
              {surnames.length === 0 && (
                <tr>
                  <AdminTd colSpan={2} className="text-[#938C80]">
                    No surname groups yet.
                  </AdminTd>
                </tr>
              )}
              <tr>
                <AdminTd colSpan={2}>
                  <button
                    type="button"
                    onClick={() => open("surname")}
                    className="cursor-pointer font-bold text-[#A62A38]"
                  >
                    + Add surname
                  </button>
                </AdminTd>
              </tr>
            </tbody>
          </AdminTable>
        </div>

        <div>
          <AdminH3>Occupations / business types</AdminH3>
          {renderOptionTable("occupation", occupations, "+ Add occupation")}
        </div>

        <div>
          <AdminH3>Degrees</AdminH3>
          {renderOptionTable("degree", degrees, "+ Add degree")}
        </div>
      </div>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-[360px] rounded-2xl sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#2A2620]">
              {edit?.id ? "Edit" : "Add"} {edit ? LABELS[edit.kind] : ""}
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
                value={edit.nameGu}
                onChange={(v) => {
                  setEdit((prev) => (prev ? { ...prev, nameGu: v } : prev));
                  fromGu(v, (en) => setEdit((prev) => (prev ? { ...prev, nameEn: en } : prev)));
                }}
              />
              {error && <p className="mt-2 text-[12.5px] font-semibold text-[#B0303A]">{error}</p>}
              <div className="mt-4 flex gap-2.5">
                <AdminBtn className="flex-1 justify-center" onClick={save}>
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
