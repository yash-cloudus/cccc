"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import {
  AdminBtn,
  AdminH2,
  AdminHint,
  AdminInput,
  AdminSelect,
  AdminTable,
  AdminTd,
  AdminTh,
  LinkAction,
  SearchInput,
} from "@/components/admin/admin-ui";
import {
  AdminField,
  AdminFormRow,
  AdminFormSection,
  AdminModal,
  AdminModalActions,
} from "@/components/admin/admin-form";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";

export type FamilyStatus = "PENDING" | "APPROVED" | "REJECTED";

export type FamilyRow = {
  id: string;
  headEn: string;
  headGu: string;
  surnameEn: string;
  surnameGu: string;
  city: string;
  mobile: string;
  status: FamilyStatus;
  members: number;
};

const FAMILY_STATUS_META: Record<FamilyStatus, { label: string; className: string }> = {
  APPROVED: { label: "Approved", className: "bg-[var(--success-tint)] text-[var(--success)]" },
  PENDING: { label: "Pending", className: "bg-[var(--gold-tint)] text-[var(--warn)]" },
  REJECTED: { label: "Deactivated", className: "bg-[var(--line-soft)] text-[var(--muted)]" },
};

function FamilyStatusPill({ status }: { status: FamilyStatus }) {
  const meta = FAMILY_STATUS_META[status];
  return (
    <span
      className={cn("inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold", meta.className)}
    >
      {meta.label}
    </span>
  );
}

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
  { c: "var(--danger)", bg: "var(--danger-tint)" },
  { c: "var(--violet)", bg: "var(--violet-tint)" },
  { c: "var(--leaf)", bg: "var(--leaf-tint)" },
  { c: "var(--ochre)", bg: "var(--ochre-tint)" },
  { c: "#2A6FA0", bg: "var(--info-tint)" },
];

/** Blood groups offered in the member editor (BloodGroupType enum labels). */
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((b) => ({
  value: b,
  label: b,
}));

export type MemberDraft = {
  fullNameEn: string;
  fullNameGu: string;
  relation: string;
  mobile: string;
  dateOfBirth: string;
  bloodGroup: string;
};

function blankMemberDraft(): MemberDraft {
  return {
    fullNameEn: "",
    fullNameGu: "",
    relation: "",
    mobile: "",
    dateOfBirth: "",
    bloodGroup: "",
  };
}

