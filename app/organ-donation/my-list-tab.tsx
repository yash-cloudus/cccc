"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DateField, todayISO } from "@/components/ui/date-field";
import { api } from "@/lib/http";
import { formatDateDMY, pickText, telLink } from "@/lib/format";
import {
  donationSummary,
  donationSummaryLabel,
  donationTypeLabel,
  isOpenStatus,
  nameInitial,
  organLabel,
  requestStatusMeta,
  type OrganDonationType,
  type OrganDonorRow,
  type OrganPledgeRow,
  type OrganRequestRow,
  type OrganType,
} from "@/lib/organ-donation";
import type { Lang } from "@/lib/i18n/dictionary";
import {
  Empty,
  Label,
  Modal,
  OrganPicker,
  OrganStatusPill,
  OrganTypePicker,
  Pill,
  PrimaryBtn,
} from "./organ-ui";

/**
 * Option 2 — My Uploaded List.
 *
 * This doubles as the family's control centre: incoming requests, marking an
 * organ donated, and reporting a death all live on the record they belong to,
 * rather than in a separate inbox the family would have to remember to check.
 */
export function MyListTab({
  myDonors,
  incoming,
  outgoing,
  lang,
  T,
}: {
  myDonors: OrganDonorRow[];
  incoming: OrganRequestRow[];
  outgoing: OrganRequestRow[];
  lang: Lang;
  T: (gu: string, en: string) => string;
}) {
  const [detail, setDetail] = useState<OrganDonorRow | null>(null);

  const pendingByDonor = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of incoming) {
      if (r.status !== "PENDING") continue;
      map.set(r.donorId, (map.get(r.donorId) ?? 0) + 1);
    }
    return map;
  }, [incoming]);

  return (
    <>
      {myDonors.length === 0 ? (
        <Empty>
          {T(
            "તમે હજુ કોઈ અંગદાન નોંધ ઉમેરી નથી.",
            "You have not added any organ donation records yet.",
          )}
        </Empty>
      ) : (
        myDonors.map((d) => (
          <MyDonorCard
            key={d.id}
            donor={d}
            pending={pendingByDonor.get(d.id) ?? 0}
            lang={lang}
            T={T}
            onOpen={() => setDetail(d)}
          />
        ))
      )}

      {outgoing.length > 0 && (
        <>
          <div className="mt-6 mb-2.5 px-1 text-[13px] font-extrabold tracking-wide text-[var(--muted)]">
            {T("મેં કરેલી વિનંતીઓ", "MY REQUESTS")}
          </div>
          {outgoing.map((r) => (
            <OutgoingCard key={r.id} row={r} lang={lang} T={T} />
          ))}
        </>
      )}

      {detail && (
        <MyDonorDetail
          donor={detail}
          requests={incoming.filter((r) => r.donorId === detail.id)}
          onClose={() => setDetail(null)}
          lang={lang}
          T={T}
        />
      )}
    </>
  );
}

