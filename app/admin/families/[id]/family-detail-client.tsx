"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin, Pencil, UserPlus } from "lucide-react";
import {
  AdminBtn,
  AdminH2,
  AdminH3,
  AdminTable,
  AdminTd,
} from "@/components/admin/admin-ui";
import { api } from "@/lib/http";
import { bloodLabel, formatDate, phoneText } from "@/lib/format";
import { useAdminT, type AdminKey } from "@/lib/i18n/admin-dictionary";
import { cn } from "@/lib/utils";

type FamilyStatus = "PENDING" | "APPROVED" | "REJECTED";

export type DetailMember = {
  id: string;
  fullNameEn: string;
  fullNameGu: string | null;
  relation: string | null;
  gender: string | null;
  mobile: string | null;
  mobileIso: string;
  whatsappIso: string;
  isNri: boolean;
  nriCountry: string | null;
  nriCity: string | null;
  /** Head only — collected on the registration form. */
  photoUrl: string | null;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  occupation: string | null;
  occupationOther: string | null;
  education: string | null;
  course: string | null;
  currentlyAt: string | null;
  hasWhatsApp: boolean;
  whatsapp: string | null;
  showPhone: boolean;
  isHead: boolean;
  isVisible: boolean;
  isDeceased: boolean;
  /** MOBILE_PASSWORD: this member's number has a login password set. */
  hasPassword: boolean;
};

export type FamilyDetail = {
  id: string;
  status: FamilyStatus;
  loginMobile: string | null;
  headNameEn: string;
  headNameGu: string | null;
  surnameEn: string;
  surnameGu: string | null;
  surnameGroupEn: string | null;
  surnameGroupGu: string | null;
  addressEn: string;
  addressGu: string | null;
  city: string | null;
  villageEn: string | null;
  villageGu: string | null;
  nativePlace: string | null;
  email: string | null;
  businessGu: string | null;
  nativeElderNameEn: string | null;
  nativeElderNameGu: string | null;
  nativeElderPhone: string | null;
  latitude: number | null;
  longitude: number | null;
  rejectReason: string | null;
  consentAccepted: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  members: DetailMember[];
};

const STATUS_META: Record<FamilyStatus, { labelKey: AdminKey; className: string }> = {
  APPROVED: { labelKey: "fam.statusApproved", className: "bg-[var(--success-tint)] text-[var(--success)]" },
  PENDING: { labelKey: "fam.statusPending", className: "bg-[var(--gold-tint)] text-[var(--warn)]" },
  REJECTED: { labelKey: "fam.statusDeactivated", className: "bg-[var(--line-soft)] text-[var(--muted)]" },
};

const MEMBER_COLORS = [
  { c: "var(--danger)", bg: "var(--danger-tint)" },
  { c: "var(--violet)", bg: "var(--violet-tint)" },
  { c: "var(--leaf)", bg: "var(--leaf-tint)" },
  { c: "var(--ochre)", bg: "var(--ochre-tint)" },
  { c: "#2A6FA0", bg: "var(--info-tint)" },
];

/** One label/value row; renders an em-dash for anything blank. */
function Row({ label, children }: { label: string; children?: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <tr>
      <AdminTd className="w-[160px] align-top text-[var(--faint)]">{label}</AdminTd>
      <AdminTd className="align-top">{empty ? "—" : children}</AdminTd>
    </tr>
  );
}

