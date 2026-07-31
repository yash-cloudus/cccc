"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus, Trash2, UserPlus, ZapOff, Zap } from "lucide-react";
import {
  ActionBtn,
  AdminBtn,
  AdminH2,
  AdminInput,
  AdminSelect,
  FilterButton,
  SearchInput,
} from "@/components/admin/admin-ui";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import {
  AdminField,
  AdminFormRow,
  AdminFormSection,
  AdminModal,
  AdminModalActions,
} from "@/components/admin/admin-form";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/http";
import { useAdminT, type AdminKey } from "@/lib/i18n/admin-dictionary";
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

const FAMILY_STATUS_META: Record<FamilyStatus, { labelKey: AdminKey; className: string }> = {
  APPROVED: { labelKey: "fam.statusApproved", className: "bg-[var(--success-tint)] text-[var(--success)]" },
  PENDING: { labelKey: "fam.statusPending", className: "bg-[var(--gold-tint)] text-[var(--warn)]" },
  REJECTED: { labelKey: "fam.statusDeactivated", className: "bg-[var(--line-soft)] text-[var(--muted)]" },
};

function FamilyStatusPill({ status }: { status: FamilyStatus }) {
  const { t } = useAdminT();
  const meta = FAMILY_STATUS_META[status];
  return (
    <span
      className={cn("inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold", meta.className)}
    >
      {t(meta.labelKey)}
    </span>
  );
}

