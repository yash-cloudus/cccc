"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import {
  AdminBtn,
  AdminH2,
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
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import { CascadingOccupationFields } from "@/components/forms/cascading-occupation-fields";
import { FamilyDetailsFields } from "@/components/forms/family-details-fields";
import { MemberPlacePicker } from "@/components/forms/member-place-picker";
import { familyPlaceFromHead } from "@/lib/family-form";
import {
  type CascadingOccupationValues,
  blankCascadingOccupation,
  resolveCascadingOccupationForSave,
} from "@/lib/cascading-occupation";
import type { OccupationTreeNode } from "@/lib/occupation-defaults";

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
  hasWhatsApp: boolean;
  /** Where this member currently lives — English name of a village / city. */
  place: string;
} & CascadingOccupationValues;

function blankMemberDraft(place = ""): MemberDraft {
  return {
    fullNameEn: "",
    fullNameGu: "",
    relation: "",
    mobile: "",
    dateOfBirth: "",
    bloodGroup: "",
    hasWhatsApp: true,
    place,
    ...blankCascadingOccupation(),
  };
}

function blankForm() {
  return {
    headNameEn: "",
    headNameGu: "",
    headDateOfBirth: "",
    headBloodGroup: "",
    headHasWhatsApp: true,
    /** The head's village / city — becomes the family's place of record. */
    headPlace: "",
    surnameEn: "",
    surnameGu: "",
    surnameGroupId: "",
    addressEn: "",
    // Gujarati address, elder name and map pin — the member registration form
    // has always collected these; the admin form now matches it.
    addressGu: "",
    city: "",
    nativePlace: "",
    email: "",
    villageAreaId: "",
    livesOutsideVillage: false,
    nativeElderNameEn: "",
    nativeElderNameGu: "",
    nativeElderPhone: "",
    latitude: null as number | null,
    longitude: null as number | null,
    headMobile: "",
    ...blankCascadingOccupation(),
    members: [] as MemberDraft[],
  };
}

function matchGroup(groups: SurnameOption[], surnameEn: string) {
  const q = surnameEn.trim().toLowerCase();
  if (!q) return null;
  return groups.find((g) => g.nameEn.trim().toLowerCase() === q) ?? null;
}

