"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  AdminBtn,
  AdminCellInput,
  AdminH2,
  AdminH3,
  AdminHint,
  AdminInput,
  AdminLabel,
  AdminSelect,
  FilterChip,
} from "@/components/admin/admin-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BLOOD_GROUPS, REJECT_REASONS } from "@/lib/constants";
import { api } from "@/lib/http";
import { useTranslitSync } from "@/hooks/use-translit-sync";
import { CascadingOccupationFields } from "@/components/forms/cascading-occupation-fields";
import {
  type CascadingOccupationValues,
  blankCascadingOccupation,
  resolveCascadingOccupationForSave,
} from "@/lib/cascading-occupation";
import type { OccupationTreeNode } from "@/lib/occupation-defaults";

export type EditMember = {
  id: string;
  isNew: boolean;
  fullNameEn: string;
  fullNameGu: string;
  relation: string;
  mobile: string;
  dateOfBirth: string;
  bloodGroup: string;
  isHead: boolean;
} & CascadingOccupationValues;

export type EditFamily = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  headNameEn: string;
  headNameGu: string;
  surnameEn: string;
  surnameGu: string;
  surnameGroupId: string;
  addressEn: string;
  addressGu: string;
  city: string;
  nativePlace: string;
  email: string;
  villageAreaId: string;
  livesOutsideVillage: boolean;
  businessGu: string;
  nativeElderNameEn: string;
  nativeElderNameGu: string;
  nativeElderPhone: string;
  members: EditMember[];
};

type SurnameOption = { id: string; nameEn: string; nameGu: string };

