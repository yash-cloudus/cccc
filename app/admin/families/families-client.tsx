"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Pencil, Plus, Trash2, UserPlus, Users, X, ZapOff, Zap } from "lucide-react";
import {
  ActionBtn,
  AdminBtn,
  AdminH2,
  AdminInput,
  AdminSelect,
  AdminTable,
  AdminTd,
  AdminTh,
  FilterButton,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { confirmDialog } from "@/components/admin/confirm-dialog";
import { CascadingOccupationFields } from "@/components/forms/cascading-occupation-fields";
import { DateField } from "@/components/ui/date-field";
import { FamilyDetailsFields } from "@/components/forms/family-details-fields";
import { MemberPlacePicker } from "@/components/forms/member-place-picker";
import { WhatsAppField } from "@/components/forms/whatsapp-field";
import { GENDERS, genderFromRelation } from "@/lib/constants";
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

const FAMILY_STATUS_FILTER_OPTIONS: { value: "all" | FamilyStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "APPROVED", label: "Approved" },
  { value: "PENDING", label: "Pending" },
  { value: "REJECTED", label: "Deactivated" },
];

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

type FamilyExtra = {
  addressEn: string;
  addressGu: string | null;
  nativePlace: string | null;
  businessGu: string | null;
  nativeElderNameEn: string | null;
  nativeElderNameGu: string | null;
  nativeElderPhone: string | null;
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
  /** `Gender` enum value — required before the family can be created. */
  gender: string;
  mobile: string;
  dateOfBirth: string;
  bloodGroup: string;
  hasWhatsApp: boolean;
  /** Only used when `hasWhatsApp` is false — WhatsApp lives on another number. */
  whatsapp: string;
  /** Where this member currently lives — English name of a village / city. */
  place: string;
} & CascadingOccupationValues;

function blankMemberDraft(place = ""): MemberDraft {
  return {
    fullNameEn: "",
    fullNameGu: "",
    relation: "",
    gender: "",
    mobile: "",
    dateOfBirth: "",
    bloodGroup: "",
    hasWhatsApp: true,
    whatsapp: "",
    place,
    ...blankCascadingOccupation(),
  };
}

