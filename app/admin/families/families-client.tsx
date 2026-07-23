"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";

export type FamilyRow = {
  id: string;
  headEn: string;
  headGu: string;
  surnameEn: string;
  surnameGu: string;
  city: string;
  members: number;
};

type SurnameOption = { id: string; nameEn: string; nameGu: string };

type Member = {
  id: string;
  fullNameEn: string;
  fullNameGu: string | null;
  relation: string | null;
  mobile: string | null;
  isHead: boolean;
  isVisible: boolean;
  isDeceased: boolean;
};

type CreatedFamily = {
  id: string;
  headNameEn: string;
  headNameGu: string | null;
  surnameEn: string;
  surnameGu: string | null;
  city: string | null;
  members: number;
  surnameGroup: SurnameOption;
  surnameGroupCreated: boolean;
};

const MEMBER_COLORS = [
  { c: "#B0303A", bg: "#FCE7E7" },
  { c: "#6A4E9C", bg: "#F0ECFB" },
  { c: "#4E7A45", bg: "#EAF6EC" },
  { c: "#B26A1E", bg: "#FEF3E0" },
  { c: "#2A6FA0", bg: "#E7F0FB" },
];

function blankForm(_groups?: SurnameOption[]) {
  return {
    headNameEn: "",
    headNameGu: "",
    surnameEn: "",
    surnameGu: "",
    surnameGroupId: "",
    city: "",
  };
}

function matchGroup(groups: SurnameOption[], surnameEn: string) {
  const q = surnameEn.trim().toLowerCase();
  if (!q) return null;
  return groups.find((g) => g.nameEn.trim().toLowerCase() === q) ?? null;
}