export function ReviewClient({
  communityType = "PARIVAR",
  lockedSurname = null,
  family: initial,
  surnameGroups,
  cities = [],
  villages = [],
  relations = [],
  occupationTree,
  backHref = "/admin/queue",
  backLabel = "‹ Back to queue",
}: {
  communityType?: "PARIVAR" | "GAM";
  lockedSurname?: SurnameOption | null;
  family: EditFamily;
  surnameGroups: SurnameOption[];
  cities?: SurnameOption[];
  villages?: SurnameOption[];
  relations?: { nameEn: string; nameGu: string }[];
  occupationTree: OccupationTreeNode[];
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const { fromEn, guInput } = useTranslitSync();
  const [f, setF] = useState<EditFamily>(structuredClone(initial));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState<"save" | "approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setField = <K extends keyof EditFamily>(k: K, v: EditFamily[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const setMember = (id: string, k: keyof EditMember, v: string | boolean) =>
    setF((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === id ? { ...m, [k]: v } : m)),
    }));

  const removeMember = (id: string) =>
    setF((prev) => ({ ...prev, members: prev.members.filter((m) => m.id !== id) }));

  const addMember = () =>
    setF((prev) => ({
      ...prev,
      members: [
        ...prev.members,
        {
          id: `new_${Date.now()}`,
          isNew: true,
          fullNameEn: "",
          fullNameGu: "",
          relation: "",
          mobile: "",
          dateOfBirth: "",
          bloodGroup: "",
          isHead: false,
          ...blankCascadingOccupation(),
        },
      ],
    }));

  async function buildPayload() {
    const resolvedMembers = await Promise.all(
      f.members.map((m) => resolveCascadingOccupationForSave(occupationTree, m)),
    );
    return {
      headNameEn: f.headNameEn,
      headNameGu: f.headNameGu || null,
      surnameEn:
        communityType === "PARIVAR" && lockedSurname
          ? lockedSurname.nameEn
          : f.surnameEn,
      surnameGu:
        communityType === "PARIVAR" && lockedSurname
          ? lockedSurname.nameGu
          : f.surnameGu || null,
      surnameGroupId:
        communityType === "PARIVAR" && lockedSurname
          ? lockedSurname.id
          : f.surnameGroupId,
      addressEn: f.addressEn || null,
      addressGu: f.addressGu || null,
      city: f.city || null,
      nativePlace: f.nativePlace || null,
      email: f.email || null,
      villageAreaId: f.livesOutsideVillage ? null : f.villageAreaId || null,
      businessGu: f.businessGu || null,
      nativeElderNameEn: f.nativeElderNameEn || null,
      nativeElderNameGu: f.nativeElderNameGu || null,
      nativeElderPhone: f.nativeElderPhone || null,
      members: f.members.map((m, i) => ({
        ...(m.isNew ? {} : { id: m.id }),
        fullNameEn: m.fullNameEn,
        fullNameGu: m.fullNameGu || null,
        relation: m.relation || null,
        mobile: m.mobile || null,
        dateOfBirth: m.dateOfBirth || null,
        bloodGroup: m.bloodGroup || null,
        occupation: resolvedMembers[i].occupation || null,
        occupationOther: resolvedMembers[i].occupationOther || null,
        education: resolvedMembers[i].education || null,
        course: resolvedMembers[i].course || null,
        isHead: m.isHead,
      })),
    };
  }

  async function save(): Promise<boolean> {
    setBusy("save");
    setError(null);
    setNotice(null);
    const res = await api.put(`/api/families/${f.id}`, await buildPayload());
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setNotice("Changes saved.");
    return true;
  }

  async function approve() {
    setBusy("approve");
    setError(null);
    const saved = await api.put(`/api/families/${f.id}`, await buildPayload());
    if (!saved.ok) {
      setBusy(null);
      setError(saved.error);
      return;
    }
    const res = await api.patch(`/api/families`, { id: f.id, status: "APPROVED" });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(backHref);
    router.refresh();
  }

  async function reject() {
    if (!rejectReason.trim()) {
      setError("Reject reason is required");
      return;
    }
    setBusy("reject");
    setError(null);
    const res = await api.patch(`/api/families`, {
      id: f.id,
      status: "REJECTED",
      rejectReason,
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRejectOpen(false);
    router.push(backHref);
    router.refresh();
  }

  return (
    <>
      <Link
        href={backHref}
        className="mb-2.5 block cursor-pointer text-[12.5px] font-bold text-[var(--brand)]"
      >
        {backLabel}
      </Link>

      <AdminH2 className="mb-1.5">
        {f.status === "PENDING" ? "Review & edit" : "Edit"}: {f.headNameGu || f.headNameEn} (
        {f.surnameGu || f.surnameEn})
      </AdminH2>
      <AdminHint className="mt-0 mb-[18px]">
        {f.status === "PENDING"
          ? "Edit any field, then Save or Approve. Approving activates family login numbers."
          : "Edit any field, then Save."}
      </AdminHint>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <AdminH3>Family details</AdminH3>
          <AdminLabel>Head name (English)</AdminLabel>
          <AdminInput
            value={f.headNameEn}
            onChange={(v) => {
              setField("headNameEn", v);
              fromEn(v, (gu) => setField("headNameGu", gu), "head");
            }}
          />
          <AdminLabel>Head name (ગુજરાતી)</AdminLabel>
          <AdminInput
            gujarati
            value={f.headNameGu}
            onChange={(v) => {
              setField("headNameGu", v);
              guInput(v, (gu) => setField("headNameGu", gu), "head:gu");
            }}
          />
          {communityType === "PARIVAR" ? (
            <>
              <AdminLabel>Surname (locked)</AdminLabel>
              <p className="mb-3 rounded-xl border border-[var(--line-admin)] bg-[var(--surface-admin)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink)]">
                {lockedSurname
                  ? `${lockedSurname.nameEn}${lockedSurname.nameGu ? ` · ${lockedSurname.nameGu}` : ""}`
                  : `${f.surnameEn}${f.surnameGu ? ` · ${f.surnameGu}` : ""}`}
              </p>
              <AdminLabel>City · શહેર</AdminLabel>
              <AdminSelect
                value={f.city}
                onChange={(v) => setField("city", v)}
                className="w-full"
                options={[
                  { value: "", label: "Select city…" },
                  ...cities.map((c) => ({
                    value: c.nameEn,
                    label: `${c.nameEn}${c.nameGu ? ` · ${c.nameGu}` : ""}`,
                  })),
                ]}
              />
            </>
          ) : (
            <>
              <AdminLabel>Surname group</AdminLabel>
              <AdminSelect
                value={f.surnameGroupId}
                onChange={(v) => {
                  const g = surnameGroups.find((s) => s.id === v);
                  setField("surnameGroupId", v);
                  if (g) {
                    setField("surnameEn", g.nameEn);
                    setField("surnameGu", g.nameGu);
                  }
                }}
                className="w-full"
                options={surnameGroups.map((s) => ({
                  value: s.id,
                  label: `${s.nameEn} · ${s.nameGu}`,
                }))}
              />
              <AdminLabel>Surname (English)</AdminLabel>
              <AdminInput
                value={f.surnameEn}
                onChange={(v) => {
                  setField("surnameEn", v);
                  fromEn(v, (gu) => setField("surnameGu", gu), "surname");
                }}
              />
              <AdminLabel>Surname (ગુજરાતી)</AdminLabel>
              <AdminInput
                gujarati
                value={f.surnameGu}
                onChange={(v) => {
                  setField("surnameGu", v);
                  guInput(v, (gu) => setField("surnameGu", gu), "surname:gu");
                }}
              />
              <AdminLabel>Village · ગામ</AdminLabel>
              <AdminSelect
                value={f.livesOutsideVillage ? "__outside__" : f.villageAreaId}
                onChange={(v) => {
                  if (v === "__outside__") {
                    setField("livesOutsideVillage", true);
                    setField("villageAreaId", "");
                  } else {
                    setField("livesOutsideVillage", false);
                    setField("villageAreaId", v);
                  }
                }}
                className="w-full"
                options={[
                  { value: "", label: "Select village…" },
                  ...villages.map((v) => ({
                    value: v.id,
                    label: `${v.nameEn}${v.nameGu ? ` · ${v.nameGu}` : ""}`,
                  })),
                  { value: "__outside__", label: "Lives outside · બહાર" },
                ]}
              />
              <AdminLabel>{f.livesOutsideVillage ? "City · શહેર *" : "City"}</AdminLabel>
              <AdminInput value={f.city} onChange={(v) => setField("city", v)} />
            </>
          )}
          <AdminLabel>Address (English)</AdminLabel>
          <AdminInput value={f.addressEn} onChange={(v) => setField("addressEn", v)} />
          <AdminLabel>Address (ગુજરાતી)</AdminLabel>
          <AdminInput value={f.addressGu} onChange={(v) => setField("addressGu", v)} />
          <AdminLabel>Business (ગુજરાતી)</AdminLabel>
          <AdminInput value={f.businessGu} onChange={(v) => setField("businessGu", v)} />
          <AdminLabel>Native elder name (English)</AdminLabel>
          <AdminInput value={f.nativeElderNameEn} onChange={(v) => setField("nativeElderNameEn", v)} />
          <AdminLabel>Native elder name (ગુજરાતી)</AdminLabel>
          <AdminInput value={f.nativeElderNameGu} onChange={(v) => setField("nativeElderNameGu", v)} />
          <AdminLabel>Native elder phone</AdminLabel>
          <AdminInput value={f.nativeElderPhone} onChange={(v) => setField("nativeElderPhone", v)} />
        </div>

        <div>
          <AdminH3>Members ({f.members.length})</AdminH3>
          {f.members.map((m, idx) => (
            <div key={m.id} className="mb-3 rounded-xl border border-[#EEE7DA] bg-[var(--field)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <b className="text-[12.5px] text-[var(--ink)]">
                  Member {idx + 1}
                  {m.isHead ? " · Head" : ""}
                </b>
                <button
                  type="button"
                  onClick={() => removeMember(m.id)}
                  className="cursor-pointer text-xs font-bold text-[var(--danger)] underline"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-[10.5px] font-bold text-[var(--faint)]">Name (English)</div>
                  <AdminCellInput
                    value={m.fullNameEn}
                    onChange={(v) => {
                      setMember(m.id, "fullNameEn", v);
                      fromEn(v, (gu) => setMember(m.id, "fullNameGu", gu), `member-${m.id}`);
                    }}
                  />
                </div>
                <div>
                  <div className="mb-1 text-[10.5px] font-bold text-[var(--faint)]">Name (ગુજરાતી)</div>
                  <AdminCellInput
                    value={m.fullNameGu}
                    onChange={(v) => {
                      setMember(m.id, "fullNameGu", v);
                      guInput(v, (gu) => setMember(m.id, "fullNameGu", gu), `member-${m.id}:gu`);
                    }}
                  />
                </div>
                <div>
                  <div className="mb-1 text-[10.5px] font-bold text-[var(--faint)]">Relation</div>
                  {relations.length > 0 ? (
                    <AdminSelect
                      value={m.relation}
                      onChange={(v) => setMember(m.id, "relation", v)}
                      className="w-full"
                      options={[
                        { value: "", label: "—" },
                        ...(m.isHead ? [{ value: "Head", label: "Head" }] : []),
                        ...relations
                          .filter((r) => r.nameEn.toLowerCase() !== "head")
                          .map((r) => ({
                            value: r.nameEn,
                            label: `${r.nameEn}${r.nameGu && r.nameGu !== r.nameEn ? ` · ${r.nameGu}` : ""}`,
                          })),
                      ]}
                    />
                  ) : (
                    <AdminCellInput value={m.relation} onChange={(v) => setMember(m.id, "relation", v)} />
                  )}
                </div>
                <div>
                  <div className="mb-1 text-[10.5px] font-bold text-[var(--faint)]">Mobile (login)</div>
                  <AdminCellInput value={m.mobile} onChange={(v) => setMember(m.id, "mobile", v)} />
                </div>
                <div>
                  <div className="mb-1 text-[10.5px] font-bold text-[var(--faint)]">Date of birth</div>
                  <AdminCellInput
                    type="date"
                    value={m.dateOfBirth}
                    onChange={(v) => setMember(m.id, "dateOfBirth", v)}
                  />
                </div>
                <div>
                  <div className="mb-1 text-[10.5px] font-bold text-[var(--faint)]">Blood group</div>
                  <AdminSelect
                    value={m.bloodGroup}
                    onChange={(v) => setMember(m.id, "bloodGroup", v)}
                    className="w-full"
                    options={[
                      { value: "", label: "—" },
                      ...BLOOD_GROUPS.map((b) => ({ value: b.type, label: b.label })),
                    ]}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <CascadingOccupationFields
                    tree={occupationTree}
                    values={m}
                    onChange={(patch) =>
                      setF((prev) => ({
                        ...prev,
                        members: prev.members.map((x) =>
                          x.id === m.id ? { ...x, ...patch } : x,
                        ),
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addMember}
            className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-extrabold text-[var(--brand)]"
          >
            + Add member
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-[13px] font-semibold text-[var(--danger)]">{error}</p>}
      {notice && <p className="mt-4 text-[13px] font-semibold text-[var(--success)]">{notice}</p>}

      <div className="mt-6 flex flex-wrap gap-2.5">
        <AdminBtn onClick={save}>
          {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
        </AdminBtn>
        {f.status === "PENDING" && (
          <>
            <AdminBtn variant="success" onClick={approve}>
              {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : "✓ Approve family"}
            </AdminBtn>
            <AdminBtn
              variant="ghost"
              className="border-[var(--brand-border)]! text-[var(--danger)]!"
              onClick={() => {
                setRejectOpen(true);
                setError(null);
              }}
            >
              ✕ Reject (with reason)
            </AdminBtn>
          </>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-[380px] rounded-2xl sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              Reject registration
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-[var(--faint)]">
              {f.headNameGu || f.headNameEn} — the family will be notified with the reason.
            </DialogDescription>
          </DialogHeader>
          <div>
            <div className="mb-1 text-[11.5px] font-bold text-[var(--muted)]">Reason *</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((reason) => (
                <FilterChip
                  key={reason}
                  label={reason}
                  active={rejectReason === reason}
                  onClick={() => setRejectReason(reason)}
                />
              ))}
            </div>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Add a note…"
              className="mb-2 min-h-[70px] resize-none border-[var(--line-field)] bg-[var(--field)] text-[13px]"
            />
            {error && <p className="mb-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
            <div className="flex gap-2.5">
              <AdminBtn variant="danger" className="flex-1 justify-center" onClick={reject}>
                {busy === "reject" ? <Loader2 className="size-4 animate-spin" /> : "Confirm reject"}
              </AdminBtn>
              <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setRejectOpen(false)}>
                Cancel
              </AdminBtn>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