export function FamiliesClient({
  communityType = "PARIVAR",
  lockedSurname = null,
  initialRows,
  surnameGroups: initialGroups,
  cities = [],
  villages = [],
  relations = [],
  occupationTree,
}: {
  communityType?: "PARIVAR" | "GAM";
  lockedSurname?: SurnameOption | null;
  initialRows: FamilyRow[];
  surnameGroups: SurnameOption[];
  cities?: SurnameOption[];
  villages?: SurnameOption[];
  relations?: { nameEn: string; nameGu: string }[] | string[];
  occupationTree: OccupationTreeNode[];
}) {
  const router = useRouter();
  const { fromEn, guInput } = useTranslitSync();
  const [rows, setRows] = useState<FamilyRow[]>(initialRows);
  const [groups, setGroups] = useState<SurnameOption[]>(initialGroups);
  const [query, setQuery] = useState("");

  const relationOptions = useMemo(() => {
    return relations.map((r) =>
      typeof r === "string" ? { nameEn: r, nameGu: r } : r,
    );
  }, [relations]);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(() => {
    const base = blankForm();
    if (lockedSurname) {
      return {
        ...base,
        surnameGroupId: lockedSurname.id,
        surnameEn: lockedSurname.nameEn,
        surnameGu: lockedSurname.nameGu,
      };
    }
    return base;
  });
  const [addBusy, setAddBusy] = useState(false);

  const [occupationTreeState, setOccupationTreeState] = useState(occupationTree);

  useEffect(() => setOccupationTreeState(occupationTree), [occupationTree]);

  /**
   * Places a member can live in — villages for a Gam community, cities for a
   * Parivar one. A place typed into the picker is persisted to the matching
   * master list so the next admin picks it instead of retyping it.
   */
  const [extraPlaces, setExtraPlaces] = useState<SurnameOption[]>([]);
  const basePlaces = communityType === "GAM" ? villages : cities;
  const allPlaces = useMemo(
    () => [...basePlaces, ...extraPlaces],
    [basePlaces, extraPlaces],
  );

  async function addPlace({ nameEn, nameGu }: { nameEn: string; nameGu: string }) {
    if (allPlaces.some((p) => p.nameEn.toLowerCase() === nameEn.toLowerCase())) return;
    setExtraPlaces((prev) => [...prev, { id: `pending:${nameEn}`, nameEn, nameGu }]);
    const body = { nameEn, nameGu: nameGu || nameEn };
    const res =
      communityType === "GAM"
        ? await api.post<{ id: string; nameEn: string; nameGu: string }>(
            "/api/admin/villages",
            body,
          )
        : await api.post<{ id: string; nameEn: string; nameGu: string }>("/api/admin/dropdowns", {
            type: "city",
            ...body,
          });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Swap the optimistic row for the saved one so its id is real.
    setExtraPlaces((prev) =>
      prev.map((p) =>
        p.id === `pending:${nameEn}`
          ? { id: res.data.id, nameEn: res.data.nameEn, nameGu: res.data.nameGu ?? "" }
          : p,
      ),
    );
    router.refresh();
  }

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
  function updateMemberDraft(index: number, patch: Partial<MemberDraft>) {
    setForm((f) => ({
      ...f,
      members: f.members.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
  }

  async function createFamily() {
    if (!form.headNameEn.trim()) {
      setError("Head name is required");
      return;
    }
    if (!form.headPlace.trim()) {
      setError(communityType === "PARIVAR" ? "Head's city is required" : "Head's village / city is required");
      return;
    }
    if (communityType === "GAM" && !form.surnameEn.trim() && !form.surnameGroupId) {
      setError("Surname is required");
      return;
    }
    if (!form.addressEn.trim()) {
      setError("Address is required");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.headMobile.replace(/\D/g, ""))) {
      setError("Head mobile is required (10 digits, starts with 6–9)");
      return;
    }
    setAddBusy(true);
    setError(null);

    const keptMembers = form.members.filter((m) => m.fullNameEn.trim() || m.fullNameGu.trim());

    const resolved = await Promise.all(
      keptMembers.map((m) => resolveCascadingOccupationForSave(occupationTreeState, m)),
    );
    const resolvedHead = await resolveCascadingOccupationForSave(occupationTreeState, form);

    const surnameEn =
      communityType === "PARIVAR" && lockedSurname
        ? lockedSurname.nameEn
        : form.surnameEn.trim();
    const surnameGu =
      communityType === "PARIVAR" && lockedSurname
        ? lockedSurname.nameGu
        : form.surnameGu.trim();

    // Family place of record = the head's place (members each carry their own).
    const place = familyPlaceFromHead(form.headPlace, villages);

    const payload = {
      headNameEn: form.headNameEn.trim(),
      headNameGu: form.headNameGu.trim() || undefined,
      surnameEn: surnameEn || undefined,
      surnameGu: surnameGu || undefined,
      surnameGroupId:
        (communityType === "PARIVAR" && lockedSurname
          ? lockedSurname.id
          : form.surnameGroupId || matchedGroup?.id) || undefined,
      addressEn: form.addressEn.trim() || undefined,
      addressGu: form.addressGu.trim() || undefined,
      city: place.city || undefined,
      nativePlace: form.nativePlace.trim() || undefined,
      email: form.email.trim() || undefined,
      villageAreaId: place.villageAreaId,
      livesOutsideVillage: place.livesOutsideVillage,
      nativeElderNameEn: form.nativeElderNameEn.trim() || undefined,
      nativeElderNameGu: form.nativeElderNameGu.trim() || undefined,
      nativeElderPhone: form.nativeElderPhone.trim() || undefined,
      latitude: form.latitude ?? undefined,
      longitude: form.longitude ?? undefined,
      members: [
        {
          fullNameEn: form.headNameEn.trim(),
          fullNameGu: form.headNameGu.trim() || undefined,
          relation: "Head",
          mobile: form.headMobile.replace(/\D/g, ""),
          dateOfBirth: form.headDateOfBirth || undefined,
          bloodGroup: form.headBloodGroup || undefined,
          occupation: resolvedHead.occupation || undefined,
          occupationOther: resolvedHead.occupationOther || undefined,
          education: resolvedHead.education || undefined,
          course: resolvedHead.course || undefined,
          isHead: true,
          currentlyAt: form.headPlace.trim() || undefined,
          hasWhatsApp: form.headHasWhatsApp,
        },
        ...keptMembers.map((m, i) => ({
          fullNameEn: m.fullNameEn.trim() || m.fullNameGu.trim(),
          fullNameGu: m.fullNameGu.trim() || undefined,
          relation: m.relation || undefined,
          mobile: m.mobile || undefined,
          dateOfBirth: m.dateOfBirth || undefined,
          bloodGroup: m.bloodGroup || undefined,
          occupation: resolved[i].occupation || undefined,
          occupationOther: resolved[i].occupationOther || undefined,
          education: resolved[i].education || undefined,
          course: resolved[i].course || undefined,
          currentlyAt: m.place.trim() || form.headPlace.trim() || undefined,
          hasWhatsApp: m.hasWhatsApp,
          isHead: false,
        })),
      ],
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
      mobile: form.headMobile.replace(/\D/g, ""),
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
    setForm(() => {
      const base = blankForm();
      if (lockedSurname) {
        return {
          ...base,
          surnameGroupId: lockedSurname.id,
          surnameEn: lockedSurname.nameEn,
          surnameGu: lockedSurname.nameGu,
        };
      }
      return base;
    });
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
    const ok = await confirmDialog({
      title: `Delete ${label}'s family?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
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
    const ok = await confirmDialog({
      title: `${verb} ${label}'s family?`,
      confirmLabel: verb,
      tone: next === "REJECTED" ? "danger" : "primary",
    });
    if (!ok) return;

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
        <AdminH2
          className="mb-0"
          info={
            <>
              Edit: change head name, surname, address, or add/remove members. Member editor:
              visibility overrides · mark deceased (સ્વર્ગસ્થ) · change login number · reassign head.
              &quot;Add family directly&quot; bypasses the registration queue. New surnames are added to
              Surname groups automatically.
            </>
          }
        >
          Families &amp; Members
        </AdminH2>
        <AdminBtn
          onClick={() => {
            setError(null);
            const base = blankForm();
            setForm(
              lockedSurname
                ? {
                    ...base,
                    surnameGroupId: lockedSurname.id,
                    surnameEn: lockedSurname.nameEn,
                    surnameGu: lockedSurname.nameGu,
                  }
                : base,
            );
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

      <AdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add family directly"
        // subtitle="Bypasses the registration queue — the family is approved immediately."
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

        <FamilyDetailsFields
          variant="admin"
          values={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          communityType={communityType}
          lockedSurname={lockedSurname}
          surnameGroups={groups}
          allowNewSurname
          t={(_gu, en) => en}
        />
        <AdminFormSection
          title="Members"
          className="mt-5"
          info={
            <>
              First person is the family head. Add other household members below — or later from
              Members.
            </>
          }
        />

        <div className="mb-3 rounded-2xl border border-[var(--gold-border)] bg-[var(--surface-admin)] p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12.5px] font-extrabold text-[var(--ink)]">Member 1 · Head</span>
            <span className="rounded-lg bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--brand)]">
              Family head
            </span>
          </div>

          <AdminFormRow>
            <AdminField label="Name (ગુજરાતી)">
              <AdminInput
                gujarati
                value={form.headNameGu}
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, headNameGu: v }));
                  guInput(v, (gu) => setForm((prev) => ({ ...prev, headNameGu: gu })), "head:gu");
                }}
              />
            </AdminField>
            <AdminField label="Name (English)" required>
              <AdminInput
                speech
                value={form.headNameEn}
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, headNameEn: v }));
                  fromEn(v, (gu) => setForm((prev) => ({ ...prev, headNameGu: gu })), "head");
                }}
              />
            </AdminField>
          </AdminFormRow>

          <AdminFormRow>
            <AdminField label="Mobile number" required>
              <AdminInput
                value={form.headMobile}
                onChange={(v) =>
                  setForm({ ...form, headMobile: v.replace(/\D/g, "").slice(0, 10) })
                }
                placeholder="10-digit mobile"
              />
            </AdminField>
            <AdminField label="Relation (સંબંધ)">
              <AdminSelect
                value="Head"
                onChange={() => undefined}
                className="w-full"
                options={[{ value: "Head", label: "Head · વડા" }]}
              />
            </AdminField>
          </AdminFormRow>

          <AdminField
            label={communityType === "GAM" ? "Village / city · ગામ / શહેર" : "City · શહેર"}
            required
            hint="Where the head lives — this is also the family's place in the directory."
          >
            <MemberPlacePicker
              variant="admin"
              value={form.headPlace}
              onChange={(v) => setForm((prev) => ({ ...prev, headPlace: v }))}
              options={allPlaces}
              onAddNew={addPlace}
              t={(_gu, en) => en}
            />
          </AdminField>

          <AdminFormRow>
            <AdminField label="Birth date">
              <AdminInput
                type="date"
                value={form.headDateOfBirth}
                onChange={(v) => setForm({ ...form, headDateOfBirth: v })}
              />
            </AdminField>
            <AdminField label="Blood group">
              <AdminSelect
                value={form.headBloodGroup}
                onChange={(v) => setForm({ ...form, headBloodGroup: v })}
                className="w-full"
                options={[{ value: "", label: "—" }, ...BLOOD_GROUPS]}
              />
            </AdminField>
          </AdminFormRow>

          <CascadingOccupationFields
            tree={occupationTreeState}
            values={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-mid)]">
            <input
              type="checkbox"
              checked={form.headHasWhatsApp}
              onChange={(e) => setForm({ ...form, headHasWhatsApp: e.target.checked })}
              className="size-4 accent-[var(--wa)]"
            />
            આ નંબર પર WhatsApp છે
          </label>
        </div>

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
                  speech
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
                    ...relationOptions.map((r) => ({
                      value: r.nameEn,
                      label: `${r.nameEn}${r.nameGu && r.nameGu !== r.nameEn ? ` · ${r.nameGu}` : ""}`,
                    })),
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

            <AdminField
              label={communityType === "GAM" ? "Village / city · ગામ / શહેર" : "City · શહેર"}
              hint="Defaults to the head's — change it for a member living elsewhere."
            >
              <MemberPlacePicker
                variant="admin"
                value={m.place}
                onChange={(v) => updateMemberDraft(i, { place: v })}
                options={allPlaces}
                onAddNew={addPlace}
                t={(_gu, en) => en}
              />
            </AdminField>

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

            {/* વ્યવસાય — same pattern as the member registration form. */}
            <CascadingOccupationFields
              tree={occupationTreeState}
              values={m}
              onChange={(patch) => updateMemberDraft(i, patch)}
            />

            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-mid)]">
              <input
                type="checkbox"
                checked={m.hasWhatsApp}
                onChange={(e) => updateMemberDraft(i, { hasWhatsApp: e.target.checked })}
                className="size-4 accent-[var(--wa)]"
              />
              આ નંબર પર WhatsApp છે
            </label>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setForm((f) => ({ ...f, members: [...f.members, blankMemberDraft(f.headPlace)] }))
          }
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
