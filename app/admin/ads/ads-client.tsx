"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
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
  PillActive,
  PillExpired,
  PillWarning,
} from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/http";

export type AdStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "REJECTED";

export type AdRow = {
  id: string;
  name: string;
  start: string;
  end: string;
  status: AdStatus;
  priority: number;
  views: number;
  clicks: number;
};

type Draft = {
  name: string;
  pitch: string;
  imageUrl: string;
  linkUrl: string;
  startDate: string;
  endDate: string;
  priority: string;
};

const emptyDraft: Draft = {
  name: "",
  pitch: "",
  imageUrl: "",
  linkUrl: "",
  startDate: "",
  endDate: "",
  priority: "0",
};

function StatusCell({ status }: { status: AdStatus }) {
  if (status === "ACTIVE") return <PillActive>Active</PillActive>;
  if (status === "PENDING") return <PillWarning>Pending</PillWarning>;
  if (status === "REJECTED") return <PillExpired>Rejected</PillExpired>;
  return <PillExpired>Expired</PillExpired>;
}

export function AdsClient({ initialRows }: { initialRows: AdRow[] }) {
  const [rows, setRows] = useState<AdRow[]>(initialRows);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(id: string, status: AdStatus) {
    const prevRows = rows;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const res = await api.patch(`/api/admin/ads`, { id, status });
    if (!res.ok) {
      setRows(prevRows);
      setError(res.error);
    }
  }

  async function setPriority(id: string, priority: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, priority } : r)));
    const res = await api.patch(`/api/admin/ads`, { id, priority });
    if (!res.ok) setError(res.error);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this ad?")) return;
    const res = await api.del(`/api/admin/ads?id=${id}`);
    if (!res.ok) return setError(res.error);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function create() {
    if (!draft) return;
    if (!draft.name.trim() || !draft.startDate || !draft.endDate) {
      setError("Name, start and end dates are required");
      return;
    }
    setBusy(true);
    setError(null);
    const created = await api.post<{ id: string }>(`/api/ads`, {
      name: draft.name,
      pitch: draft.pitch || undefined,
      imageUrl: draft.imageUrl || undefined,
      linkUrl: draft.linkUrl || undefined,
      startDate: new Date(draft.startDate).toISOString(),
      endDate: new Date(draft.endDate).toISOString(),
      priority: Number(draft.priority) || 0,
    });
    if (!created.ok) {
      setBusy(false);
      return setError(created.error);
    }
    // Admin-created ads go live immediately.
    await api.patch(`/api/admin/ads`, { id: created.data.id, status: "ACTIVE" });
    setBusy(false);
    setRows((prev) => [
      {
        id: created.data.id,
        name: draft.name,
        start: new Date(draft.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        end: new Date(draft.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        status: "ACTIVE",
        priority: Number(draft.priority) || 0,
        views: 0,
        clicks: 0,
      },
      ...prev,
    ]);
    setDraft(null);
  }

  return (
    <>
      <AdminH2>Ads</AdminH2>
      <AdminBtn className="mb-4 inline-flex" onClick={() => { setDraft({ ...emptyDraft }); setError(null); }}>
        <Plus className="size-4" />
        New ad
      </AdminBtn>

      {error && !draft && <p className="mb-3 text-[13px] font-semibold text-[#B0303A]">{error}</p>}

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Ad</AdminTh>
            <AdminTh>Start</AdminTh>
            <AdminTh>End</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh>Priority</AdminTh>
            <AdminTh>Views</AdminTh>
            <AdminTh>Clicks</AdminTh>
            <AdminTh>Actions</AdminTh>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <AdminTd>{a.name}</AdminTd>
              <AdminTd>{a.start}</AdminTd>
              <AdminTd>{a.end}</AdminTd>
              <AdminTd>
                <StatusCell status={a.status} />
              </AdminTd>
              <AdminTd>
                <input
                  type="number"
                  value={a.priority}
                  onChange={(e) => setPriority(a.id, Number(e.target.value))}
                  className="h-8 w-14 rounded-lg border border-[#EDE4D4] bg-[#FCFAF6] px-2 text-[12.5px] outline-none"
                />
              </AdminTd>
              <AdminTd>{a.views.toLocaleString()}</AdminTd>
              <AdminTd>{a.clicks}</AdminTd>
              <AdminTd>
                <span className="flex flex-wrap gap-2">
                  {a.status !== "ACTIVE" && (
                    <LinkAction onClick={() => setStatus(a.id, "ACTIVE")}>Activate</LinkAction>
                  )}
                  {a.status === "ACTIVE" && (
                    <LinkAction onClick={() => setStatus(a.id, "EXPIRED")}>Expire</LinkAction>
                  )}
                  {a.status === "PENDING" && (
                    <LinkAction danger onClick={() => setStatus(a.id, "REJECTED")}>
                      Reject
                    </LinkAction>
                  )}
                  <LinkAction danger onClick={() => remove(a.id)}>
                    Delete
                  </LinkAction>
                </span>
              </AdminTd>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      {rows.length === 0 && (
        <p className="py-6 text-center text-[11.5px] text-[#938C80]">No ads yet.</p>
      )}

      <AdminHint>
        Auto-expiry on end date · renew = extend date · views/clicks help renewal conversations.
      </AdminHint>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-[460px] overflow-y-auto rounded-2xl sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#2A2620]">New ad</DialogTitle>
          </DialogHeader>
          {draft && (
            <div>
              <AdminLabel>Business / ad name *</AdminLabel>
              <AdminInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
              <AdminLabel>Pitch / caption</AdminLabel>
              <AdminInput value={draft.pitch} onChange={(v) => setDraft({ ...draft, pitch: v })} />
              <AdminLabel>Image URL</AdminLabel>
              <AdminInput value={draft.imageUrl} onChange={(v) => setDraft({ ...draft, imageUrl: v })} />
              <AdminLabel>Link URL</AdminLabel>
              <AdminInput value={draft.linkUrl} onChange={(v) => setDraft({ ...draft, linkUrl: v })} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <AdminLabel>Start date *</AdminLabel>
                  <AdminInput type="date" value={draft.startDate} onChange={(v) => setDraft({ ...draft, startDate: v })} />
                </div>
                <div>
                  <AdminLabel>End date *</AdminLabel>
                  <AdminInput type="date" value={draft.endDate} onChange={(v) => setDraft({ ...draft, endDate: v })} />
                </div>
              </div>
              <AdminLabel>Priority</AdminLabel>
              <AdminInput type="number" value={draft.priority} onChange={(v) => setDraft({ ...draft, priority: v })} />
              {error && <p className="mt-2 text-[12.5px] font-semibold text-[#B0303A]">{error}</p>}
              <div className="mt-4 flex gap-2.5">
                <AdminBtn className="flex-1 justify-center" onClick={create}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Create & activate"}
                </AdminBtn>
                <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setDraft(null)}>
                  Cancel
                </AdminBtn>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
