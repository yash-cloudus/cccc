"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionBtn, AdminBtn, AdminInput, AdminToggle } from "@/components/admin/admin-ui";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import { api } from "@/lib/http";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { useAdminT } from "@/lib/i18n/admin-dictionary";
import { NRI_COUNTRY_TYPE } from "@/lib/nri";

type CityRow = { id: string; nameEn: string; nameGu: string; isActive: boolean };

/**
 * Cities under one NRI country.
 *
 * Deliberately not the occupation nested panel: that one hard-codes
 * `type: "occupation"` and carries stream/diploma quick-picks for education
 * levels. NRI is one flat level — a country and its cities — so genericising
 * the other component would cost more than this does.
 */
export function NriCitiesPanel({
  country,
  onChanged,
}: {
  country: { id: string; nameEn: string };
  /** Lets the parent refresh the country row's city count. */
  onChanged?: () => void;
}) {
  const { t, tf } = useAdminT();
  const { fromEn, guInput } = useTranslitSync();
  const [rows, setRows] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<{ id: string | null; nameEn: string; nameGu: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<CityRow[]>(
      `/api/admin/dropdowns?type=${NRI_COUNTRY_TYPE}&parentId=${country.id}`,
    );
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setError(null);
    setRows(res.data);
  }, [country.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!edit) return;
    const nameEn = edit.nameEn.trim();
    if (!nameEn) return setError(t("drop.errNameRequired"));
    setBusy(true);
    const payload = {
      type: NRI_COUNTRY_TYPE,
      parentId: country.id,
      nameEn,
      // Falls back to the English name so the row is never half-blank — every
      // other master in this screen stores both.
      nameGu: edit.nameGu.trim() || nameEn,
    };
    const res = edit.id
      ? await api.patch(`/api/admin/dropdowns/${edit.id}`, payload)
      : await api.post("/api/admin/dropdowns", payload);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setEdit(null);
    setError(null);
    await load();
    onChanged?.();
  }

  async function toggle(row: CityRow) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)));
    const res = await api.patch(`/api/admin/dropdowns/${row.id}`, { isActive: !row.isActive });
    if (!res.ok) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
      setError(res.error);
    }
  }

  async function remove(row: CityRow) {
    const okDelete = await confirmDialog({
      title: tf("drop.confirmDeleteTitle", { name: row.nameEn }),
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!okDelete) return;
    const res = await api.del(`/api/admin/dropdowns/${row.id}`);
    if (!res.ok) return setError(res.error);
    await load();
    onChanged?.();
  }

  return (
    <div className="rounded-[12px] border border-[var(--line-admin)] bg-white p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <b className="text-[12.5px] text-[var(--ink)]">
          {country.nameEn} · {t("drop.nounNriCity")}
        </b>
        <AdminBtn
          onClick={() => {
            setEdit({ id: null, nameEn: "", nameGu: "" });
            setError(null);
          }}
        >
          <Plus className="size-3.5" /> {t("common.add")}
        </AdminBtn>
      </div>

      {error && <p className="mb-2 text-[12px] font-bold text-[var(--danger)]">{error}</p>}

      {edit && (
        <div className="mb-3 grid grid-cols-[1fr_1fr_auto_auto] items-end gap-2 max-sm:grid-cols-1">
          <AdminInput
            speech
            value={edit.nameEn}
            placeholder={t("drop.thEnglish")}
            onChange={(v) => {
              setEdit((e) => (e ? { ...e, nameEn: v } : e));
              fromEn(v, (gu) => setEdit((e) => (e ? { ...e, nameGu: gu } : e)), "nri-city");
            }}
          />
          <AdminInput
            gujarati
            value={edit.nameGu}
            placeholder={t("drop.thGujarati")}
            onChange={(v) => {
              setEdit((e) => (e ? { ...e, nameGu: v } : e));
              guInput(v, (gu) => setEdit((e) => (e ? { ...e, nameGu: gu } : e)), "nri-city:gu");
            }}
          />
          <AdminBtn variant="primary" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} {t("common.save")}
          </AdminBtn>
          <AdminBtn variant="ghost" onClick={() => setEdit(null)}>
            {t("common.cancel")}
          </AdminBtn>
        </div>
      )}

      {loading ? (
        <p className="py-3 text-center text-[12.5px] text-[var(--faint)]">
          <Loader2 className="inline size-4 animate-spin" />
        </p>
      ) : rows.length === 0 ? (
        <p className="py-3 text-center text-[12.5px] text-[var(--faint)]">{t("drop.emptyNested")}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2.5 rounded-[10px] border border-[var(--line-soft)] px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--ink)]">
                {r.nameEn}
                {r.nameGu && r.nameGu !== r.nameEn ? (
                  <span className="ml-1.5 font-normal text-[var(--faint)]">· {r.nameGu}</span>
                ) : null}
              </span>
              <AdminToggle
                on={r.isActive}
                label={tf("drop.toggleAria", { name: r.nameEn })}
                onChange={() => toggle(r)}
              />
              <ActionBtn
                icon={Pencil}
                label={t("common.edit")}
                onClick={() => setEdit({ id: r.id, nameEn: r.nameEn, nameGu: r.nameGu })}
              />
              <ActionBtn icon={Trash2} label={t("common.delete")} tone="danger" onClick={() => remove(r)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
