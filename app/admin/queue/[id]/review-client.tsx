"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { isValidNumber } from "@/lib/phone";
import {
  AdminBtn,
  AdminH2,
  AdminH3,
  AdminInput,
  FilterChip,
} from "@/components/admin/admin-ui";
import { AdminField } from "@/components/admin/admin-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  FamilyDetailsFields,
  type NamedOption,
} from "@/components/forms/family-details-fields";
import {
  MemberFields,
  type MemberFormValues,
  blankMemberForm,
} from "@/components/forms/member-fields";
import { REJECT_REASONS } from "@/lib/constants";
import { api } from "@/lib/http";
import { useAdminT, type AdminKey } from "@/lib/i18n/admin-dictionary";
import { useAdminPlaces } from "@/hooks/use-admin-places";
import {
  familyPlaceFromHead,
  type FamilyDetailsValues,
} from "@/lib/family-form";
import { resolveCascadingOccupationForSave } from "@/lib/cascading-occupation";
import type { NriCityOption } from "@/components/forms/nri-fields";
import type { OccupationTreeNode } from "@/lib/occupation-defaults";

/**
 * Review & edit — the admin's copy of "પરિવાર નોંધણી".
 *
 * Everything a family filled in is on one page: family details on the left,
 * every member on the right, in the same fields and the same order as the
 * member wizard, through the same components — so the Gujarati keyboard,
 * dictation, transliteration, the date picker and the occupation cascade all
 * behave identically on both sides.
 *
 * Two things are derived rather than asked twice, exactly as registration does
 * them: the family's head name comes from the head member, and the family's
 * place comes from where the head lives.
 */

/** Chip labels for the stored (English) reject reasons — the value sent to the
 *  API stays the English constant, only the label is translated. */
const REJECT_REASON_KEY: Record<string, AdminKey> = {
  "Incomplete form": "queue.reasonIncomplete",
  "Duplicate family": "queue.reasonDuplicate",
  "Invalid phone": "queue.reasonInvalidPhone",
  "Needs verification": "queue.reasonNeedsVerification",
};

export type EditMember = {
  id: string;
  isNew: boolean;
  isHead: boolean;
} & MemberFormValues;

export type EditFamily = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  headNameEn: string;
  headNameGu: string;
  nativePlace: string;
  email: string;
  /** Legacy family-level note; registration never sets it, admins still can. */
  businessGu: string;
  members: EditMember[];
} & FamilyDetailsValues;

