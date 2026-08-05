/**
 * Roles, menus and role templates shared by the Admins & roles page and its
 * modals. Kept apart from the components so the add/edit/view/reset modals can
 * agree on one source of truth.
 */

export type AdminRow = {
  id: string;
  name: string;
  nameGu: string | null;
  username: string | null;
  mobile: string;
  mobileIso: string;
  family: string | null;
  surname: string | null;
  showPhone: boolean;
  menus: string[];
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
};

export type MemberOption = {
  id: string;
  name: string;
  mobile: string;
  mobileIso: string;
  surname: string;
  family: string;
};

/** Stored roles an admin can hold. ADMIN is a legacy alias kept for display. */
export const ROLE_OPTIONS = [
  { value: "OWNER", label: "Owner" },
  { value: "DATA_MANAGER", label: "Data Manager" },
  { value: "CONTENT_MANAGER", label: "Content Manager" },
  { value: "MODERATOR", label: "Moderator" },
] as const;

export const roleLabel = (r: string) =>
  ROLE_OPTIONS.find((o) => o.value === r)?.label ?? (r === "ADMIN" ? "Community Admin" : r);

/** Sidebar sections an admin can be granted — mirrors Admin.dc.html MENUS(). */
export const ADMIN_MENUS = [
  { key: "dash", label: "Dashboard" },
  { key: "queue", label: "Registration Queue" },
  { key: "families", label: "Families & Members" },
  { key: "drop", label: "Dropdown Lists" },
  { key: "gallery", label: "Gallery" },
  { key: "news", label: "News" },
  { key: "ads", label: "Advertisements" },
  { key: "info", label: "Community Information" },
  { key: "results", label: "Result Drive" },
  { key: "organ", label: "Organ Donation" },
  { key: "admins", label: "Admins & Roles" },
] as const;

export const ALL_MENUS = ADMIN_MENUS.map((m) => m.key);

export const menuLabel = (key: string) =>
  ADMIN_MENUS.find((m) => m.key === key)?.label ?? key;

export type RoleTemplate =
  | "community_admin"
  | "coordinator_head"
  | "content_manager"
  | "gallery_manager"
  | "result_manager"
  | "owner"
  | "custom";

export const ROLE_TEMPLATES: { value: RoleTemplate; label: string }[] = [
  { value: "community_admin", label: "Community Admin" },
  { value: "coordinator_head", label: "Head of Surname Group Coordinators" },
  { value: "content_manager", label: "Content Manager" },
  { value: "gallery_manager", label: "Gallery Manager" },
  { value: "result_manager", label: "Result Manager" },
  { value: "owner", label: "Owner" },
  { value: "custom", label: "Custom" },
];

/** Each template pre-fills the stored roles… */
export const ROLE_TEMPLATE_ROLES: Record<RoleTemplate, string[]> = {
  community_admin: ["ADMIN"],
  coordinator_head: ["MODERATOR"],
  content_manager: ["CONTENT_MANAGER"],
  gallery_manager: ["CONTENT_MANAGER"],
  result_manager: ["DATA_MANAGER"],
  owner: ["OWNER"],
  custom: [],
};

/** …and the menus it can reach (Admin.dc.html rolePerms()). */
export const ROLE_TEMPLATE_MENUS: Record<RoleTemplate, string[]> = {
  community_admin: [...ALL_MENUS],
  owner: [...ALL_MENUS],
  coordinator_head: ["queue", "families"],
  content_manager: ["dash", "news", "ads", "info"],
  gallery_manager: ["dash", "gallery"],
  result_manager: ["dash", "results"],
  custom: [],
};

/** Every stored role some template grants — anything else counts as "Custom". */
const TEMPLATE_ROLES = new Set(Object.values(ROLE_TEMPLATE_ROLES).flat());

/**
 * Match a row against a role-template filter chip.
 *
 * Templates are a UI concept; the row only stores the underlying roles, so
 * templates sharing a role (Gallery Manager and Content Manager are both
 * CONTENT_MANAGER) select the same admins.
 */
export function matchesTemplate(row: AdminRow, t: RoleTemplate): boolean {
  const want = ROLE_TEMPLATE_ROLES[t];
  if (want.length === 0) return !row.roles.some((r) => TEMPLATE_ROLES.has(r));
  return want.every((r) => row.roles.includes(r));
}

/** Best-guess template for an existing admin, used to preselect the Edit chips. */
export function templateOf(row: AdminRow): RoleTemplate {
  const hit = ROLE_TEMPLATES.find((t) => t.value !== "custom" && matchesTemplate(row, t.value));
  return hit?.value ?? "custom";
}

export const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "never";
