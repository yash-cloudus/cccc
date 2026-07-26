"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
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
  LinkAction,
} from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/http";
import { cn } from "@/lib/utils";
import { useTranslitSync } from "@/hooks/use-translit-sync";

type Committee = { id: string; nameEn: string; nameGu: string | null; members: number };
type InfoSection = {
  id: string;
  titleEn: string;
  titleGu: string | null;
  bodyEn: string | null;
  bodyGu: string | null;
  sortOrder: number;
};
type Village = {
  id: string;
  nameEn: string;
  nameGu: string;
  showPhones: boolean;
  families: number;
};
type CMember = {
  id: string;
  nameOverride: string | null;
  roleGu: string | null;
  phoneOverride: string | null;
  showContact: boolean;
  isActive: boolean;
};

export function InfoClient({
  showDirectoryPhones: initialGlobal,
  upiId: initialUpi,
  logoUrl: initialLogo,
  bannerUrl: initialBanner,
  committees: initialCommittees,
  infoSections: initialInfo,
  villages: initialVillages,
}: {
  showDirectoryPhones: boolean;
  upiId: string;
  logoUrl: string;
  bannerUrl: string;
  committees: Committee[];
  infoSections: InfoSection[];
  villages: Village[];
}) {
  const { fromEn, fromGu } = useTranslitSync();
  const [globalPhones, setGlobalPhones] = useState(initialGlobal);
  const [logoUrl, setLogoUrl] = useState(initialLogo);
  const [bannerUrl, setBannerUrl] = useState(initialBanner);
  const [brandBusy, setBrandBusy] = useState(false);

  async function saveBranding() {
    setBrandBusy(true);
    setError(null);
    const res = await api.patch("/api/admin/settings", {
      logoUrl: logoUrl.trim(),
      bannerUrl: bannerUrl.trim(),
    });
    setBrandBusy(false);
    if (!res.ok) setError(res.error);
  }

  /** Swap a section with its neighbour and persist both sortOrders. */
  async function moveSection(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= info.length) return;
    const next = [...info];
    [next[index], next[target]] = [next[target], next[index]];
    setInfo(next);
    const results = await Promise.all(
      next.map((s, i) => api.patch("/api/admin/info-sections", { id: s.id, sortOrder: i })),
    );
    if (results.some((r) => !r.ok)) {
      setInfo(info);
      setError("Could not reorder sections");
    }
  }
  const [upiId, setUpiId] = useState(initialUpi);
  const [upiDraft, setUpiDraft] = useState(initialUpi);
  const [committees, setCommittees] = useState<Committee[]>(initialCommittees);
  const [info, setInfo] = useState<InfoSection[]>(initialInfo);
  const [villages, setVillages] = useState<Village[]>(initialVillages);
  const [error, setError] = useState<string | null>(null);

  /* ---- Committee dialogs ---- */
  const [committeeEdit, setCommitteeEdit] = useState<{ id: string | null; nameEn: string; nameGu: string } | null>(null);
  const [manageOf, setManageOf] = useState<Committee | null>(null);

  /* ---- Info dialog ---- */
  const [infoEdit, setInfoEdit] = useState<{
    id: string | null;
    titleEn: string;
    titleGu: string;
    bodyEn: string;
    bodyGu: string;
  } | null>(null);

  /* ---- Village dialog ---- */
  const [villageAdd, setVillageAdd] = useState<{ nameEn: string; nameGu: string } | null>(null);

  const [busy, setBusy] = useState(false);

  /* ============ Global directory phones ============ */
  async function toggleGlobal() {
    const next = !globalPhones;
    setGlobalPhones(next);
    const res = await api.patch(`/api/admin/settings`, { showDirectoryPhones: next });
    if (!res.ok) {
      setGlobalPhones(!next);
      setError(res.error);
    }
  }

  async function saveUpi() {
    setBusy(true);
    setError(null);
    const value = upiDraft.trim();
    const res = await api.patch(`/api/admin/settings`, { settings: { upiId: value } });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setUpiId(value);
  }

  /* ============ Committees ============ */
  async function saveCommittee() {
    if (!committeeEdit) return;
    if (!committeeEdit.nameEn.trim()) return setError("Committee name is required");
    setBusy(true);
    setError(null);
    const payload = { nameEn: committeeEdit.nameEn.trim(), nameGu: committeeEdit.nameGu.trim() || undefined };
    const res = committeeEdit.id
      ? await api.patch<Committee>(`/api/admin/committees`, { id: committeeEdit.id, ...payload })
      : await api.post<Committee>(`/api/admin/committees`, payload);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setCommittees((prev) =>
      committeeEdit.id
        ? prev.map((c) => (c.id === committeeEdit.id ? { ...c, nameEn: res.data.nameEn, nameGu: res.data.nameGu } : c))
        : [...prev, { id: res.data.id, nameEn: res.data.nameEn, nameGu: res.data.nameGu, members: 0 }],
    );
    setCommitteeEdit(null);
  }

  async function deleteCommittee(id: string) {
    if (!window.confirm("Delete this committee?")) return;
    const res = await api.del(`/api/admin/committees?id=${id}`);
    if (!res.ok) return setError(res.error);
    setCommittees((prev) => prev.filter((c) => c.id !== id));
  }

  /* ============ Info sections ============ */
  async function saveInfo() {
    if (!infoEdit) return;
    if (!infoEdit.titleEn.trim()) return setError("Title is required");
    setBusy(true);
    setError(null);
    const payload = {
      titleEn: infoEdit.titleEn.trim(),
      titleGu: infoEdit.titleGu.trim() || undefined,
      bodyEn: infoEdit.bodyEn || undefined,
      bodyGu: infoEdit.bodyGu || undefined,
    };
    const res = infoEdit.id
      ? await api.patch<InfoSection>(`/api/admin/info-sections`, { id: infoEdit.id, ...payload })
      : await api.post<InfoSection>(`/api/admin/info-sections`, payload);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setInfo((prev) =>
      infoEdit.id ? prev.map((s) => (s.id === infoEdit.id ? { ...s, ...res.data } : s)) : [...prev, res.data],
    );
    setInfoEdit(null);
  }

  async function deleteInfo(id: string) {
    if (!window.confirm("Delete this info page?")) return;
    const res = await api.del(`/api/admin/info-sections?id=${id}`);
    if (!res.ok) return setError(res.error);
    setInfo((prev) => prev.filter((s) => s.id !== id));
  }

  /* ============ Villages ============ */
  async function toggleVillage(v: Village) {
    const next = !v.showPhones;
    setVillages((prev) => prev.map((x) => (x.id === v.id ? { ...x, showPhones: next } : x)));
    const res = await api.patch(`/api/admin/villages`, { id: v.id, showPhones: next });
    if (!res.ok) {
      setVillages((prev) => prev.map((x) => (x.id === v.id ? { ...x, showPhones: !next } : x)));
      setError(res.error);
    }
  }

  async function addVillage() {
    if (!villageAdd) return;
    if (!villageAdd.nameEn.trim() || !villageAdd.nameGu.trim()) return setError("Both names are required");
    setBusy(true);
    setError(null);
    const res = await api.post<Village>(`/api/admin/villages`, {
      nameEn: villageAdd.nameEn.trim(),
      nameGu: villageAdd.nameGu.trim(),
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setVillages((prev) => [...prev, { ...res.data, families: 0 }]);
    setVillageAdd(null);
  }

  return (
    <>
      <AdminH2 className="mb-1">Community info</AdminH2>
      <AdminHint className="mt-0 mb-5 max-w-3xl text-[12.5px]">
        Everything shown in the User App → Community Information section is managed here. Changes
        sync to the app on save.
      </AdminHint>

      <section className="mb-6 rounded-2xl border border-[var(--line-admin)] bg-white p-5 max-md:p-4">
        <AdminH3>Cover banner &amp; logo</AdminH3>

        <div className="relative mb-3 h-[132px] overflow-hidden rounded-xl bg-[var(--surface-admin)]">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-[12.5px] font-semibold text-[var(--faint)]">
              No cover banner
            </span>
          )}
          <span className="absolute bottom-3 left-3 flex size-14 items-center justify-center overflow-hidden rounded-[14px] border-2 border-white bg-[var(--brand)] text-[15px] font-extrabold text-white shadow">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-full object-cover" />
            ) : (
              "—"
            )}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <AdminLabel>Cover banner URL</AdminLabel>
            <AdminInput
              value={bannerUrl}
              onChange={setBannerUrl}
              placeholder="https://…/banner.jpg"
            />
          </div>
          <div>
            <AdminLabel>Logo URL</AdminLabel>
            <AdminInput value={logoUrl} onChange={setLogoUrl} placeholder="https://…/logo.png" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2.5">
          <AdminBtn onClick={saveBranding} disabled={brandBusy}>
            {brandBusy ? <Loader2 className="size-4 animate-spin" /> : "Save banner & logo"}
          </AdminBtn>
          {(bannerUrl || logoUrl) && (
            <AdminBtn
              variant="ghost"
              onClick={() => {
                setBannerUrl("");
                setLogoUrl("");
              }}
            >
              Remove
            </AdminBtn>
          )}
        </div>
      </section>

      {error && <p className="mb-3 text-[13px] font-semibold text-[var(--danger)]">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <AdminH3>Committees</AdminH3>
          <AdminTable>
            <thead>
              <tr>
                <AdminTh>Committee</AdminTh>
                <AdminTh>Members</AdminTh>
              </tr>
            </thead>
            <tbody>
              {committees.map((c) => (
                <tr key={c.id}>
                  <AdminTd>{c.nameGu || c.nameEn}</AdminTd>
                  <AdminTd className="text-[#3D7BC4]">
                    {c.members} ·{" "}
                    <span className="inline-flex gap-2">
                      <LinkAction onClick={() => setManageOf(c)}>manage</LinkAction>
                      <LinkAction onClick={() => setCommitteeEdit({ id: c.id, nameEn: c.nameEn, nameGu: c.nameGu || "" })}>
                        edit
                      </LinkAction>
                      <LinkAction danger onClick={() => deleteCommittee(c.id)}>
                        delete
                      </LinkAction>
                    </span>
                  </AdminTd>
                </tr>
              ))}
              <tr>
                <AdminTd colSpan={2}>
                  <button
                    type="button"
                    onClick={() => setCommitteeEdit({ id: null, nameEn: "", nameGu: "" })}
                    className="cursor-pointer font-bold text-[var(--brand)]"
                  >
                    + Add committee
                  </button>
                </AdminTd>
              </tr>
            </tbody>
          </AdminTable>
          <AdminHint>Manage = add members, assign position/role + contact visibility.</AdminHint>
        </div>

        <div>
          <AdminH3>Info pages</AdminH3>
          <AdminTable>
            <tbody>
              {info.map((s, i) => (
                <tr key={s.id}>
                  <AdminTd>
                    <span className="flex items-center gap-2">
                      <span className="flex flex-col leading-none">
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={i === 0}
                          onClick={() => moveSection(i, -1)}
                          className="cursor-pointer px-1 text-[10px] text-[var(--faint)] disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={i === info.length - 1}
                          onClick={() => moveSection(i, 1)}
                          className="cursor-pointer px-1 text-[10px] text-[var(--faint)] disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </span>
                      {s.titleGu || s.titleEn}
                    </span>
                  </AdminTd>
                  <AdminTd className="text-right">
                    <span className="flex justify-end gap-2">
                      <LinkAction
                        onClick={() =>
                          setInfoEdit({
                            id: s.id,
                            titleEn: s.titleEn,
                            titleGu: s.titleGu || "",
                            bodyEn: s.bodyEn || "",
                            bodyGu: s.bodyGu || "",
                          })
                        }
                      >
                        edit
                      </LinkAction>
                      <LinkAction danger onClick={() => deleteInfo(s.id)}>
                        delete
                      </LinkAction>
                    </span>
                  </AdminTd>
                </tr>
              ))}
              <tr>
                <AdminTd colSpan={2}>
                  <button
                    type="button"
                    onClick={() => setInfoEdit({ id: null, titleEn: "", titleGu: "", bodyEn: "", bodyGu: "" })}
                    className="cursor-pointer font-bold text-[var(--brand)]"
                  >
                    + New page (title + text)
                  </button>
                </AdminTd>
              </tr>
            </tbody>
          </AdminTable>
        </div>
      </div>

      <div className="mt-[26px] rounded-[14px] border border-[var(--line-field)] bg-[var(--field)] p-4">
        <AdminH3 className="mb-1">Donations — UPI ID</AdminH3>
        <AdminHint className="mb-3">
          Members on the Donate screen will open a UPI payment to this ID. Leave blank to only record donation pledges.
        </AdminHint>
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="min-w-[220px] flex-1">
            <AdminLabel>UPI ID</AdminLabel>
            <AdminInput
              value={upiDraft}
              onChange={setUpiDraft}
              placeholder="community@upi"
            />
          </div>
          <AdminBtn onClick={saveUpi} disabled={busy || upiDraft.trim() === upiId}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Save UPI"}
          </AdminBtn>
        </div>
        {upiId ? (
          <p className="mt-2 text-[12px] font-semibold text-[var(--success)]">Active: {upiId}</p>
        ) : (
          <p className="mt-2 text-[12px] text-[var(--faint)]">No UPI configured yet.</p>
        )}
      </div>

      <div className="mt-[26px] flex flex-wrap items-center justify-between gap-3">
        <AdminH3 className="mb-0">Directory privacy by village (ગામ પ્રમાણે નંબર)</AdminH3>
        <label className="flex items-center gap-2 text-[11.5px] font-bold text-[var(--ink-mid)]">
          <span>Global: show phones in directory</span>
          <Switch
            checked={globalPhones}
            onCheckedChange={toggleGlobal}
            className="h-[27px] w-[46px] data-checked:bg-[var(--wa)] data-unchecked:bg-[var(--scroll-thumb)] [&_[data-slot=switch-thumb]]:size-[21px]"
          />
        </label>
      </div>
      <AdminHint className="-mt-1 mb-3">
        Turn ON to let members of that village show their phone numbers in the directory. When OFF,
        no phone is shown to others for that village — regardless of the member&apos;s own setting.
      </AdminHint>

      <AdminTable>
        <thead>
          <tr>
            <AdminTh>Village / area</AdminTh>
            <AdminTh>Families</AdminTh>
            <AdminTh>Show numbers in directory</AdminTh>
          </tr>
        </thead>
        <tbody>
          {villages.map((v) => (
            <tr key={v.id}>
              <AdminTd>
                <b>
                  {v.nameGu} / {v.nameEn}
                </b>
              </AdminTd>
              <AdminTd>{v.families}</AdminTd>
              <AdminTd>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={v.showPhones}
                    onCheckedChange={() => toggleVillage(v)}
                    className={cn(
                      "h-[27px] w-[46px] data-checked:bg-[var(--wa)] data-unchecked:bg-[var(--scroll-thumb)]",
                      "[&_[data-slot=switch-thumb]]:size-[21px]",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[11.5px] font-bold",
                      v.showPhones ? "text-[var(--success)]" : "text-[var(--danger)]",
                    )}
                  >
                    {v.showPhones ? "ON · shown" : "OFF · hidden"}
                  </span>
                </div>
              </AdminTd>
            </tr>
          ))}
          <tr>
            <AdminTd colSpan={3}>
              <button
                type="button"
                onClick={() => setVillageAdd({ nameEn: "", nameGu: "" })}
                className="cursor-pointer font-bold text-[var(--brand)]"
              >
                + Add village / area
              </button>
            </AdminTd>
          </tr>
        </tbody>
      </AdminTable>

      {/* Committee edit dialog */}
      <Dialog open={committeeEdit !== null} onOpenChange={(o) => !o && setCommitteeEdit(null)}>
        <DialogContent className="max-w-[360px] rounded-2xl sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              {committeeEdit?.id ? "Edit committee" : "Add committee"}
            </DialogTitle>
          </DialogHeader>
          {committeeEdit && (
            <div>
              <AdminLabel>Name (English) *</AdminLabel>
              <AdminInput
                value={committeeEdit.nameEn}
                onChange={(v) => {
                  setCommitteeEdit((prev) => (prev ? { ...prev, nameEn: v } : prev));
                  fromEn(v, (gu) => setCommitteeEdit((prev) => (prev ? { ...prev, nameGu: gu } : prev)));
                }}
              />
              <AdminLabel>Name (ગુજરાતી)</AdminLabel>
              <AdminInput
                value={committeeEdit.nameGu}
                onChange={(v) => {
                  setCommitteeEdit((prev) => (prev ? { ...prev, nameGu: v } : prev));
                  fromGu(v, (en) => setCommitteeEdit((prev) => (prev ? { ...prev, nameEn: en } : prev)));
                }}
              />
              <div className="mt-4 flex gap-2.5">
                <AdminBtn className="flex-1 justify-center" onClick={saveCommittee}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                </AdminBtn>
                <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setCommitteeEdit(null)}>
                  Cancel
                </AdminBtn>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Info edit dialog */}
      <Dialog open={infoEdit !== null} onOpenChange={(o) => !o && setInfoEdit(null)}>
        <DialogContent className="max-h-[88vh] max-w-[460px] overflow-y-auto rounded-2xl sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
              {infoEdit?.id ? "Edit info page" : "New info page"}
            </DialogTitle>
          </DialogHeader>
          {infoEdit && (
            <div>
              <AdminLabel>Title (English) *</AdminLabel>
              <AdminInput
                value={infoEdit.titleEn}
                onChange={(v) => {
                  setInfoEdit((prev) => (prev ? { ...prev, titleEn: v } : prev));
                  fromEn(v, (gu) => setInfoEdit((prev) => (prev ? { ...prev, titleGu: gu } : prev)), "title");
                }}
              />
              <AdminLabel>Title (ગુજરાતી)</AdminLabel>
              <AdminInput
                value={infoEdit.titleGu}
                onChange={(v) => {
                  setInfoEdit((prev) => (prev ? { ...prev, titleGu: v } : prev));
                  fromGu(v, (en) => setInfoEdit((prev) => (prev ? { ...prev, titleEn: en } : prev)), "title");
                }}
              />
              <AdminLabel>Body (English)</AdminLabel>
              <Textarea
                value={infoEdit.bodyEn}
                onChange={(e) => {
                  const v = e.target.value;
                  setInfoEdit((prev) => (prev ? { ...prev, bodyEn: v } : prev));
                  fromEn(v, (gu) => setInfoEdit((prev) => (prev ? { ...prev, bodyGu: gu } : prev)), "body");
                }}
                className="mb-2 min-h-[80px] border-[var(--line-field)] bg-[var(--field)] text-[13px]"
              />
              <AdminLabel>Body (ગુજરાતી)</AdminLabel>
              <Textarea
                value={infoEdit.bodyGu}
                onChange={(e) => {
                  const v = e.target.value;
                  setInfoEdit((prev) => (prev ? { ...prev, bodyGu: v } : prev));
                  fromGu(v, (en) => setInfoEdit((prev) => (prev ? { ...prev, bodyEn: en } : prev)), "body");
                }}
                className="mb-2 min-h-[80px] border-[var(--line-field)] bg-[var(--field)] text-[13px]"
              />
              <div className="mt-3 flex gap-2.5">
                <AdminBtn className="flex-1 justify-center" onClick={saveInfo}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                </AdminBtn>
                <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setInfoEdit(null)}>
                  Cancel
                </AdminBtn>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Village add dialog */}
      <Dialog open={villageAdd !== null} onOpenChange={(o) => !o && setVillageAdd(null)}>
        <DialogContent className="max-w-[360px] rounded-2xl sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[var(--ink)]">Add village / area</DialogTitle>
          </DialogHeader>
          {villageAdd && (
            <div>
              <AdminLabel>Name (English) *</AdminLabel>
              <AdminInput
                value={villageAdd.nameEn}
                onChange={(v) => {
                  setVillageAdd((prev) => (prev ? { ...prev, nameEn: v } : prev));
                  fromEn(v, (gu) => setVillageAdd((prev) => (prev ? { ...prev, nameGu: gu } : prev)));
                }}
              />
              <AdminLabel>Name (ગુજરાતી) *</AdminLabel>
              <AdminInput
                value={villageAdd.nameGu}
                onChange={(v) => {
                  setVillageAdd((prev) => (prev ? { ...prev, nameGu: v } : prev));
                  fromGu(v, (en) => setVillageAdd((prev) => (prev ? { ...prev, nameEn: en } : prev)));
                }}
              />
              <div className="mt-4 flex gap-2.5">
                <AdminBtn className="flex-1 justify-center" onClick={addVillage}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Add"}
                </AdminBtn>
                <AdminBtn variant="ghost" className="flex-1 justify-center" onClick={() => setVillageAdd(null)}>
                  Cancel
                </AdminBtn>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage committee members modal */}
      {manageOf && (
        <CommitteeMembersModal
          committee={manageOf}
          onClose={() => setManageOf(null)}
          onCountChange={(delta) =>
            setCommittees((prev) =>
              prev.map((c) => (c.id === manageOf.id ? { ...c, members: Math.max(0, c.members + delta) } : c)),
            )
          }
        />
      )}
    </>
  );
}