export function ReviewClient({
  communityType = "PARIVAR",
  lockedSurname = null,
  family: initial,
  surnameGroups,
  cities = [],
  villages = [],
  relations = [],
  occupationTree,
  nriCities = [],
  backHref = "/admin/queue",
  fromFamilies = false,
  autoAddMember = false,
}: {
  communityType?: "PARIVAR" | "GAM";
  lockedSurname?: NamedOption | null;
  family: EditFamily;
  surnameGroups: NamedOption[];
  cities?: { id: string; nameEn: string; nameGu: string }[];
  villages?: { id: string; nameEn: string; nameGu: string }[];
  relations?: { nameEn: string; nameGu: string }[];
  occupationTree: OccupationTreeNode[];
  /** Admin-managed NRI cities, grouped by country name. */
  nriCities?: NriCityOption[];
  backHref?: string;
  /** Opened from Families & Members, not the registration queue — this is
   * routine record-keeping, not an admission decision, so Approve/Reject stay
   * off even when the family happens to still be PENDING. Families & Members
   * already has its own Activate/Deactivate for status. */
  fromFamilies?: boolean;
  /** Arrived via "Add member" from Families & Members — land straight on a
   * blank member card instead of making the admin find "+ Add member" first. */
  autoAddMember?: boolean;
}) {
  const { t, tf, lang } = useAdminT();
  /** Pick the reader's language out of a bilingual DB value. */
  const bi = (gu: string | null | undefined, en: string | null | undefined) =>
    (lang === "en" ? en || gu : gu || en) || "";
  const backLabel = t(fromFamilies ? "queue.backToFamilies" : "queue.backToQueue");
  const router = useRouter();
  const nextId = useRef(0);
  const newMemberRef = useRef<HTMLDivElement | null>(null);
  const [f, setF] = useState<EditFamily>(structuredClone(initial));
  // Queue's own approval workflow — hidden once opened from Families & Members.
  const isQueueReview = !fromFamilies && f.status === "PENDING";
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** `memberId.field -> message`, filled on a failed save so the message can
   *  sit under the field rather than in a toast. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);

  /** True if the form has been changed since the page loaded. */
  const isDirty = useMemo(
    () => JSON.stringify(f) !== JSON.stringify(initial),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f],
  );

  function handleBack() {
    if (isDirty) {
      setBackConfirmOpen(true);
    } else {
      router.push(backHref);
    }
  }

  async function saveAndLeave() {
    setBusy("save");
    setError(null);
    const ok = await persist(false);
    setBusy(null);
    if (ok) {
      router.push(backHref);
      router.refresh();
    }
  }

  function discardAndLeave() {
    setBackConfirmOpen(false);
    router.push(backHref);
  }

  const { places, addPlace } = useAdminPlaces(
    communityType,
    villages,
    cities,
    setError,
  );

  const patchFamily = (patch: Partial<EditFamily>) =>
    setF((prev) => ({ ...prev, ...patch }));

  const patchMember = (id: string, patch: Partial<EditMember>) =>
    setF((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));

  const removeMember = (id: string) =>
    setF((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== id),
    }));

  const addMember = () => {
    // Monotonic, so a removed row's key can never be handed to a later one.
    const id = `new_${nextId.current++}`;
    setF((prev) => ({
      ...prev,
      members: [
        ...prev.members,
        {
          id,
          isNew: true,
          isHead: false,
          ...blankMemberForm(),
          // A new member usually lives where the household does.
          currentlyAt: prev.city,
        },
      ],
    }));
    // Scroll to the new card after React flushes the state update.
    setTimeout(() => {
      newMemberRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  const autoAdded = useRef(false);
  useEffect(() => {
    if (autoAddMember && !autoAdded.current) {
      autoAdded.current = true;
      addMember();
    }
  }, [autoAddMember]);

  const head = f.members.find((m) => m.isHead) ?? f.members[0];

  async function buildPayload() {
    const resolved = await Promise.all(
      f.members.map((m) =>
        resolveCascadingOccupationForSave(occupationTree, m),
      ),
    );
    // The head answers the family's questions: their name is the family's name,
    // their place is the family's place. Same rule as the member wizard.
    const place = familyPlaceFromHead(head?.currentlyAt ?? "", villages);

    return {
      headNameEn: head?.fullNameEn.trim() || f.headNameEn,
      headNameGu: head?.fullNameGu.trim() || null,
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
      city: place.city || null,
      villageAreaId: place.villageAreaId,
      nativePlace: f.nativePlace || null,
      email: f.email || null,
      businessGu: f.businessGu || null,
      nativeElderNameEn: f.nativeElderNameEn || null,
      nativeElderNameGu: f.nativeElderNameGu || null,
      nativeElderPhone: f.nativeElderPhone || null,
      nativeElderIso: f.nativeElderIso || "in",
      latitude: f.latitude,
      longitude: f.longitude,
      members: f.members.map((m, i) => {
        // Always mark exactly one head. Sending `m.isHead` straight through
        // left families where no row had the flag headless forever — and the
        // families list reads the head's mobile, so it showed "—" even though
        // the member had one.
        const isHeadRow = head ? m.id === head.id : i === 0;
        return {
          ...(m.isNew ? {} : { id: m.id }),
          fullNameEn: m.fullNameEn,
          fullNameGu: m.fullNameGu || null,
          relation: isHeadRow ? "Head" : m.relation || null,
          gender: m.gender || null,
          mobile: m.mobile || null,
          mobileIso: m.mobileIso || "in",
          whatsappIso: m.hasWhatsApp ? m.mobileIso || "in" : m.whatsappIso || "in",
          // Head only, but sent for every row so the API never has to guess
          // which one it may clear.
          photoUrl: m.photoUrl || null,
          // Cleared with the flag, so a member who moved home does not keep a
          // country nobody can see any more.
          isNri: m.isNri,
          nriCountry: m.isNri ? m.nriCountry || null : null,
          nriCity: m.isNri ? m.nriCity || null : null,
          dateOfBirth: m.dateOfBirth || null,
          bloodGroup: m.bloodGroup || null,
          currentlyAt: m.currentlyAt || null,
          hasWhatsApp: m.hasWhatsApp,
          whatsapp: m.hasWhatsApp ? null : m.whatsapp.trim() || null,
          occupation: resolved[i].occupation || null,
          occupationOther: resolved[i].occupationOther || null,
          education: resolved[i].education || null,
          course: resolved[i].course || null,
          specialization: resolved[i].specialization || null,
          isHead: isHeadRow,
        };
      }),
    };
  }

  /**
   * The head's mobile is only demanded when approving — that is when it becomes
   * a login. Saving a half-corrected legacy family must stay possible.
   */
  /**
   * Returns `memberId.field -> message` (plus bare keys for family-level
   * fields) so each message can sit under the box it belongs to instead of a
   * single line at the top of a form that can be a dozen members long.
   */
  function validate(forApproval: boolean): Record<string, string> {
    const e: Record<string, string> = {};
    if (!head) {
      e.form = t("queue.valNoMembers");
      return e;
    }
    if (!f.addressEn.trim()) e.addressEn = t("queue.valAddress");
    f.members.forEach((m, i) => {
      if (!m.fullNameEn.trim()) {
        e[`${m.id}.fullNameEn`] = m.isHead
          ? t("queue.valHeadName")
          : tf("queue.valMemberName", { n: i + 1 });
      }
      // Same rule as the member wizard: every non-head member needs a relation.
      if (!m.isHead && !m.relation.trim()) {
        e[`${m.id}.relation`] = tf("queue.valMemberRelation", { n: i + 1 });
      }
      // Families registered before gender existed are backfilled from relation
      // where it was implied, so this normally only catches the head.
      if (!m.gender.trim()) e[`${m.id}.gender`] = tf("queue.valMemberGender", { n: i + 1 });
    });
    if (forApproval && !isValidNumber(head.mobile, head.mobileIso)) {
      e[`${head.id}.mobile`] = t("queue.valHeadMobile");
    }
    return e;
  }

  async function persist(forApproval: boolean): Promise<boolean> {
    const problems = validate(forApproval);
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) {
      setNotice(null);
      // No toast: the message now sits on the field, and the form scrolls to it.
      setError(problems.form ?? null);
      return false;
    }
    const res = await api.put(`/api/families/${f.id}`, await buildPayload());
    if (!res.ok) {
      // A server error is not about one field, so it stays in the banner.
      setError(res.error);
      return false;
    }
    return true;
  }

  async function save() {
    setBusy("save");
    setError(null);
    setNotice(null);
    const okSave = await persist(false);
    setBusy(null);
    if (!okSave) return;
    // Back to the list the edit was opened from — staying on the form left the
    // admin unsure whether it had saved, and the list still showing the old row.
    toast.success(t("queue.savedToast"));
    router.push(backHref);
    router.refresh();
  }

  async function approve() {
    setBusy("approve");
    setError(null);
    setNotice(null);
    if (!(await persist(true))) {
      setBusy(null);
      return;
    }
    const res = await api.patch(`/api/families`, {
      id: f.id,
      status: "APPROVED",
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    router.push(backHref);
    router.refresh();
  }

  async function reject() {
    if (!rejectReason.trim()) {
      // Inline, next to the box it is about — the reject dialog is on screen.
      setRejectError(t("queue.errReasonRequired"));
      return;
    }
    setRejectError(null);
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
      toast.error(res.error);
      return;
    }
    setRejectOpen(false);
    router.push(backHref);
    router.refresh();
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            aria-label={backLabel}
            title={backLabel}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--line-admin)] bg-white text-[var(--ink)] shadow-sm transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]"
          >
            <ChevronLeft className="size-5" strokeWidth={2.4} />
          </button>

          <AdminH2
            className="mb-0 min-w-0"
            info={t(isQueueReview ? "queue.reviewInfo" : "queue.editInfo")}
          >
            {isQueueReview ? t("queue.reviewTitle") : t("common.edit")}:{" "}
            {bi(head?.fullNameGu, head?.fullNameEn) || f.headNameEn} (
            {bi(f.surnameGu, f.surnameEn)})
          </AdminH2>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <AdminBtn onClick={save}>
            {busy === "save" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("queue.saveChanges")
            )}
          </AdminBtn>
          {isQueueReview && (
            <>
              <AdminBtn variant="success" onClick={approve}>
                {busy === "approve" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  `✓ ${t("queue.approveFamily")}`
                )}
              </AdminBtn>
              <AdminBtn
                variant="ghost"
                className="border-[var(--brand-border)]! text-[var(--danger)]!"
                onClick={() => {
                  setRejectOpen(true);
                  setError(null);
                }}
              >
                ✕ {t("queue.rejectWithReason")}
              </AdminBtn>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Family details is always shorter than the member list. Once its own
            height has scrolled by, pin it instead of leaving blank space where
            it used to be — the longer Members column keeps scrolling past it.
            No overflow/max-height here: the on-screen Gujarati keyboard opens
            as an absolutely-positioned panel under its field, and clipping this
            box would cut that panel off when it opens near the bottom. */}
        <section className="rounded-2xl border border-[var(--line-admin)] bg-white p-4 sm:p-5 lg:sticky lg:top-4">
          <AdminH3>{t("queue.familyDetails")}</AdminH3>
          <FamilyDetailsFields
            variant="admin"
            values={f}
            onChange={patchFamily}
            communityType={communityType}
            lockedSurname={lockedSurname}
            surnameGroups={surnameGroups}
            errors={fieldErrors}
            t={(gu, en) => (lang === "en" ? en : gu)}
          />
          <AdminField
            label={t("queue.businessNote")}
            hint={t("queue.businessNoteHint")}
          >
            <AdminInput
              gujarati
              value={f.businessGu}
              onChange={(v) => patchFamily({ businessGu: v })}
            />
          </AdminField>

          {/* Lives in the sticky family-details card, not atop the (often much
              taller) member list, so it stays reachable while scrolling past
              member 5, 6, 7… instead of scrolling out of view with member 1. */}
          <button
            type="button"
            onClick={addMember}
            className="mt-4 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--line-admin)] py-2.5 text-[12.5px] font-extrabold text-[var(--brand)]"
          >
            <Plus className="size-3.5" strokeWidth={2.6} /> {t("queue.addMember")}
          </button>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <AdminH3 className="mb-0">{tf("queue.membersCount", { n: f.members.length })}</AdminH3>
          </div>

          {f.members.map((m, idx) => {
            const isLast = idx === f.members.length - 1;
            return (
              <div
                key={m.id}
                ref={
                  isLast
                    ? (el) => {
                        newMemberRef.current = el;
                      }
                    : undefined
                }
                className="rounded-2xl border border-[var(--line-admin)] bg-white p-4 sm:p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <b className="text-[13px] text-[var(--ink)]">
                    {tf("queue.memberN", { n: idx + 1 })}
                    {m.isHead ? ` · ${t("queue.head")}` : ""}
                  </b>
                  {!m.isHead && (
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-bold text-[var(--danger)]"
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </button>
                  )}
                </div>
                <MemberFields
                  values={m}
                  errors={Object.fromEntries(
                    Object.entries(fieldErrors)
                      .filter(([k]) => k.startsWith(`${m.id}.`))
                      .map(([k, v]) => [k.slice(m.id.length + 1), v]),
                  )}
                  onChange={(patch) => patchMember(m.id, patch)}
                  relations={relations}
                  occupationTree={occupationTree}
                  places={places}
                  nriCities={nriCities}
                  onAddPlace={addPlace}
                  communityType={communityType}
                  isHead={m.isHead}
                  syncKey={`member:${m.id}`}
                />
              </div>
            );
          })}
        </section>
      </div>

      {error && (
        <p className="mt-4 text-[13px] font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}
      {/* The individual messages are on their fields; this only says how many,
          so a problem further up the page is not silent after pressing Save. */}
      {!error && Object.keys(fieldErrors).length > 0 && (
        <p className="mt-4 text-[13px] font-semibold text-[var(--danger)]">
          {tf("queue.valFieldCount", { n: Object.keys(fieldErrors).length })}
        </p>
      )}
      {notice && (
        <p className="mt-4 text-[13px] font-semibold text-[var(--success)]">
          {notice}
        </p>
      )}

      {/* Back / unsaved-changes confirmation */}
      <Dialog open={backConfirmOpen} onOpenChange={setBackConfirmOpen}>
        <DialogContent className="max-w-[360px] rounded-2xl sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-[var(--ink)]">
              <AlertTriangle className="size-[18px] text-[var(--warn)]" />
              Unsaved changes
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-[var(--faint)]">
              You have unsaved changes. What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2.5 pt-1">
            <AdminBtn className="w-full justify-center" onClick={saveAndLeave}>
              {busy === "save" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "✓ Save & leave"
              )}
            </AdminBtn>
            <AdminBtn
              variant="ghost"
              className="w-full justify-center border-[var(--danger)]! text-[var(--danger)]!"
              onClick={discardAndLeave}
            >
              Discard changes & leave
            </AdminBtn>
            <AdminBtn
              variant="ghost"
              className="w-full justify-center"
              onClick={() => setBackConfirmOpen(false)}
            >
              Cancel — keep editing
            </AdminBtn>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-[380px] rounded-2xl sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              Reject registration
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-[var(--faint)]">
              {head?.fullNameGu || head?.fullNameEn || f.headNameEn} — the
              family will be notified with the reason.
            </DialogDescription>
          </DialogHeader>
          <div>
            <div className="mb-1 text-[11.5px] font-bold text-[var(--muted)]">
              Reason *
            </div>
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
              onChange={(e) => {
                setRejectReason(e.target.value);
                setRejectError(null);
              }}
              placeholder="Add a note…"
              className="mb-2 min-h-[70px] resize-none border-[var(--line-field)] bg-[var(--field)] text-[13px]"
            />
            {(rejectError || error) && (
              <p className="mb-2 text-[12.5px] font-semibold text-[var(--danger)]">
                {rejectError || error}
              </p>
            )}
            <div className="flex gap-2.5">
              <AdminBtn
                variant="danger"
                className="flex-1 justify-center"
                onClick={reject}
              >
                {busy === "reject" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Confirm reject"
                )}
              </AdminBtn>
              <AdminBtn
                variant="ghost"
                className="flex-1 justify-center"
                onClick={() => setRejectOpen(false)}
              >
                Cancel
              </AdminBtn>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