export function FamilyDetailClient({
  family,
  communityType,
  authMode,
}: {
  family: FamilyDetail;
  communityType: "PARIVAR" | "GAM";
  authMode: string;
}) {
  const router = useRouter();
  const { t, tf, lang } = useAdminT();
  const [members, setMembers] = useState<DetailMember[]>(family.members);
  const [error, setError] = useState<string | null>(null);
  const passwordLogin = authMode === "MOBILE_PASSWORD";
  const loginMember =
    members.find((m) => m.mobile && m.mobile === family.loginMobile) ??
    members.find((m) => m.hasPassword) ??
    null;

  const pick = (en: string | null, gu: string | null) =>
    (lang === "en" ? en || gu : gu || en) || "";

  const headName = pick(family.headNameEn, family.headNameGu);
  const surname = pick(family.surnameEn, family.surnameGu);
  const statusMeta = STATUS_META[family.status];

  async function patchMember(m: DetailMember, patch: Partial<DetailMember>) {
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
    const res = await api.patch(`/api/admin/family-members`, { id: m.id, ...patch });
    if (!res.ok) {
      // `m` is the pre-patch snapshot, so restoring it undoes the optimistic edit.
      setMembers((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      setError(res.error);
      return;
    }
    setError(null);
    router.refresh();
  }

  async function makeHead(m: DetailMember) {
    setMembers((prev) => prev.map((x) => ({ ...x, isHead: x.id === m.id })));
    const res = await api.patch(`/api/admin/family-members`, { id: m.id, isHead: true });
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  async function changeLogin(m: DetailMember) {
    const value = window.prompt(t("fam.newLoginPrompt"), m.mobile || "");
    if (value === null) return;
    const mobile = value.trim();
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, mobile: mobile || null } : x)));
    const res = await api.patch(`/api/admin/family-members`, { id: m.id, mobile: mobile || null });
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  /** Sets the household password and, with it, which number holds the login. */
  async function setPassword(m: DetailMember) {
    const value = window.prompt(t("fam.setPasswordPrompt"), "");
    if (value === null) return;
    const loginPassword = value.trim();
    if (!/^\d{6}$/.test(loginPassword)) {
      setError(t("fam.passwordMustBe6"));
      return;
    }
    const res = await api.patch(`/api/admin/family-members`, { id: m.id, loginPassword });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin/families")}
            aria-label={t("fam.backToFamilies")}
            title={t("fam.backToFamilies")}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--line-admin)] bg-white text-[var(--ink)] shadow-sm transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]"
          >
            <ChevronLeft className="size-5" strokeWidth={2.4} />
          </button>
          <div className="min-w-0">
            <AdminH2 className="mb-0.5">
              {headName} {surname}
            </AdminH2>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                  statusMeta.className,
                )}
              >
                {t(statusMeta.labelKey)}
              </span>
              <span className="text-[12px] text-[var(--faint)]">
                {tf("fam.memberCountN", { n: members.length })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminBtn onClick={() => router.push(`/admin/queue/${family.id}?from=families`)}>
            <Pencil className="size-4" /> {t("common.edit")}
          </AdminBtn>
          <AdminBtn
            variant="ghost"
            onClick={() => router.push(`/admin/queue/${family.id}?from=families&add=1`)}
          >
            <UserPlus className="size-4" /> {t("fam.addMember")}
          </AdminBtn>
        </div>
      </div>

      {error && (
        <p className="mb-3 text-[12.5px] font-semibold text-[var(--danger)]">{error}</p>
      )}

      {/* ── Login (MOBILE_PASSWORD only) ───────────────────────────────── */}
      {passwordLogin && (
        <section className="mb-5 rounded-2xl border border-[var(--line-admin)] bg-white p-5 max-md:p-4">
          <AdminH3>{t("fam.login")}</AdminH3>
          {/* The number and the password are separate facts. A migrated family
              whose head had no date of birth has the first and not the second —
              showing only "not set" would hide which number needs one. */}
          {loginMember?.mobile && (
            <p className="text-[13px] text-[var(--ink-soft)]">
              {t("fam.loginNumber")}: <b>{loginMember.mobile}</b>
              {" · "}
              {pick(loginMember.fullNameEn, loginMember.fullNameGu)}
            </p>
          )}
          {!loginMember?.hasPassword && (
            <p className="mt-1 text-[13px] font-semibold text-[var(--danger)]">
              {t("fam.loginNotSet")}
            </p>
          )}
          <p className="mt-1.5 text-[12px] text-[var(--faint)]">{t("fam.loginHelp")}</p>
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* ── Family details ───────────────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--line-admin)] bg-white p-4 sm:p-5 lg:sticky lg:top-4">
          <AdminH3>{t("fam.familyDetails")}</AdminH3>
          <AdminTable>
            <tbody>
              <Row label={t("fam.headName")}>
                {family.headNameEn}
                {family.headNameGu ? ` · ${family.headNameGu}` : ""}
              </Row>
              <Row label={t("fam.surname")}>
                {family.surnameEn}
                {family.surnameGu ? ` · ${family.surnameGu}` : ""}
              </Row>
              <Row label={t("fam.surnameGroup")}>
                {pick(family.surnameGroupEn, family.surnameGroupGu)}
              </Row>
              <Row label={t("fam.address")}>{pick(family.addressEn, family.addressGu)}</Row>
              {communityType === "GAM" && (
                <Row label={t("fam.village")}>{pick(family.villageEn, family.villageGu)}</Row>
              )}
              <Row label={t("fam.city")}>{family.city}</Row>
              <Row label={t("fam.nativePlace")}>{family.nativePlace}</Row>
              <Row label={t("fam.email")}>{family.email}</Row>
              <Row label={t("fam.business")}>{family.businessGu}</Row>
              <Row label={t("fam.nativeElder")}>
                {family.nativeElderNameEn || family.nativeElderNameGu
                  ? `${pick(family.nativeElderNameEn, family.nativeElderNameGu)}${
                      family.nativeElderPhone ? ` · ${family.nativeElderPhone}` : ""
                    }`
                  : ""}
              </Row>
              <Row label={t("fam.mapLocation")}>
                {family.latitude != null && family.longitude != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${family.latitude},${family.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[var(--brand)] hover:underline"
                  >
                    <MapPin className="size-3.5" /> {t("fam.viewOnMap")}
                  </a>
                ) : null}
              </Row>
              <Row label={t("fam.consentAccepted")}>
                {family.consentAccepted ? t("fam.yes") : t("fam.no")}
              </Row>
              <Row label={t("fam.submittedAt")}>{formatDate(family.submittedAt, lang)}</Row>
              <Row label={t("fam.approvedAt")}>{formatDate(family.approvedAt, lang)}</Row>
              {family.rejectReason && (
                <Row label={t("fam.rejectReason")}>{family.rejectReason}</Row>
              )}
            </tbody>
          </AdminTable>
        </section>

        {/* ── Members ──────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <AdminH3 className="mb-0">
              {t("fam.members")} ({members.length})
            </AdminH3>
          </div>

          {members.length === 0 ? (
            <p className="rounded-2xl border border-[var(--line-admin)] bg-white py-6 text-center text-[13px] text-[var(--faint)]">
              {t("fam.noMembers")}
            </p>
          ) : (
            members.map((m, i) => {
              const col = MEMBER_COLORS[i % MEMBER_COLORS.length];
              const name = pick(m.fullNameEn, m.fullNameGu);
              return (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-2xl border border-[var(--line-admin)] p-4 sm:p-5",
                    m.isDeceased ? "bg-[#F6F4F0]" : "bg-white",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.photoUrl}
                        alt={name}
                        className="size-[38px] shrink-0 rounded-[11px] object-cover"
                      />
                    ) : (
                      <div
                        className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] text-sm font-extrabold"
                        style={{ background: col.bg, color: col.c }}
                      >
                        {name.trim()[0] ?? "?"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-bold text-[var(--ink)]">
                        {m.fullNameEn}
                        {m.fullNameGu ? ` · ${m.fullNameGu}` : ""}
                        {m.isHead && (
                          <span className="ml-1.5 rounded-[7px] bg-[var(--brand-tint)] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[var(--brand)]">
                            {t("fam.head")}
                          </span>
                        )}
                        {passwordLogin && m.hasPassword && (
                          <span className="ml-1.5 rounded-[7px] bg-[var(--success-tint)] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[var(--success)]">
                            {t("fam.holdsLogin")}
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-[var(--faint)]">
                        {m.relation || t("fam.memberFallback")} · {m.mobile || t("fam.noLogin")}
                      </div>
                    </div>
                  </div>

                  <AdminTable className="mt-3">
                    <tbody>
                      <Row label={t("fam.relation")}>{m.relation}</Row>
                      <Row label={t("fam.gender")}>{m.gender}</Row>
                      <Row label={t("fam.mobileNumber")}>{phoneText(m.mobile, m.mobileIso)}</Row>
                      <Row label={t("fam.whatsappNumber")}>
                        {m.hasWhatsApp
                          ? phoneText(m.mobile, m.mobileIso)
                          : phoneText(m.whatsapp, m.whatsappIso)}
                      </Row>
                      <Row label={t("fam.birthDate")}>{formatDate(m.dateOfBirth, lang)}</Row>
                      <Row label={t("fam.bloodGroup")}>{bloodLabel(m.bloodGroup)}</Row>
                      <Row label={t("fam.occupation")}>{m.occupationOther || m.occupation}</Row>
                      <Row label={t("fam.education")}>{m.education}</Row>
                      <Row label={t("fam.course")}>{m.course}</Row>
                      <Row label={t("fam.currentlyAt")}>
                        {m.isNri
                          ? [m.nriCity, m.nriCountry].filter(Boolean).join(", ")
                          : m.currentlyAt}
                      </Row>
                      <Row label={t("fam.showPhone")}>
                        {m.showPhone ? t("fam.yes") : t("fam.no")}
                      </Row>
                    </tbody>
                  </AdminTable>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => patchMember(m, { isVisible: !m.isVisible })}
                      className={cn(
                        "cursor-pointer rounded-[9px] px-[11px] py-1.5 text-[11.5px] font-bold",
                        m.isVisible
                          ? "bg-[var(--success-tint)] text-[var(--success)]"
                          : "bg-[var(--line-soft)] text-[var(--muted)]",
                      )}
                    >
                      {m.isVisible ? t("fam.visible") : t("fam.hidden")}
                    </button>
                    {!m.isHead && (
                      <button
                        type="button"
                        onClick={() => makeHead(m)}
                        className="cursor-pointer rounded-[9px] bg-[var(--brand-tint)] px-[11px] py-1.5 text-[11.5px] font-bold text-[var(--brand)]"
                      >
                        {t("fam.makeHead")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => changeLogin(m)}
                      className="cursor-pointer rounded-[9px] bg-[#EEF1F6] px-[11px] py-1.5 text-[11.5px] font-bold text-[#4A5B72]"
                    >
                      {t("fam.changeLogin")}
                    </button>
                    {passwordLogin && m.mobile && (
                      <button
                        type="button"
                        onClick={() => setPassword(m)}
                        className="cursor-pointer rounded-[9px] bg-[var(--gold-tint)] px-[11px] py-1.5 text-[11.5px] font-bold text-[var(--warn)]"
                      >
                        {m.hasPassword ? t("fam.resetPassword") : t("fam.setPassword")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => patchMember(m, { isDeceased: !m.isDeceased })}
                      className={cn(
                        "cursor-pointer rounded-[9px] px-[11px] py-1.5 text-[11.5px] font-bold",
                        m.isDeceased
                          ? "bg-[var(--ink)] text-white"
                          : "bg-[var(--line-soft)] text-[var(--muted)]",
                      )}
                    >
                      {m.isDeceased ? t("fam.deceased") : t("fam.markDeceased")}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </>
  );
}
