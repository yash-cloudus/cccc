"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import {
  AdminBtn,
  AdminH2,
  AdminH3,
  AdminHint,
  AdminInput,
  AdminLabel,
  AdminTable,
  AdminTd,
  AdminTh,
  PillActive,
  PillExpired,
  StatusPill,
} from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/http";
import { useTranslitSync } from "@/hooks/use-translit-sync";

export type DriveInfo = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  year: number;
  isOpen: boolean;
  isPublished: boolean;
  entries: number;
};

export type EntryRow = {
  id: string;
  studentName: string;
  standard: string;
  schoolName: string | null;
  totalMarks: number | null;
  obtainedMarks: number | null;
  percentage: number | null;
  isEligible: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RESUBMIT";
  marksheetUrl: string | null;
};

const lower = (s: EntryRow["status"]) =>
  (s === "APPROVED" ? "approved" : s === "REJECTED" ? "rejected" : "pending") as
    | "approved"
    | "rejected"
    | "pending";

export function ResultsClient({
  drives,
  currentDrive,
  entries: initialEntries,
}: {
  drives: DriveInfo[];
  currentDrive: DriveInfo | null;
  entries: EntryRow[];
}) {
  const router = useRouter();
  const { fromEn, fromGu } = useTranslitSync();
  const [entries, setEntries] = useState<EntryRow[]>(initialEntries);
  const [marks, setMarks] = useState<Record<string, { total: string; obtained: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({ titleEn: "", titleGu: "", year: String(new Date().getFullYear()) });
  const [busy, setBusy] = useState(false);

  function setMark(id: string, field: "total" | "obtained", value: string) {
    setMarks((prev) => ({ ...prev, [id]: { ...(prev[id] || { total: "", obtained: "" }), [field]: value } }));
  }

  async function review(entry: EntryRow, status: EntryRow["status"]) {
    setBusyId(entry.id);
    setError(null);
    const m = marks[entry.id];
    const payload: Record<string, unknown> = { id: entry.id, status };
    if (m?.total) payload.totalMarks = Number(m.total);
    if (m?.obtained) payload.obtainedMarks = Number(m.obtained);
    if (status === "REJECTED") payload.rejectReason = "Not eligible";
    const res = await api.patch<{ percentage: number | null; isEligible: boolean }>(`/api/results`, payload);
    setBusyId(null);
    if (!res.ok) return setError(res.error);
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id
          ? {
              ...e,
              status,
              totalMarks: m?.total ? Number(m.total) : e.totalMarks,
              obtainedMarks: m?.obtained ? Number(m.obtained) : e.obtainedMarks,
              percentage: res.data.percentage ?? e.percentage,
              isEligible: res.data.isEligible ?? e.isEligible,
            }
          : e,
      ),
    );
  }

  async function toggleDrive(field: "isOpen" | "isPublished") {
    if (!currentDrive) return;
    const res = await api.patch(`/api/admin/result-drives`, {
      id: currentDrive.id,
      [field]: !currentDrive[field],
    });
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  async function createDrive() {
    if (!draft.titleEn.trim()) return setError("Title is required");
    setBusy(true);
    setError(null);
    const res = await api.post<{ id: string }>(`/api/admin/result-drives`, {
      titleEn: draft.titleEn.trim(),
      titleGu: draft.titleGu.trim() || undefined,
      year: Number(draft.year),
      isOpen: true,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setNewOpen(false);
    router.push(`/admin/results?drive=${res.data.id}`);
    router.refresh();
  }

  const pending = entries.filter((e) => e.status === "PENDING").length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminH2 className="mb-0">
          Result drive{" "}
          {currentDrive ? (
            <>
              — {currentDrive.titleGu || currentDrive.titleEn}{" "}
              {currentDrive.isOpen ? <PillActive>Open</PillActive> : <PillExpired>Closed</PillExpired>}
            </>
          ) : null}
        </AdminH2>
        <AdminBtn onClick={() => { setNewOpen(true); setError(null); }}>
          <Plus className="size-4" />
          New drive
        </AdminBtn>
      </div>

      {drives.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] font-bold text-[#938C80]">Drive:</span>
          <select
            defaultValue={currentDrive?.id}
            onChange={(e) => router.push(`/admin/results?drive=${e.target.value}`)}
            className="h-9 rounded-lg border-[1.5px] border-[#EDE4D4] bg-[#FCFAF6] px-2 text-[13px] outline-none"
          >
            {drives.map((d) => (
              <option key={d.id} value={d.id}>
                {d.titleEn} ({d.year})
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="mb-3 text-[13px] font-semibold text-[#B0303A]">{error}</p>}

      {!currentDrive ? (
        <p className="py-8 text-center text-[13px] text-[#938C80]">
          No result drive yet. Create one to start collecting student results.
        </p>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            <AdminBtn variant="ghost" onClick={() => toggleDrive("isOpen")}>
              {currentDrive.isOpen ? "Close drive" : "Reopen drive"}
            </AdminBtn>
            <AdminBtn variant="ghost" onClick={() => toggleDrive("isPublished")}>
              {currentDrive.isPublished ? "Unpublish toppers" : "Publish toppers"}
            </AdminBtn>
          </div>

          <AdminH3>
            Entries — {pending} pending / {entries.length} total
          </AdminH3>

          {entries.length === 0 ? (
            <p className="py-6 text-[13px] text-[#938C80]">No entries submitted yet.</p>
          ) : (
            <AdminTable>
              <thead>
                <tr>
                  <AdminTh>Student</AdminTh>
                  <AdminTh>Std</AdminTh>
                  <AdminTh>Total</AdminTh>
                  <AdminTh>Obtained</AdminTh>
                  <AdminTh>%</AdminTh>
                  <AdminTh>Status</AdminTh>
                  <AdminTh>Action</AdminTh>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const m = marks[e.id] || {
                    total: e.totalMarks?.toString() ?? "",
                    obtained: e.obtainedMarks?.toString() ?? "",
                  };
                  return (
                    <tr key={e.id}>
                      <AdminTd>
                        <b>{e.studentName}</b>
                        {e.schoolName ? <div className="text-[11px] text-[#938C80]">{e.schoolName}</div> : null}
                      </AdminTd>
                      <AdminTd>{e.standard}</AdminTd>
                      <AdminTd>
                        <input
                          type="number"
                          value={m.total}
                          onChange={(ev) => setMark(e.id, "total", ev.target.value)}
                          className="h-8 w-16 rounded-lg border border-[#EDE4D4] bg-[#FCFAF6] px-2 text-[12.5px] outline-none"
                        />
                      </AdminTd>
                      <AdminTd>
                        <input
                          type="number"
                          value={m.obtained}
                          onChange={(ev) => setMark(e.id, "obtained", ev.target.value)}
                          className="h-8 w-16 rounded-lg border border-[#EDE4D4] bg-[#FCFAF6] px-2 text-[12.5px] outline-none"
                        />
                      </AdminTd>
                      <AdminTd>
                        {e.percentage != null ? (
                          <span className={e.isEligible ? "font-bold text-[#22A45D]" : ""}>
                            {e.percentage}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </AdminTd>
                      <AdminTd>
                        <StatusPill status={lower(e.status)} />
                      </AdminTd>
                      <AdminTd>
                        <span className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => review(e, "APPROVED")}
                            disabled={busyId === e.id}
                            className="cursor-pointer rounded-[9px] bg-[#E4F5E9] px-[10px] py-[5px] text-[11.5px] font-extrabold text-[#1E9E52] disabled:opacity-60"
                          >
                            {busyId === e.id ? "…" : "Save ✓"}
                          </button>
                          <button
                            type="button"
                            onClick={() => review(e, "REJECTED")}
                            disabled={busyId === e.id}
                            className="cursor-pointer rounded-[9px] bg-[#FCE7E7] px-[10px] py-[5px] text-[11.5px] font-extrabold text-[#B0303A] disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </span>
                      </AdminTd>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          )}

          <AdminHint>
            Enter total + obtained marks then Save — percentage auto-calculates. ≥80% → eligible for
            felicitation 🎁.
          </AdminHint>
        </>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-[380px] rounded-2xl sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#2A2620]">New result drive</DialogTitle>
          </DialogHeader>
          <div>
            <AdminLabel>Title (English) *</AdminLabel>
            <AdminInput
              value={draft.titleEn}
              onChange={(v) => {
                setDraft((prev) => ({ ...prev, titleEn: v }));
                fromEn(v, (gu) => setDraft((prev) => ({ ...prev, titleGu: gu })));
              }}
            />
            <AdminLabel>Title (ગુજરાતી)</AdminLabel>
            <AdminInput
              value={draft.titleGu}
              onChange={(v) => {
                setDraft((prev) => ({ ...prev, titleGu: v }));
                fromGu(v, (en) => setDraft((prev) => ({ ...prev, titleEn: en })));
              }}
            />
            <AdminLabel>Year *</AdminLabel>
            <AdminInput type="number" value={draft.year} onChange={(v) => setDraft({ ...draft, year: v })} />
            {error && <p className="mt-2 text-[12.5px] font-semibold text-[#B0303A]">{error}</p>}
            <div className="mt-4 flex gap-2.5">
              <AdminBtn className="flex-1 justify-center" onClick={createDrive}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Create drive"}
              </AdminBtn>
              <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setNewOpen(false)}>
                Cancel
              </AdminBtn>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