export function FamiliesClient({
  initialRows,
  surnameGroups: initialGroups,
}: {
  initialRows: FamilyRow[];
  surnameGroups: SurnameOption[];
}) {
  const router = useRouter();
  const { fromEn, fromGu } = useTranslitSync();
  const [rows, setRows] = useState<FamilyRow[]>(initialRows);
  const [groups, setGroups] = useState<SurnameOption[]>(initialGroups);
  const [query, setQuery] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(() => blankForm(initialGroups));
  const [addBusy, setAddBusy] = useState(false);

  const [membersOf, setMembersOf] = useState<FamilyRow | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (f) =>
        !q ||
        (f.headEn + f.headGu + f.surnameEn + f.surnameGu + f.city).toLowerCase().includes(q),
    );
  }, [rows, query]);

  const matchedGroup = matchGroup(groups, form.surnameEn);
  const willCreateGroup =
    Boolean(form.surnameEn.trim()) && !matchedGroup && !form.surnameGroupId;

  function applySurnameEn(v: string) {
    const match = matchGroup(groups, v);
    setForm((prev) => ({
      ...prev,
      surnameEn: v,
      surnameGroupId: match?.id ?? "",
    }));
    fromEn(v, (gu) => setForm((prev) => ({ ...prev, surnameGu: gu })), "surname");
  }

  function applySurnameGu(v: string) {
    setForm((prev) => ({ ...prev, surnameGu: v }));
    fromGu(
      v,
      (en) => {
        const match = matchGroup(groups, en);
        setForm((prev) => ({
          ...prev,
          surnameEn: en,
          surnameGroupId: match?.id ?? "",
        }));
      },
      "surname",
    );
  }

  function onPickGroup(id: string) {
    const g = groups.find((x) => x.id === id);
    setForm((prev) => ({
      ...prev,
      surnameGroupId: id,
      surnameEn: g?.nameEn ?? prev.surnameEn,
      surnameGu: g?.nameGu ?? prev.surnameGu,
    }));
  }

  async function createFamily() {
    if (!form.headNameEn.trim() || !form.surnameEn.trim()) {
      setError("Head name and surname are required");
      return;
    }
    setAddBusy(true);
    setError(null);

    const payload = {
      headNameEn: form.headNameEn.trim(),
      headNameGu: form.headNameGu.trim() || undefined,
      surnameEn: form.surnameEn.trim(),
      surnameGu: form.surnameGu.trim() || undefined,
      surnameGroupId: form.surnameGroupId || matchedGroup?.id || undefined,
      city: form.city.trim() || undefined,
    };

    const res = await api.post<CreatedFamily>(`/api/admin/families`, payload);
    setAddBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    const created = res.data;
    const newRow: FamilyRow = {
      id: created.id,
      headEn: created.headNameEn,
      headGu: created.headNameGu || "",
      surnameEn: created.surnameEn,
      surnameGu: created.surnameGu || "",
      city: created.city || "—",
      members: created.members || 1,
    };
    setRows((prev) => [newRow, ...prev.filter((r) => r.id !== newRow.id)]);

    if (created.surnameGroup) {
      setGroups((prev) => {
        const next = prev.some((g) => g.id === created.surnameGroup.id)
          ? prev
          : [...prev, created.surnameGroup];
        return [...next].sort((a, b) => a.nameEn.localeCompare(b.nameEn));
      });
    }

    setAddOpen(false);
    setForm(blankForm(groups));
    setError(null);
    router.refresh();
  }

  async function openMembers(row: FamilyRow) {
    setMembersOf(row);
    setError(null);
    setLoadingMembers(true);
    setMembers([]);
    const res = await api.get<{ familyMembers: Member[] }>(`/api/families/${row.id}`);
    setLoadingMembers(false);
    if (res.ok) setMembers(res.data.familyMembers);
    else setError(res.error);
  }

  async function toggleMember(m: Member, field: "isVisible" | "isDeceased") {
    const next = !m[field];
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, [field]: next } : x)));
    const res = await api.patch(`/api/admin/family-members`, { id: m.id, [field]: next });
    if (!res.ok) {
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, [field]: !next } : x)));
      setError(res.error);
    }
  }

  async function makeHead(m: Member) {
    setMembers((prev) => prev.map((x) => ({ ...x, isHead: x.id === m.id })));
    const res = await api.patch(`/api/admin/family-members`, { id: m.id, isHead: true });
    if (!res.ok) setError(res.error);
  }

  async function changeLogin(m: Member) {
    const value = window.prompt("New login mobile (leave blank to remove)", m.mobile || "");
    if (value === null) return;
    const mobile = value.trim();
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, mobile: mobile || null } : x)));
    const res = await api.patch(`/api/admin/family-members`, { id: m.id, mobile: mobile || null });
    if (!res.ok) setError(res.error);
  }

  async function addMember() {
    if (!membersOf) return;
    const res = await api.post<Member>(`/api/admin/family-members`, {
      familyId: membersOf.id,
      fullNameEn: "New member",
    });
    if (res.ok) {
      setMembers((prev) => [...prev, res.data]);
      setRows((prev) =>
        prev.map((r) => (r.id === membersOf.id ? { ...r, members: r.members + 1 } : r)),
      );
    } else setError(res.error);
  }

  async function removeMember(m: Member) {
    if (!membersOf) return;
    const res = await api.del(`/api/admin/family-members?id=${m.id}`);
    if (res.ok) {
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
      setRows((prev) =>
        prev.map((r) =>
          r.id === membersOf.id ? { ...r, members: Math.max(0, r.members - 1) } : r,
        ),
      );
    } else setError(res.error);
  }

  async function deleteFamily(row: FamilyRow) {
    const label = row.headGu || row.headEn;
    if (!window.confirm(`Delete ${label}'s family? This cannot be undone.`)) return;
    const res = await api.del(`/api/families/${row.id}`);
    if (res.ok) setRows((prev) => prev.filter((f) => f.id !== row.id));
    else setError(res.error);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <AdminH2 className="mb-0">Families &amp; Members</AdminH2>
        <AdminBtn
          onClick={() => {
            setError(null);
            setForm(blankForm(groups));
            setAddOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add family directly
        </AdminBtn>
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search name / surname / city…"
        className="mb-[18px] max-w-[400px]"
      />

      {error && !membersOf && !addOpen && (
        <p className="mb-3 text-[13px] font-semibold text-[#B0303A]">{error}</p>
      )}

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Head</AdminTh>
            <AdminTh>Surname</AdminTh>
            <AdminTh>City</AdminTh>
            <AdminTh>Members</AdminTh>
            <AdminTh>Actions</AdminTh>
          </tr>
        </thead>
        <tbody>
          {filtered.map((f) => (
            <tr key={f.id}>
              <AdminTd>
                <b>{f.headEn}</b>
                {f.headGu ? (
                  <div className="mt-0.5 text-[12px] font-medium text-[#6B6357]">{f.headGu}</div>
                ) : null}
              </AdminTd>
              <AdminTd>
                <span>{f.surnameEn}</span>
                {f.surnameGu ? (
                  <div className="mt-0.5 text-[12px] font-medium text-[#6B6357]">{f.surnameGu}</div>
                ) : null}
              </AdminTd>
              <AdminTd>{f.city}</AdminTd>
              <AdminTd>{f.members}</AdminTd>
              <AdminTd>
                <span className="flex flex-wrap gap-1">
                  <LinkAction onClick={() => openMembers(f)}>Members</LinkAction>
                  <span className="text-[#938C80]">·</span>
                  <LinkAction danger onClick={() => deleteFamily(f)}>
                    Delete
                  </LinkAction>
                </span>
              </AdminTd>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      {filtered.length === 0 && (
        <p className="py-6 text-center text-[11.5px] text-[#938C80]">
          {rows.length === 0 ? "No approved families yet." : "No families match your search."}
        </p>
      )}

      <AdminHint>
        Member editor: visibility overrides · mark deceased (સ્વર્ગસ્થ) · change login number ·
        reassign head. &quot;Add family directly&quot; bypasses the registration queue. New surnames
        are added to Surname groups automatically.
      </AdminHint>

      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="max-w-[420px] rounded-2xl sm:max-w-[420px]">
          <DialogTitle className="text-base font-extrabold text-[#2A2620]">
            Add family directly
          </DialogTitle>
          <div className="mt-1">
            <AdminLabel>Head name (English) *</AdminLabel>
            <AdminInput
              value={form.headNameEn}
              onChange={(v) => {
                setForm((prev) => ({ ...prev, headNameEn: v }));
                fromEn(v, (gu) => setForm((prev) => ({ ...prev, headNameGu: gu })), "head");
              }}
            />
            <AdminLabel>Head name (ગુજરાતી)</AdminLabel>
            <AdminInput
              value={form.headNameGu}
              onChange={(v) => {
                setForm((prev) => ({ ...prev, headNameGu: v }));
                fromGu(v, (en) => setForm((prev) => ({ ...prev, headNameEn: en })), "head");
              }}
            />
            <AdminLabel>Surname group</AdminLabel>
            <select
              value={form.surnameGroupId || matchedGroup?.id || ""}
              onChange={(e) => onPickGroup(e.target.value)}
              className="mb-1 h-[42px] w-full rounded-[11px] border-[1.5px] border-[#EDE4D4] bg-[#FCFAF6] px-3 text-[13.5px] text-[#2A2320] outline-none"
            >
              <option value="">
                {groups.length === 0
                  ? "Will create from surname below…"
                  : "Select group — or type new surname below"}
              </option>
              {groups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEn} · {s.nameGu}
                </option>
              ))}
            </select>
            {willCreateGroup && (
              <p className="mb-2 text-[11.5px] font-semibold text-[#4E7A45]">
                New surname group will be created: {form.surnameEn.trim()}
                {form.surnameGu.trim() ? ` · ${form.surnameGu.trim()}` : ""}
              </p>
            )}
            {matchedGroup && (
              <p className="mb-2 text-[11.5px] text-[#6B6357]">
                Matched existing group: {matchedGroup.nameEn} · {matchedGroup.nameGu}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <AdminLabel>Surname (English) *</AdminLabel>
                <AdminInput value={form.surnameEn} onChange={applySurnameEn} />
              </div>
              <div>
                <AdminLabel>Surname (ગુજરાતી)</AdminLabel>
                <AdminInput value={form.surnameGu} onChange={applySurnameGu} />
              </div>
            </div>
            <AdminLabel>City</AdminLabel>
            <AdminInput value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            {error && <p className="mt-2 text-[12.5px] font-semibold text-[#B0303A]">{error}</p>}
            <div className="mt-4 flex gap-2.5">
              <AdminBtn className="flex-1 justify-center" onClick={createFamily}>
                {addBusy ? <Loader2 className="size-4 animate-spin" /> : "Create family"}
              </AdminBtn>
              <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setAddOpen(false)}>
                Cancel
              </AdminBtn>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={membersOf !== null} onOpenChange={(open) => !open && setMembersOf(null)}>
        <DialogContent
          className="max-h-[88vh] max-w-[460px] overflow-y-auto rounded-2xl p-0 sm:max-w-[460px]"
          showCloseButton={false}
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-[#F1EBDE] bg-white px-6 py-5">
            <div>
              <DialogTitle className="text-base font-extrabold text-[#2A2620]">
                {membersOf
                  ? `${membersOf.headEn}${membersOf.headGu ? ` · ${membersOf.headGu}` : ""} — ${membersOf.surnameEn}${membersOf.surnameGu ? ` · ${membersOf.surnameGu}` : ""}`
                  : "Members"}
              </DialogTitle>
              <p className="mt-0.5 text-xs text-[#938C80]">
                Manage members, visibility, login &amp; status.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMembersOf(null)}
              className="cursor-pointer text-xl leading-none text-[#A79E92]"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="px-6 py-4 pb-5">
            {loadingMembers ? (
              <div className="flex items-center gap-2 py-8 text-[13px] text-[#938C80]">
                <Loader2 className="size-4 animate-spin" /> Loading members…
              </div>
            ) : (
              <>
                {error && <p className="mb-2 text-[12.5px] font-semibold text-[#B0303A]">{error}</p>}
                {members.map((m, i) => {
                  const col = MEMBER_COLORS[i % 5];
                  const name = m.fullNameGu || m.fullNameEn;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "mb-2.5 rounded-[14px] border border-[#F0E9DB] p-3",
                        m.isDeceased ? "bg-[#F6F4F0]" : "bg-white",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] text-sm font-extrabold"
                          style={{ background: col.bg, color: col.c }}
                        >
                          {name.trim()[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-bold text-[#2A2620]">
                            {name}
                            {m.isHead && (
                              <span className="ml-1 rounded-[7px] bg-[#FBEDEE] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[#A62A38]">
                                વડા
                              </span>
                            )}
                          </div>
                          <div className="text-[11.5px] text-[#938C80]">
                            {(m.relation || "Member")} · {m.mobile || "— no login"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember(m)}
                          className="cursor-pointer text-[11px] font-bold text-[#B0303A] underline"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleMember(m, "isVisible")}
                          className={cn(
                            "cursor-pointer rounded-[9px] px-[11px] py-1.5 text-[11.5px] font-bold",
                            m.isVisible ? "bg-[#E4F5E9] text-[#1E9E52]" : "bg-[#F1EBDE] text-[#8B8375]",
                          )}
                        >
                          {m.isVisible ? "👁 Visible" : "🚫 Hidden"}
                        </button>
                        {!m.isHead && (
                          <button
                            type="button"
                            onClick={() => makeHead(m)}
                            className="cursor-pointer rounded-[9px] bg-[#FBEDEE] px-[11px] py-1.5 text-[11.5px] font-bold text-[#A62A38]"
                          >
                            Make head
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => changeLogin(m)}
                          className="cursor-pointer rounded-[9px] bg-[#EEF1F6] px-[11px] py-1.5 text-[11.5px] font-bold text-[#4A5B72]"
                        >
                          Change login #
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleMember(m, "isDeceased")}
                          className={cn(
                            "cursor-pointer rounded-[9px] px-[11px] py-1.5 text-[11.5px] font-bold",
                            m.isDeceased ? "bg-[#2A2620] text-white" : "bg-[#F1EBDE] text-[#8B8375]",
                          )}
                        >
                          {m.isDeceased ? "✓ સ્વર્ગસ્થ" : "Mark deceased"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addMember}
                  className="mb-4 flex h-[46px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-[13px] border-[1.5px] border-dashed border-[#E1BFC3] bg-[#FDF4F5] text-[13px] font-extrabold text-[#A62A38]"
                >
                  + Add member
                </button>

                <AdminBtn
                  className="w-full justify-center"
                  onClick={() => {
                    setMembersOf(null);
                    router.refresh();
                  }}
                >
                  Done
                </AdminBtn>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