function blankForm() {
  return {
    headNameEn: "",
    headNameGu: "",
    surnameEn: "",
    surnameGu: "",
    surnameGroupId: "",
    addressEn: "",
    city: "",
    nativePlace: "",
    email: "",
    members: [] as MemberDraft[],
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
  relations = [],
}: {
  initialRows: FamilyRow[];
  surnameGroups: SurnameOption[];
  /** Relation options from Dropdown lists → Relationship. */
  relations?: string[];
}) {
  const router = useRouter();
  const { fromEn, guInput } = useTranslitSync();
  const [rows, setRows] = useState<FamilyRow[]>(initialRows);
  const [groups, setGroups] = useState<SurnameOption[]>(initialGroups);
  const [query, setQuery] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(() => blankForm());
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
        (f.headEn + f.headGu + f.surnameEn + f.surnameGu + f.city + f.mobile)
          .toLowerCase()
          .includes(q),
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
    // Gujarati keyboard only — the English surname is never overwritten from here.
    guInput(v, (gu) => setForm((prev) => ({ ...prev, surnameGu: gu })), "surname:gu");
  }

  function updateMemberDraft(index: number, patch: Partial<MemberDraft>) {
    setForm((f) => ({
      ...f,
      members: f.members.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
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
      addressEn: form.addressEn.trim() || undefined,
      city: form.city.trim() || undefined,
      nativeElderNameEn: form.nativePlace.trim() || undefined,
      email: form.email.trim() || undefined,
      members: form.members
        .filter((m) => m.fullNameEn.trim() || m.fullNameGu.trim())
        .map((m) => ({
          fullNameEn: m.fullNameEn.trim() || m.fullNameGu.trim(),
          fullNameGu: m.fullNameGu.trim() || undefined,
          relation: m.relation || undefined,
          mobile: m.mobile || undefined,
          dateOfBirth: m.dateOfBirth || undefined,
          bloodGroup: m.bloodGroup || undefined,
        })),
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
      // "+ Add family directly" bypasses the registration queue, so the row is
      // approved on arrival. The quick-add form collects no mobile — it is set
      // later via Members, so the column shows "—" until then.
      mobile: "",
      status: "APPROVED",
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
    setForm(blankForm());
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

  /**
   * Deactivating sets REJECTED — the same state the registration queue uses to
   * mean "this family's numbers can no longer log in". Reactivating restores
   * APPROVED. Optimistic, rolled back if the API rejects it.
   */
  async function toggleStatus(row: FamilyRow) {
    const next: FamilyStatus = row.status === "APPROVED" ? "REJECTED" : "APPROVED";
    const verb = next === "APPROVED" ? "Reactivate" : "Deactivate";
    const label = row.headGu || row.headEn;
    if (!window.confirm(`${verb} ${label}'s family?`)) return;

    setRows((prev) => prev.map((f) => (f.id === row.id ? { ...f, status: next } : f)));
    const res = await api.patch(`/api/families/${row.id}`, { status: next });
    if (!res.ok) {
      setRows((prev) => prev.map((f) => (f.id === row.id ? { ...f, status: row.status } : f)));
      setError(res.error);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <AdminH2 className="mb-0">Families &amp; Members</AdminH2>
        <AdminBtn
          onClick={() => {
            setError(null);
            setForm(blankForm());
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
        <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>
      )}

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Head</AdminTh>
            <AdminTh>Mobile</AdminTh>
            <AdminTh>Surname</AdminTh>
            <AdminTh>City</AdminTh>
            <AdminTh>Members</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh className="text-right">Actions</AdminTh>
          </tr>
        </thead>
        <tbody>
          {filtered.map((f) => (
            <tr key={f.id}>
              <AdminTd>
                <b>{f.headEn}</b>
                {f.headGu ? (
                  <div className="mt-0.5 text-[12px] font-medium text-[var(--ink-dim)]">{f.headGu}</div>
                ) : null}
              </AdminTd>
              <AdminTd className="whitespace-nowrap">
                {f.mobile ? (
                  <a href={`tel:${f.mobile}`} className="font-semibold text-[var(--ink)]">
                    {f.mobile}
                  </a>
                ) : (
                  <span className="text-[var(--faint)]">—</span>
                )}
              </AdminTd>
              <AdminTd>
                <span>{f.surnameEn}</span>
                {f.surnameGu ? (
                  <div className="mt-0.5 text-[12px] font-medium text-[var(--ink-dim)]">{f.surnameGu}</div>
                ) : null}
              </AdminTd>
              <AdminTd>{f.city}</AdminTd>
              <AdminTd>{f.members}</AdminTd>
              <AdminTd>
                <FamilyStatusPill status={f.status} />
              </AdminTd>
              <AdminTd className="text-right">
                <span className="flex flex-wrap justify-end gap-1">
                  <LinkAction onClick={() => router.push(`/admin/queue/${f.id}?from=families`)}>
                    Edit
                  </LinkAction>
                  <span className="text-[var(--faint)]">·</span>
                  <LinkAction onClick={() => openMembers(f)}>Members</LinkAction>
                  <span className="text-[var(--faint)]">·</span>
                  <LinkAction onClick={() => toggleStatus(f)}>
                    {f.status === "APPROVED" ? "Deactivate" : "Activate"}
                  </LinkAction>
                  <span className="text-[var(--faint)]">·</span>
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
        <p className="py-6 text-center text-[11.5px] text-[var(--faint)]">
          {rows.length === 0 ? "No families yet." : "No families match your search."}
        </p>
      )}

      <AdminHint>
        Edit: change head name, surname, address, or add/remove members. Member editor:
        visibility overrides · mark deceased (સ્વર્ગસ્થ) · change login number · reassign head.
        &quot;Add family directly&quot; bypasses the registration queue. New surnames are added to
        Surname groups automatically.
      </AdminHint>

      <AdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add family directly"
        subtitle="Bypasses the registration queue — the family is approved immediately."
        width="lg"
        footer={
          <AdminModalActions
            onSave={createFamily}
            onCancel={() => setAddOpen(false)}
            saveLabel="Create family"
            busy={addBusy}
          />
        }
      >
        <AdminFormSection title="Family details" />

        <AdminFormRow>
          <AdminField label="Head name (ગુજરાતી)">
            <AdminInput
              gujarati
              value={form.headNameGu}
              onChange={(v) => {
                setForm((prev) => ({ ...prev, headNameGu: v }));
                guInput(v, (gu) => setForm((prev) => ({ ...prev, surnameGu: gu })), "surname:gu");
              }}
            />
          </AdminField>
          <AdminField label="Head name (English)" required>
            <AdminInput
              value={form.headNameEn}
              onChange={(v) => {
                setForm((prev) => ({ ...prev, headNameEn: v }));
                fromEn(v, (gu) => setForm((prev) => ({ ...prev, headNameGu: gu })), "head");
              }}
            />
          </AdminField>
        </AdminFormRow>

        <AdminField label="Surname group">
          <AdminSelect
            value={form.surnameGroupId || matchedGroup?.id || ""}
            onChange={onPickGroup}
            className="w-full"
            options={[
              {
                value: "",
                label: groups.length === 0
                  ? "Will create from surname below…"
                  : "Select group — or type new surname below",
              },
              ...groups.map((s) => ({ value: s.id, label: `${s.nameEn} · ${s.nameGu}` })),
            ]}
          />
        </AdminField>

        {willCreateGroup && (
          <p className="mb-2 text-[11.5px] font-semibold text-[var(--leaf)]">
            New surname group will be created: {form.surnameEn.trim()}
            {form.surnameGu.trim() ? ` · ${form.surnameGu.trim()}` : ""}
          </p>
        )}
        {matchedGroup && (
          <p className="mb-2 text-[11.5px] text-[var(--ink-dim)]">
            Matched existing group: {matchedGroup.nameEn} · {matchedGroup.nameGu}
          </p>
        )}

        <AdminFormRow>
          <AdminField label="Surname (English)" required>
            <AdminInput value={form.surnameEn} onChange={applySurnameEn} />
          </AdminField>
          <AdminField label="Surname (ગુજરાતી)">
            <AdminInput gujarati value={form.surnameGu} onChange={applySurnameGu} />
          </AdminField>
        </AdminFormRow>

        <AdminField label="Address">
          <Textarea
            value={form.addressEn}
            placeholder="Full postal address…"
            onChange={(e) => setForm({ ...form, addressEn: e.target.value })}
            className="min-h-[64px] border-[var(--line-field)] bg-[var(--field)] text-[13px]"
          />
        </AdminField>

        <AdminFormRow>
          <AdminField label="City">
            <AdminInput value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          </AdminField>
          <AdminField label="Native place (મૂળ ગામ)">
            <AdminInput
              value={form.nativePlace}
              onChange={(v) => setForm({ ...form, nativePlace: v })}
            />
          </AdminField>
        </AdminFormRow>

        <AdminField label="Family email">
          <AdminInput value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        </AdminField>

        <AdminFormSection title="Members" className="mt-5" />
        <p className="mb-3 text-[11.5px] text-[var(--faint)]">
          The head is added automatically. Add the rest of the household here — you can also do it
          later from the Members editor.
        </p>

        {form.members.map((m, i) => (
          <div
            key={i}
            className="mb-3 rounded-2xl border border-[var(--line-admin)] bg-[var(--surface-admin)] p-3.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12.5px] font-extrabold text-[var(--ink)]">
                Member {i + 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, members: f.members.filter((_, j) => j !== i) }))
                }
                className="cursor-pointer text-[11.5px] font-bold text-[var(--danger)]"
              >
                Remove
              </button>
            </div>

            <AdminFormRow>
              <AdminField label="Name (ગુજરાતી)">
                <AdminInput
                  gujarati
                  value={m.fullNameGu}
                  onChange={(v) => {
                    updateMemberDraft(i, { fullNameGu: v });
                    guInput(v, (gu) => updateMemberDraft(i, { fullNameGu: gu }), `member-${i}:gu`);
                  }}
                />
              </AdminField>
              <AdminField label="Name (English)">
                <AdminInput
                  value={m.fullNameEn}
                  onChange={(v) => {
                    updateMemberDraft(i, { fullNameEn: v });
                    fromEn(v, (gu) => updateMemberDraft(i, { fullNameGu: gu }), `member-${i}`);
                  }}
                />
              </AdminField>
            </AdminFormRow>

            <AdminFormRow>
              <AdminField label="Relation (સંબંધ)">
                <AdminSelect
                  value={m.relation}
                  onChange={(v) => updateMemberDraft(i, { relation: v })}
                  className="w-full"
                  options={[
                    { value: "", label: "—" },
                    ...relations.map((r) => ({ value: r, label: r })),
                  ]}
                />
              </AdminField>
              <AdminField label="Mobile number">
                <AdminInput
                  value={m.mobile}
                  onChange={(v) =>
                    updateMemberDraft(i, { mobile: v.replace(/\D/g, "").slice(0, 10) })
                  }
                />
              </AdminField>
            </AdminFormRow>

            <AdminFormRow>
              <AdminField label="Birth date">
                <AdminInput
                  type="date"
                  value={m.dateOfBirth}
                  onChange={(v) => updateMemberDraft(i, { dateOfBirth: v })}
                />
              </AdminField>
              <AdminField label="Blood group">
                <AdminSelect
                  value={m.bloodGroup}
                  onChange={(v) => updateMemberDraft(i, { bloodGroup: v })}
                  className="w-full"
                  options={[{ value: "", label: "—" }, ...BLOOD_GROUPS]}
                />
              </AdminField>
            </AdminFormRow>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, members: [...f.members, blankMemberDraft()] }))}
          className="w-full cursor-pointer rounded-[13px] border-[1.5px] border-dashed border-[var(--brand-border)] bg-[var(--brand-tint-soft)] py-3 text-[13px] font-bold text-[var(--brand)]"
        >
          ＋ Add member
        </button>

        {error && <p className="mt-3 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
      </AdminModal>

      <Dialog open={membersOf !== null} onOpenChange={(open) => !open && setMembersOf(null)}>
        <DialogContent
          className="max-h-[88vh] max-w-[460px] overflow-y-auto rounded-2xl p-0 sm:max-w-[460px]"
          showCloseButton={false}
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-[var(--line-soft)] bg-white px-6 py-5">
            <div>
              <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
                {membersOf
                  ? `${membersOf.headEn}${membersOf.headGu ? ` · ${membersOf.headGu}` : ""} — ${membersOf.surnameEn}${membersOf.surnameGu ? ` · ${membersOf.surnameGu}` : ""}`
                  : "Members"}
              </DialogTitle>
              <p className="mt-0.5 text-xs text-[var(--faint)]">
                Manage members, visibility, login &amp; status.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMembersOf(null)}
              className="cursor-pointer text-xl leading-none text-[var(--faint-soft)]"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="px-6 py-4 pb-5">
            {loadingMembers ? (
              <div className="flex items-center gap-2 py-8 text-[13px] text-[var(--faint)]">
                <Loader2 className="size-4 animate-spin" /> Loading members…
              </div>
            ) : (
              <>
                {error && <p className="mb-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
                {members.map((m, i) => {
                  const col = MEMBER_COLORS[i % 5];
                  const name = m.fullNameGu || m.fullNameEn;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "mb-2.5 rounded-[14px] border border-[var(--line)] p-3",
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
                          <div className="text-[13.5px] font-bold text-[var(--ink)]">
                            {name}
                            {m.isHead && (
                              <span className="ml-1 rounded-[7px] bg-[var(--brand-tint)] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[var(--brand)]">
                                વડા
                              </span>
                            )}
                          </div>
                          <div className="text-[11.5px] text-[var(--faint)]">
                            {(m.relation || "Member")} · {m.mobile || "— no login"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember(m)}
                          className="cursor-pointer text-[11px] font-bold text-[var(--danger)] underline"
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
                            m.isVisible ? "bg-[var(--success-tint)] text-[var(--success)]" : "bg-[var(--line-soft)] text-[var(--muted)]",
                          )}
                        >
                          {m.isVisible ? "👁 Visible" : "🚫 Hidden"}
                        </button>
                        {!m.isHead && (
                          <button
                            type="button"
                            onClick={() => makeHead(m)}
                            className="cursor-pointer rounded-[9px] bg-[var(--brand-tint)] px-[11px] py-1.5 text-[11.5px] font-bold text-[var(--brand)]"
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
                            m.isDeceased ? "bg-[var(--ink)] text-white" : "bg-[var(--line-soft)] text-[var(--muted)]",
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
                  className="mb-4 flex h-[46px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-[13px] border-[1.5px] border-dashed border-[var(--brand-line)] bg-[var(--brand-tint-soft)] text-[13px] font-extrabold text-[var(--brand)]"
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