type SurnameOption = { id: string; nameEn: string; nameGu: string };

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
  const { t, tf, lang } = useAdminT();
  const { fromEn, guInput } = useTranslitSync();
  const [rows, setRows] = useState<FamilyRow[]>(initialRows);
  const [groups, setGroups] = useState<SurnameOption[]>(initialGroups);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | FamilyStatus>("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const statusFilterOptions = useMemo<{ value: "all" | FamilyStatus; label: string }[]>(
    () => [
      { value: "all", label: t("fam.allStatuses") },
      { value: "APPROVED", label: t("fam.statusApproved") },
      { value: "PENDING", label: t("fam.statusPending") },
      { value: "REJECTED", label: t("fam.statusDeactivated") },
    ],
    [t],
  );

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
      setError(t("fam.errHeadName"));
      return;
    }
    if (!form.headPlace.trim()) {
      setError(communityType === "PARIVAR" ? t("fam.errHeadCity") : t("fam.errHeadVillage"));
      return;
    }
    if (communityType === "GAM" && !form.surnameEn.trim() && !form.surnameGroupId) {
      setError(t("fam.errSurname"));
      return;
    }
    if (!form.addressEn.trim()) {
      setError(t("fam.errAddress"));
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.headMobile.replace(/\D/g, ""))) {
      setError(t("fam.errHeadMobile"));
      return;
    }
    if (!form.headGender) {
      setError(t("fam.errHeadGender"));
      return;
    }

    const keptMembers = form.members.filter((m) => m.fullNameEn.trim() || m.fullNameGu.trim());

    const missingRelation = keptMembers.findIndex((m) => !m.relation.trim());
    if (missingRelation >= 0) {
      setError(tf("fam.errMemberRelation", { n: missingRelation + 2 }));
      return;
    }
    const missingGender = keptMembers.findIndex((m) => !m.gender);
    if (missingGender >= 0) {
      setError(tf("fam.errMemberGender", { n: missingGender + 2 }));
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

  async function deleteFamily(row: FamilyRow) {
    const label = lang === "en" ? row.headEn || row.headGu : row.headGu || row.headEn;
    const ok = await confirmDialog({
      title: tf("fam.deleteTitle", { name: label }),
      description: t("fam.cannotUndo"),
      confirmLabel: t("common.delete"),
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
    const deactivating = next === "REJECTED";
    const label = lang === "en" ? row.headEn || row.headGu : row.headGu || row.headEn;
    const ok = await confirmDialog({
      title: tf(deactivating ? "fam.deactivateTitle" : "fam.reactivateTitle", { name: label }),
      confirmLabel: t(deactivating ? "fam.deactivate" : "fam.reactivate"),
      tone: deactivating ? "danger" : "primary",
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
        <AdminH2 className="mb-0" info={t("fam.info")}>
          {t("nav.families")}
        </AdminH2>
        <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t("fam.searchPlaceholder")}
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
              ariaLabel={t("fam.filterStatus")}
              className="w-[150px] shrink-0"
              options={statusFilterOptions}
            />
            {cityFilterOptions.length > 0 && (
              <AdminSelect
                value={cityFilter}
                onChange={setCityFilter}
                ariaLabel={t("fam.filterCity")}
                className="w-[160px] shrink-0"
                options={[{ value: "all", label: t("fam.allCities") }, ...cityFilterOptions]}
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
            {t("fam.addDirect")}
          </AdminBtn>
        </div>
      </div>

      {/* Mobile-only bottom sheet mirroring the desktop filters */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>{t("fam.filters")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <AdminSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "all" | FamilyStatus)}
              ariaLabel={t("fam.filterStatus")}
              className="w-full"
              options={statusFilterOptions}
            />
            {cityFilterOptions.length > 0 && (
              <AdminSelect
                value={cityFilter}
                onChange={setCityFilter}
                ariaLabel={t("fam.filterCity")}
                className="w-full"
                options={[{ value: "all", label: t("fam.allCities") }, ...cityFilterOptions]}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {error && !addOpen && (
        <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>
      )}

      <AdminDataTable
        rows={filtered}
        rowKey={(f) => f.id}
        empty={
          <p className="py-8 text-center text-[13px] text-[var(--faint)]">
            {t("fam.noneMatchFilters")}
          </p>
        }
        columns={[
          {
            key: "head",
            header: t("fam.head"),
            primary: true,
            cell: (f) => (
              <>
                <b>{f.headEn}</b>
                {f.headGu ? (
                  <div className="mt-0.5 text-[12px] font-medium text-[var(--ink-dim)]">{f.headGu}</div>
                ) : null}
              </>
            ),
          },
          {
            key: "mobile",
            header: t("fam.mobile"),
            tdClassName: "whitespace-nowrap",
            cell: (f) =>
              f.mobile ? (
                <a href={`tel:${f.mobile}`} className="font-semibold text-[var(--ink)]">
                  {f.mobile}
                </a>
              ) : (
                <span className="text-[var(--faint)]">—</span>
              ),
          },
          {
            key: "surname",
            header: t("fam.surname"),
            cell: (f) => (
              <>
                <span>{f.surnameEn}</span>
                {f.surnameGu ? (
                  <div className="mt-0.5 text-[12px] font-medium text-[var(--ink-dim)]">{f.surnameGu}</div>
                ) : null}
              </>
            ),
          },
          { key: "city", header: t("fam.city"), cell: (f) => f.city },
          { key: "members", header: t("fam.members"), cell: (f) => f.members },
          {
            key: "status",
            header: t("fam.status"),
            badge: true,
            cell: (f) => <FamilyStatusPill status={f.status} />,
          },
          {
            key: "actions",
            header: t("fam.actions"),
            actions: true,
            thClassName: "whitespace-nowrap",
            cell: (f) => (
              <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                <ActionBtn
                  icon={Eye}
                  label={t("common.view")}
                  onClick={() => router.push(`/admin/families/${f.id}`)}
                />
                <ActionBtn
                  icon={Pencil}
                  label={t("common.edit")}
                  onClick={() => router.push(`/admin/queue/${f.id}?from=families`)}
                />
                <ActionBtn
                  icon={UserPlus}
                  label={t("fam.addMember")}
                  onClick={() => router.push(`/admin/queue/${f.id}?from=families&add=1`)}
                />
                <ActionBtn
                  icon={f.status === "APPROVED" ? ZapOff : Zap}
                  label={f.status === "APPROVED" ? t("fam.deactivate") : t("fam.activate")}
                  tone={f.status === "APPROVED" ? "warn" : "success"}
                  onClick={() => toggleStatus(f)}
                />
                <ActionBtn
                  icon={Trash2}
                  label={t("common.delete")}
                  tone="danger"
                  onClick={() => deleteFamily(f)}
                />
              </div>
            ),
          },
        ]}
      />

      {filtered.length === 0 && (
        <p className="py-6 text-center text-[11.5px] text-[var(--faint)]">
          {rows.length === 0 ? t("fam.noFamilies") : t("fam.noneMatchSearch")}
        </p>
      )}

      <AdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t("fam.addDirect")}
        // subtitle="Bypasses the registration queue — the family is approved immediately."
        width="lg"
        footer={
          <AdminModalActions
            onSave={createFamily}
            onCancel={() => setAddOpen(false)}
            saveLabel={t("fam.createFamily")}
            cancelLabel={t("common.cancel")}
            busy={addBusy}
          />
        }
      >
        <AdminFormSection title={t("fam.familyDetails")} />

        <FamilyDetailsFields
          variant="admin"
          values={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          communityType={communityType}
          lockedSurname={lockedSurname}
          surnameGroups={groups}
          allowNewSurname
          t={(gu, en) => (lang === "en" ? en : gu)}
        />
        <AdminFormSection
          title={t("fam.members")}
          className="mt-5"
          info={t("fam.membersInfo")}
        />

        <div className="mb-3 rounded-2xl border border-[var(--gold-border)] bg-[var(--surface-admin)] p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12.5px] font-extrabold text-[var(--ink)]">{t("fam.member1Head")}</span>
            <span className="rounded-lg bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--brand)]">
              {t("fam.familyHead")}
            </span>
          </div>

          <AdminFormRow>
            <AdminField label={t("fam.nameGu")}>
              <AdminInput
                gujarati
                value={form.headNameGu}
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, headNameGu: v }));
                  guInput(v, (gu) => setForm((prev) => ({ ...prev, headNameGu: gu })), "head:gu");
                }}
              />
            </AdminField>
            <AdminField label={t("fam.nameEn")} required>
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
            <AdminField label={t("fam.mobileNumber")} required>
              <AdminInput
                value={form.headMobile}
                onChange={(v) =>
                  setForm({ ...form, headMobile: v.replace(/\D/g, "").slice(0, 10) })
                }
                placeholder={t("fam.mobilePlaceholder")}
              />
            </AdminField>
            <AdminField label={t("fam.gender")} required>
              <AdminSelect
                value={form.headGender}
                onChange={(v) => setForm((prev) => ({ ...prev, headGender: v }))}
                className="w-full"
                options={[
                  { value: "", label: t("fam.selectGender") },
                  ...GENDERS.map((g) => ({ value: g.value, label: `${g.en} · ${g.gu}` })),
                ]}
              />
            </AdminField>
          </AdminFormRow>

          <AdminField
            label={communityType === "GAM" ? t("fam.villageCity") : t("fam.city")}
            required
            hint={t("fam.headPlaceHint")}
          >
            <MemberPlacePicker
              variant="admin"
              value={form.headPlace}
              onChange={(v) => setForm((prev) => ({ ...prev, headPlace: v }))}
              options={allPlaces}
              onAddNew={addPlace}
              t={(gu, en) => (lang === "en" ? en : gu)}
            />
          </AdminField>

          <AdminFormRow>
            <AdminField label={t("fam.birthDate")}>
              <DateField
                dob
                variant="admin"
                value={form.headDateOfBirth}
                onChange={(v) => setForm({ ...form, headDateOfBirth: v })}
              />
            </AdminField>
            <AdminField label={t("fam.bloodGroup")}>
              <AdminSelect
                value={form.headBloodGroup}
                onChange={(v) => setForm({ ...form, headBloodGroup: v })}
                className="w-full"
                options={[{ value: "", label: t("fam.selectBloodGroup") }, ...BLOOD_GROUPS]}
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
                {tf("fam.memberN", { n: i + 1 })}
              </span>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, members: f.members.filter((_, j) => j !== i) }))
                }
                className="cursor-pointer text-[11.5px] font-bold text-[var(--danger)]"
              >
                {t("fam.remove")}
              </button>
            </div>

            <AdminFormRow>
              <AdminField label={t("fam.nameGu")}>
                <AdminInput
                  gujarati
                  value={m.fullNameGu}
                  onChange={(v) => {
                    updateMemberDraft(i, { fullNameGu: v });
                    guInput(v, (gu) => updateMemberDraft(i, { fullNameGu: gu }), `member-${i}:gu`);
                  }}
                />
              </AdminField>
              <AdminField label={t("fam.nameEn")}>
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
              <AdminField label={t("fam.relation")} required>
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
                    { value: "", label: t("fam.selectRelation") },
                    ...relationOptions.map((r) => ({
                      value: r.nameEn,
                      label: `${r.nameEn}${r.nameGu && r.nameGu !== r.nameEn ? ` · ${r.nameGu}` : ""}`,
                    })),
                  ]}
                />
              </AdminField>
              <AdminField label={t("fam.gender")} required>
                <AdminSelect
                  value={m.gender}
                  onChange={(v) => updateMemberDraft(i, { gender: v })}
                  className="w-full"
                  options={[
                    { value: "", label: t("fam.selectGender") },
                    ...GENDERS.map((g) => ({ value: g.value, label: `${g.en} · ${g.gu}` })),
                  ]}
                />
              </AdminField>
            </AdminFormRow>

            <AdminField label={t("fam.mobileNumber")}>
              <AdminInput
                value={m.mobile}
                onChange={(v) =>
                  updateMemberDraft(i, { mobile: v.replace(/\D/g, "").slice(0, 10) })
                }
              />
            </AdminField>

            <AdminField
              label={communityType === "GAM" ? t("fam.villageCity") : t("fam.city")}
              hint={t("fam.memberPlaceHint")}
            >
              <MemberPlacePicker
                variant="admin"
                value={m.place}
                onChange={(v) => updateMemberDraft(i, { place: v })}
                options={allPlaces}
                onAddNew={addPlace}
                t={(gu, en) => (lang === "en" ? en : gu)}
              />
            </AdminField>

            <AdminFormRow>
              <AdminField label={t("fam.birthDate")}>
                <DateField
                  dob
                  variant="admin"
                  value={m.dateOfBirth}
                  onChange={(v) => updateMemberDraft(i, { dateOfBirth: v })}
                />
              </AdminField>
              <AdminField label={t("fam.bloodGroup")}>
                <AdminSelect
                  value={m.bloodGroup}
                  onChange={(v) => updateMemberDraft(i, { bloodGroup: v })}
                  className="w-full"
                  options={[{ value: "", label: t("fam.selectBloodGroup") }, ...BLOOD_GROUPS]}
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
          ＋ {t("fam.addMember")}
        </button>

        {error && <p className="mt-3 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
      </AdminModal>

    </>
  );
}