function MyDonorCard({
  donor,
  pending,
  lang,
  T,
  onOpen,
}: {
  donor: OrganDonorRow;
  pending: number;
  lang: Lang;
  T: (gu: string, en: string) => string;
  onOpen: () => void;
}) {
  const name = pickText(donor.fullNameGu, donor.fullNameEn, lang);
  const summary = donationSummary(donor.pledges);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="samaj-card mb-2.5 flex w-full cursor-pointer flex-col p-[13px] text-left"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[var(--brand-tint)] text-[15px] font-extrabold text-[var(--brand)]">
          {nameInitial(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-[var(--ink)]">{name}</div>
          <div className="truncate text-xs font-medium text-[var(--faint)]">
            {[donor.relation, summary ? donationSummaryLabel(summary, lang) : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        {pending > 0 && (
          <span className="flex-none rounded-full bg-[var(--brand)] px-2.5 py-1 text-[11px] font-extrabold text-white">
            {pending} {T("વિનંતી", pending === 1 ? "request" : "requests")}
          </span>
        )}
        {donor.isDeceased && (
          <Pill text={T("સ્વર્ગવાસ", "Deceased")} bg="#F1EBDE" fg="#8B8375" />
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {donor.pledges.map((p) => (
          <OrganStatusPill key={p.id} organ={p.organ} status={p.status} lang={lang} />
        ))}
      </div>
    </button>
  );
}

function OutgoingCard({
  row,
  lang,
  T,
}: {
  row: OrganRequestRow;
  lang: Lang;
  T: (gu: string, en: string) => string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const meta = requestStatusMeta(row.status, lang);

  async function cancel() {
    setBusy(true);
    const res = await api.patch("/api/organ-donation/requests", { id: row.id, action: "cancel" });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(T("વિનંતી રદ થઈ", "Request cancelled"));
    router.refresh();
  }

  return (
    <div className="samaj-card mb-2.5 flex items-center gap-3 p-[13px]">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-[var(--ink)]">
          {organLabel(row.organ, lang)} · {pickText(row.donorNameGu, row.donorName, lang)}
        </div>
        <div className="text-xs font-medium text-[var(--faint)]">
          {formatDateDMY(row.createdAt)}
        </div>
      </div>
      <Pill text={meta.label} bg={meta.bg} fg={meta.fg} />
      {row.status === "PENDING" && (
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="cursor-pointer text-[12px] font-bold text-[var(--danger)] disabled:opacity-50"
        >
          {T("રદ", "Cancel")}
        </button>
      )}
    </div>
  );
}

function MyDonorDetail({
  donor,
  requests,
  onClose,
  lang,
  T,
}: {
  donor: OrganDonorRow;
  requests: OrganRequestRow[];
  onClose: () => void;
  lang: Lang;
  T: (gu: string, en: string) => string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [markingDonated, setMarkingDonated] = useState<OrganPledgeRow | null>(null);
  const [reportingDeath, setReportingDeath] = useState(false);
  const [editingOrgans, setEditingOrgans] = useState(false);

  const name = pickText(donor.fullNameGu, donor.fullNameEn, lang);
  const pending = requests.filter((r) => r.status === "PENDING");
  const answered = requests.filter((r) => r.status !== "PENDING");

  async function respond(id: string, action: "approve" | "reject") {
    setBusy(true);
    const res = await api.patch("/api/organ-donation/requests", { id, action });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(
      action === "approve"
        ? T("વિનંતી મંજૂર થઈ — બાકીની આપોઆપ બંધ થઈ", "Approved — the other requests were closed")
        : T("વિનંતી નામંજૂર થઈ", "Request rejected"),
    );
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!confirm(T(`${name}ની નોંધ કાઢી નાખવી છે?`, `Delete the record for ${name}?`))) return;
    setBusy(true);
    const res = await api.del("/api/organ-donation", { id: donor.id });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(T("નોંધ કાઢી નાખી", "Record deleted"));
    onClose();
    router.refresh();
  }

  return (
    <Modal title={name} onClose={onClose}>
      {pending.length > 0 && (
        <>
          <div className="mb-2 text-[12px] font-bold text-[#8B8375]">
            {T("આવેલી વિનંતીઓ", "Incoming requests")}
          </div>
          {pending.map((r) => (
            <div key={r.id} className="mb-2.5 rounded-[13px] border border-[#F0E9DB] p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold text-[var(--ink)]">
                    {r.requesterName}
                  </div>
                  <div className="truncate text-[11.5px] font-medium text-[var(--faint)]">
                    {[organLabel(r.organ, lang), r.patientName, r.hospital]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                {r.requesterMobile && (
                  <a
                    href={telLink(r.requesterMobile, r.requesterMobileIso)}
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[var(--success-tint)] text-[var(--success)]"
                    aria-label={T("કૉલ", "Call")}
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>
              {r.message && (
                <p className="mt-2 text-[12.5px] leading-relaxed text-[#8B7A55]">{r.message}</p>
              )}
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => respond(r.id, "approve")}
                  className="h-9 flex-1 cursor-pointer rounded-[11px] bg-[var(--brand)] text-[12.5px] font-extrabold text-white disabled:opacity-50"
                >
                  {T("મંજૂર કરો", "Approve")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => respond(r.id, "reject")}
                  className="h-9 flex-1 cursor-pointer rounded-[11px] border-[1.5px] border-[#EDE4D4] bg-white text-[12.5px] font-extrabold text-[var(--ink-dim)] disabled:opacity-50"
                >
                  {T("નામંજૂર", "Reject")}
                </button>
              </div>
            </div>
          ))}
          <p className="mb-4 text-[11.5px] leading-relaxed text-[#A79C88]">
            {T(
              "એક વિનંતી મંજૂર કરશો એટલે એ જ અંગની બાકીની વિનંતીઓ આપોઆપ બંધ થઈ જશે.",
              "Approving one request automatically closes the others for that same organ.",
            )}
          </p>
        </>
      )}

      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12px] font-bold text-[#8B8375]">
          {T("દાન કરેલ અંગ", "Pledged organs")}
        </div>
        {!donor.isDeceased && (
          <button
            type="button"
            onClick={() => setEditingOrgans(true)}
            className="cursor-pointer text-[12px] font-bold text-[var(--brand)]"
          >
            {T("ફેરફાર", "Edit")}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {donor.pledges.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 rounded-[13px] border border-[#F0E9DB] px-3 py-2.5"
          >
            <OrganStatusPill organ={p.organ} status={p.status} lang={lang} />
            <span className="rounded-full bg-[#F6F1E8] px-2.5 py-1 text-[10.5px] font-extrabold whitespace-nowrap text-[#8B8375]">
              {donationTypeLabel(p.donationType, lang)}
            </span>
            {p.donatedAt && (
              <span className="text-[11.5px] font-semibold text-[var(--faint)]">
                {formatDateDMY(p.donatedAt)}
              </span>
            )}
            <div className="flex-1" />
            {isOpenStatus(p.status) && !donor.isDeceased && (
              <button
                type="button"
                onClick={() => setMarkingDonated(p)}
                className="cursor-pointer rounded-full bg-[#EDE4F7] px-3 py-1.5 text-[11.5px] font-extrabold text-[#6B3FA0]"
              >
                {T("દાન થયું", "Mark donated")}
              </button>
            )}
          </div>
        ))}
      </div>

      {answered.length > 0 && (
        <>
          <div className="mt-4 mb-2 text-[12px] font-bold text-[#8B8375]">
            {T("જૂની વિનંતીઓ", "Past requests")}
          </div>
          {answered.map((r) => {
            const meta = requestStatusMeta(r.status, lang);
            return (
              <div key={r.id} className="mb-1.5 flex items-center gap-2 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate font-semibold text-[var(--ink-dim)]">
                  {r.requesterName} · {organLabel(r.organ, lang)}
                </span>
                <Pill text={meta.label} bg={meta.bg} fg={meta.fg} />
              </div>
            );
          })}
        </>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {!donor.isDeceased && (
          <PrimaryBtn tone="ghost" onClick={() => setReportingDeath(true)}>
            {T("સ્વર્ગવાસની જાણ કરો", "Report death")}
          </PrimaryBtn>
        )}
        {donor.isDeceased && donor.deceasedAt && (
          <p className="rounded-[13px] bg-[#F6F1E8] p-3 text-center text-[12.5px] font-semibold text-[#8B8375]">
            {T("સ્વર્ગવાસ", "Deceased")} · {formatDateDMY(donor.deceasedAt)}
          </p>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[13px] text-[13px] font-extrabold text-[var(--danger)] disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> {T("નોંધ કાઢી નાખો", "Delete record")}
        </button>
      </div>

      {markingDonated && (
        <MarkDonatedModal
          pledge={markingDonated}
          onClose={() => setMarkingDonated(null)}
          onDone={onClose}
          lang={lang}
          T={T}
        />
      )}
      {reportingDeath && (
        <DeathReportModal
          donor={donor}
          onClose={() => setReportingDeath(false)}
          onDone={onClose}
          lang={lang}
          T={T}
        />
      )}
      {editingOrgans && (
        <EditOrgansModal
          donor={donor}
          onClose={() => setEditingOrgans(false)}
          onDone={onClose}
          lang={lang}
          T={T}
        />
      )}
    </Modal>
  );
}

/** Date of donation is the only extra field the family is asked for. */
function MarkDonatedModal({
  pledge,
  onClose,
  onDone,
  lang,
  T,
}: {
  pledge: OrganPledgeRow;
  onClose: () => void;
  onDone: () => void;
  lang: Lang;
  T: (gu: string, en: string) => string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await api.patch("/api/organ-donation/pledges", {
      pledgeId: pledge.id,
      action: "donated",
      donatedAt: date,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(T("દાન નોંધાયું — આભાર 🙏", "Donation recorded — thank you 🙏"));
    onClose();
    onDone();
    router.refresh();
  }

  return (
    <Modal
      title={`${organLabel(pledge.organ, lang)} · ${T("દાન થયું", "Mark donated")}`}
      onClose={onClose}
      footer={
        <PrimaryBtn onClick={submit} disabled={busy}>
          {busy ? T("સાચવાય છે…", "Saving…") : T("દાન નોંધો", "Record donation")}
        </PrimaryBtn>
      }
    >
      <p className="rounded-[13px] bg-[#FDF9F0] p-3 text-[12.5px] leading-relaxed text-[#8B7A55]">
        {T(
          "નોંધ્યા પછી આ અંગ યાદીમાંથી હટી જશે અને સમાજના આંકડામાં ઉમેરાશે. આ પાછું ફેરવી શકાતું નથી.",
          "Once recorded, this organ leaves the list and is counted in the community statistics. This cannot be undone.",
        )}
      </p>
      <Label>{T("દાનની તારીખ", "Date of donation")}</Label>
      <DateField value={date} onChange={setDate} max={todayISO()} />
    </Modal>
  );
}

/**
 * Report death — the per-organ checklist.
 *
 * Whatever is left unticked closes as "Not donated": the donor has died, so an
 * organ that was not retrieved then can never be donated later.
 */
function DeathReportModal({
  donor,
  onClose,
  onDone,
  lang,
  T,
}: {
  donor: OrganDonorRow;
  onClose: () => void;
  onDone: () => void;
  lang: Lang;
  T: (gu: string, en: string) => string;
}) {
  const router = useRouter();
  const open = useMemo(() => donor.pledges.filter((p) => isOpenStatus(p.status)), [donor.pledges]);
  const [died, setDied] = useState(todayISO());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const byOrgan = useMemo(
    () => new Map(open.map((p) => [p.organ as string, p.id])),
    [open],
  );

  function toggle(organ: OrganType) {
    const id = byOrgan.get(organ);
    if (!id) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    const res = await api.post("/api/organ-donation/death-report", {
      donorId: donor.id,
      deceasedAt: died,
      donatedPledgeIds: Array.from(picked),
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(T("નોંધ થઈ ગઈ 🙏", "Recorded 🙏"));
    onClose();
    onDone();
    router.refresh();
  }

  const selectedOrgans = new Set(
    open.filter((p) => picked.has(p.id)).map((p) => p.organ as string),
  );

  return (
    <Modal
      title={T("સ્વર્ગવાસની જાણ", "Report death")}
      onClose={onClose}
      footer={
        <PrimaryBtn onClick={submit} disabled={busy}>
          {busy ? T("સાચવાય છે…", "Saving…") : T("નોંધ કરો", "Submit report")}
        </PrimaryBtn>
      }
    >
      <p className="rounded-[13px] bg-[#FDF9F0] p-3 text-[12.5px] leading-relaxed text-[#8B7A55]">
        {T(
          "જે અંગ ખરેખર દાનમાં લેવાયા હોય તે જ પસંદ કરો. બાકીના 'દાન ન થયું' તરીકે બંધ થશે — આ પાછું ફેરવી શકાતું નથી.",
          "Tick only the organs that were actually retrieved. The rest close as “Not donated” — this cannot be undone.",
        )}
      </p>

      <Label>{T("સ્વર્ગવાસ તારીખ", "Date of death")}</Label>
      <DateField value={died} onChange={setDied} max={todayISO()} />

      <Label>{T("કયા અંગ દાનમાં લેવાયા?", "Which organs were donated?")}</Label>
      {open.length === 0 ? (
        <p className="text-[12.5px] text-[var(--faint)]">
          {T("કોઈ ખુલ્લું અંગ બાકી નથી.", "No open organs remain.")}
        </p>
      ) : (
        <OrganPicker
          selected={selectedOrgans}
          onToggle={toggle}
          lang={lang}
          organs={open.map((p) => p.organ)}
        />
      )}
    </Modal>
  );
}

function EditOrgansModal({
  donor,
  onClose,
  onDone,
  lang,
  T,
}: {
  donor: OrganDonorRow;
  onClose: () => void;
  onDone: () => void;
  lang: Lang;
  T: (gu: string, en: string) => string;
}) {
  const router = useRouter();
  // Seeded from the record's own per-organ answers, closed organs included, so
  // the family sees the full picture and only the open rows accept edits.
  const [picked, setPicked] = useState<Map<OrganType, OrganDonationType>>(
    () => new Map(donor.pledges.map((p) => [p.organ, p.donationType])),
  );
  const [note, setNote] = useState(donor.note ?? "");
  const [busy, setBusy] = useState(false);

  // A closed organ is a fact on the record, not a choice — it stays ticked and
  // untouchable so the family cannot silently rewrite a completed donation.
  const locked = useMemo(
    () => new Set(donor.pledges.filter((p) => !isOpenStatus(p.status)).map((p) => p.organ)),
    [donor.pledges],
  );

  function toggle(organ: OrganType) {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(organ)) next.delete(organ);
      else next.set(organ, "BOTH");
      return next;
    });
  }

  function setType(organ: OrganType, type: OrganDonationType) {
    setPicked((prev) => new Map(prev).set(organ, type));
  }

  async function submit() {
    if (picked.size === 0) {
      return toast.error(T("ઓછામાં ઓછું એક અંગ પસંદ કરો", "Select at least one organ"));
    }
    setBusy(true);
    const res = await api.patch("/api/organ-donation", {
      id: donor.id,
      organs: Array.from(picked, ([organ, donationType]) => ({ organ, donationType })),
      note: note.trim() || null,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(T("સાચવાયું", "Saved"));
    onClose();
    onDone();
    router.refresh();
  }

  return (
    <Modal
      title={T("અંગમાં ફેરફાર", "Edit organs")}
      onClose={onClose}
      footer={
        <PrimaryBtn onClick={submit} disabled={busy}>
          {busy ? T("સાચવાય છે…", "Saving…") : T("સાચવો", "Save")}
        </PrimaryBtn>
      }
    >
      <OrganTypePicker
        selected={picked}
        onToggle={toggle}
        onSetType={setType}
        lang={lang}
        T={T}
        locked={locked}
      />
      {locked.size > 0 && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-[#A79C88]">
          {T(
            "પૂર્ણ થયેલા અંગમાં ફેરફાર થઈ શકતો નથી.",
            "Organs that are already closed cannot be changed.",
          )}
        </p>
      )}
      <Label>{T("નોંધ (વૈકલ્પિક)", "Note (optional)")}</Label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        className="w-full rounded-[13px] border-[1.5px] border-[#EDE4D4] bg-[#FCFAF6] px-3.5 py-3 text-[14px] font-semibold text-[var(--ink)] outline-none"
      />
    </Modal>
  );
}