function CommitteeMembersModal({
  committee,
  onClose,
  onCountChange,
}: {
  committee: Committee;
  onClose: () => void;
  onCountChange: (delta: number) => void;
}) {
  const [members, setMembers] = useState<CMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ nameOverride: "", roleGu: "", phoneOverride: "" });
  const [busy, setBusy] = useState(false);

  // Load members on mount.
  useEffect(() => {
    let active = true;
    api.get<CMember[]>(`/api/admin/committee-members?committeeId=${committee.id}`).then((res) => {
      if (!active) return;
      setLoading(false);
      if (res.ok) setMembers(res.data);
      else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [committee.id]);

  async function add() {
    if (!form.nameOverride.trim()) return setError("Member name is required");
    setBusy(true);
    setError(null);
    const res = await api.post<CMember>(`/api/admin/committee-members`, {
      committeeId: committee.id,
      nameOverride: form.nameOverride.trim(),
      roleGu: form.roleGu.trim() || undefined,
      phoneOverride: form.phoneOverride.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setMembers((prev) => [...prev, res.data]);
    onCountChange(1);
    setForm({ nameOverride: "", roleGu: "", phoneOverride: "" });
  }

  async function remove(id: string) {
    const res = await api.del(`/api/admin/committee-members?id=${id}`);
    if (!res.ok) return setError(res.error);
    setMembers((prev) => prev.filter((m) => m.id !== id));
    onCountChange(-1);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-[440px] overflow-y-auto rounded-2xl p-0 sm:max-w-[440px]" showCloseButton={false}>
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--line-soft)] bg-white px-6 py-5">
          <DialogTitle className="text-base font-extrabold text-[var(--ink)]">
            {committee.nameGu || committee.nameEn} — members
          </DialogTitle>
          <button type="button" onClick={onClose} className="cursor-pointer text-[var(--faint-soft)]">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-6 py-4 pb-5">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-[var(--faint)]">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {members.map((m) => (
                <div key={m.id} className="mb-2 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold text-[var(--ink)]">{m.nameOverride || "—"}</div>
                    <div className="text-[11.5px] text-[var(--faint)]">
                      {m.roleGu || "—"} {m.phoneOverride ? `· ${m.phoneOverride}` : ""}
                    </div>
                  </div>
                  <button type="button" onClick={() => remove(m.id)} className="cursor-pointer text-[11px] font-bold text-[var(--danger)] underline">
                    Remove
                  </button>
                </div>
              ))}
              {members.length === 0 && <p className="mb-2 text-[12.5px] text-[var(--faint)]">No members yet.</p>}

              <div className="mt-3 rounded-xl border border-[#EEE7DA] bg-[var(--field)] p-3">
                <AdminLabel>Member name *</AdminLabel>
                <AdminInput value={form.nameOverride} onChange={(v) => setForm({ ...form, nameOverride: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <AdminLabel>Role (ગુજરાતી)</AdminLabel>
                    <AdminInput value={form.roleGu} onChange={(v) => setForm({ ...form, roleGu: v })} />
                  </div>
                  <div>
                    <AdminLabel>Phone</AdminLabel>
                    <AdminInput value={form.phoneOverride} onChange={(v) => setForm({ ...form, phoneOverride: v })} />
                  </div>
                </div>
                {error && <p className="mt-2 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>}
                <AdminBtn className="mt-3 w-full justify-center" onClick={add}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "+ Add member"}
                </AdminBtn>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