function blankForm() {
  return {
    headNameEn: "",
    headNameGu: "",
    headGender: "",
    headDateOfBirth: "",
    headBloodGroup: "",
    headHasWhatsApp: true,
    headWhatsapp: "",
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
  const [statusFilter, setStatusFilter] = useState<"all" | FamilyStatus>("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  const [extra, setExtra] = useState<FamilyExtra | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  const cityFilterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.city && r.city !== "—") set.add(r.city);
    }
    return [...set].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (cityFilter !== "all" && f.city !== cityFilter) return false;
      if (
        q &&
        !(f.headEn + f.headGu + f.surnameEn + f.surnameGu + f.city + f.mobile)
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [rows, query, statusFilter, cityFilter]);

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
    if (!form.headGender) {
      setError("Head gender is required");
      return;
    }

    const keptMembers = form.members.filter((m) => m.fullNameEn.trim() || m.fullNameGu.trim());

    const missingRelation = keptMembers.findIndex((m) => !m.relation.trim());
    if (missingRelation >= 0) {
      setError(`Member ${missingRelation + 2}: pick a relation`);
      return;
    }
    const missingGender = keptMembers.findIndex((m) => !m.gender);
    if (missingGender >= 0) {
      setError(`Member ${missingGender + 2}: pick a gender`);
      return;
    }

    setAddBusy(true);
    setError(null);

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
          gender: form.headGender || undefined,
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
          whatsapp: form.headWhatsapp.trim() || undefined,
        },
        ...keptMembers.map((m, i) => ({
          fullNameEn: m.fullNameEn.trim() || m.fullNameGu.trim(),
          fullNameGu: m.fullNameGu.trim() || undefined,
          relation: m.relation || undefined,
          gender: m.gender || undefined,
          mobile: m.mobile || undefined,
          dateOfBirth: m.dateOfBirth || undefined,
          bloodGroup: m.bloodGroup || undefined,
          occupation: resolved[i].occupation || undefined,
          occupationOther: resolved[i].occupationOther || undefined,
          education: resolved[i].education || undefined,
          course: resolved[i].course || undefined,
          currentlyAt: m.place.trim() || form.headPlace.trim() || undefined,
          hasWhatsApp: m.hasWhatsApp,
          whatsapp: m.whatsapp.trim() || undefined,
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
    setExtra(null);
    const res = await api.get<{ familyMembers: Member[] } & FamilyExtra>(`/api/families/${row.id}`);
    setLoadingMembers(false);
    if (res.ok) {
      setMembers(res.data.familyMembers);
      setExtra(res.data);
    } else {
      setError(res.error);
    }
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
        <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search name / surname / city…"
            className="min-w-0 flex-1 md:w-[200px] md:flex-none"
          />
          <FilterButton
            className="md:hidden"
            active={Boolean(statusFilter !== "all" || cityFilter !== "all")}
            onClick={() => setFiltersOpen(true)}
          />
          <div className="hidden items-center gap-2.5 md:flex">
            <AdminSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "all" | FamilyStatus)}
              ariaLabel="Filter by status"
              className="w-[150px] shrink-0"
              options={FAMILY_STATUS_FILTER_OPTIONS}
            />
            {cityFilterOptions.length > 0 && (
              <AdminSelect
                value={cityFilter}
                onChange={setCityFilter}
                ariaLabel="Filter by city"
                className="w-[160px] shrink-0"
                options={[{ value: "all", label: "All cities" }, ...cityFilterOptions]}
              />
            )}
          </div>
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
      </div>

      {/* Mobile-only bottom sheet mirroring the desktop filters */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <AdminSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "all" | FamilyStatus)}
              ariaLabel="Filter by status"
              className="w-full"
              options={FAMILY_STATUS_FILTER_OPTIONS}
            />
            {cityFilterOptions.length > 0 && (
              <AdminSelect
                value={cityFilter}
                onChange={setCityFilter}
                ariaLabel="Filter by city"
                className="w-full"
                options={[{ value: "all", label: "All cities" }, ...cityFilterOptions]}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

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
            <AdminTh className="text-right whitespace-nowrap">Actions</AdminTh>
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
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <ActionBtn
                    icon={Eye}
                    label="View"
                    onClick={() => openMembers(f)}
                  />
                  <ActionBtn
                    icon={Pencil}
                    label="Edit"
                    onClick={() => router.push(`/admin/queue/${f.id}?from=families`)}
                  />
                  <ActionBtn
                    icon={UserPlus}
                    label="Add member"
                    onClick={() => router.push(`/admin/queue/${f.id}?from=families&add=1`)}
                  />

                  <ActionBtn
                    icon={f.status === "APPROVED" ? ZapOff : Zap}
                    label={f.status === "APPROVED" ? "Deactivate" : "Activate"}
                    tone={f.status === "APPROVED" ? "warn" : "success"}
                    onClick={() => toggleStatus(f)}
                  />
                  <ActionBtn
                    icon={Trash2}
                    label="Delete"
                    tone="danger"
                    onClick={() => deleteFamily(f)}
                  />
                </div>
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
            <AdminField label="Gender · જાતિ" required>
              <AdminSelect
                value={form.headGender}
                onChange={(v) => setForm((prev) => ({ ...prev, headGender: v }))}
                className="w-full"
                options={[
                  { value: "", label: "Select gender…" },
                  ...GENDERS.map((g) => ({ value: g.value, label: `${g.en} · ${g.gu}` })),
                ]}
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
              <DateField
                dob
                variant="admin"
                value={form.headDateOfBirth}
                onChange={(v) => setForm({ ...form, headDateOfBirth: v })}
              />
            </AdminField>
            <AdminField label="Blood group">
              <AdminSelect
                value={form.headBloodGroup}
                onChange={(v) => setForm({ ...form, headBloodGroup: v })}
                className="w-full"
                options={[{ value: "", label: "Select blood group" }, ...BLOOD_GROUPS]}
              />
            </AdminField>
          </AdminFormRow>

          <CascadingOccupationFields
            tree={occupationTreeState}
            values={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />

          <WhatsAppField
            className="mt-3"
            hasWhatsApp={form.headHasWhatsApp}
            whatsapp={form.headWhatsapp}
            onChange={(next) =>
              setForm((f) => ({
                ...f,
                headHasWhatsApp: next.hasWhatsApp,
                headWhatsapp: next.whatsapp,
              }))
            }
          />
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
              <AdminField label="Relation (સંબંધ)" required>
                <AdminSelect
                  value={m.relation}
                  onChange={(v) =>
                    // Most relations state the gender; fill it in, but never
                    // overwrite an answer already given.
                    updateMemberDraft(i, {
                      relation: v,
                      ...(m.gender ? {} : { gender: genderFromRelation(v) ?? "" }),
                    })
                  }
                  className="w-full"
                  options={[
                    { value: "", label: "Select relation…" },
                    ...relationOptions.map((r) => ({
                      value: r.nameEn,
                      label: `${r.nameEn}${r.nameGu && r.nameGu !== r.nameEn ? ` · ${r.nameGu}` : ""}`,
                    })),
                  ]}
                />
              </AdminField>
              <AdminField label="Gender · જાતિ" required>
                <AdminSelect
                  value={m.gender}
                  onChange={(v) => updateMemberDraft(i, { gender: v })}
                  className="w-full"
                  options={[
                    { value: "", label: "Select gender…" },
                    ...GENDERS.map((g) => ({ value: g.value, label: `${g.en} · ${g.gu}` })),
                  ]}
                />
              </AdminField>
            </AdminFormRow>

            <AdminField label="Mobile number">
              <AdminInput
                value={m.mobile}
                onChange={(v) =>
                  updateMemberDraft(i, { mobile: v.replace(/\D/g, "").slice(0, 10) })
                }
              />
            </AdminField>

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
                <DateField
                  dob
                  variant="admin"
                  value={m.dateOfBirth}
                  onChange={(v) => updateMemberDraft(i, { dateOfBirth: v })}
                />
              </AdminField>
              <AdminField label="Blood group">
                <AdminSelect
                  value={m.bloodGroup}
                  onChange={(v) => updateMemberDraft(i, { bloodGroup: v })}
                  className="w-full"
                  options={[{ value: "", label: "Select blood group" }, ...BLOOD_GROUPS]}
                />
              </AdminField>
            </AdminFormRow>

            {/* વ્યવસાય — same pattern as the member registration form. */}
            <CascadingOccupationFields
              tree={occupationTreeState}
              values={m}
              onChange={(patch) => updateMemberDraft(i, patch)}
            />

            <WhatsAppField
              hasWhatsApp={m.hasWhatsApp}
              whatsapp={m.whatsapp}
              onChange={(next) => updateMemberDraft(i, next)}
            />
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
                Full family details — manage members, visibility, login &amp; status.
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

                {extra && membersOf && (
                  <AdminTable className="mb-4">
                    <tbody>
                      <tr>
                        <AdminTd className="w-[110px] text-[var(--faint)]">City</AdminTd>
                        <AdminTd>{membersOf.city || "—"}</AdminTd>
                      </tr>
                      <tr>
                        <AdminTd className="text-[var(--faint)]">Mobile</AdminTd>
                        <AdminTd>{membersOf.mobile || "—"}</AdminTd>
                      </tr>
                      <tr>
                        <AdminTd className="text-[var(--faint)]">Address</AdminTd>
                        <AdminTd>{extra.addressGu || extra.addressEn || "—"}</AdminTd>
                      </tr>
                      <tr>
                        <AdminTd className="text-[var(--faint)]">Native place</AdminTd>
                        <AdminTd>{extra.nativePlace || "—"}</AdminTd>
                      </tr>
                      <tr>
                        <AdminTd className="text-[var(--faint)]">Business</AdminTd>
                        <AdminTd>{extra.businessGu || "—"}</AdminTd>
                      </tr>
                      <tr>
                        <AdminTd className="text-[var(--faint)]">Native elder</AdminTd>
                        <AdminTd>
                          {extra.nativeElderNameGu || extra.nativeElderNameEn || "—"}
                          {extra.nativeElderPhone ? ` · ${extra.nativeElderPhone}` : ""}
                        </AdminTd>
                      </tr>
                    </tbody>
                  </AdminTable>
                )}

                <h4 className="mb-2 text-sm font-extrabold text-[var(--ink)]">
                  Members ({members.length})
                </h4>
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

              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
