export type AppType = "parivar" | "gam";

export type PlatformApp = {
  id: number;
  nameEn: string;
  nameGu: string;
  logoText: string;
  type: AppType;
  grouping: string;
  sub: string;
  primary: string;
  secondary: string;
  members: number;
  live: boolean;
  adminName?: string;
  adminPhone?: string;
};

export type AppForm = {
  nameEn: string;
  nameGu: string;
  logoText: string;
  type: AppType;
  grouping: string;
  primary: string;
  secondary: string;
  subdomain: string;
  adminName: string;
  adminPhone: string;
  _subTouched?: boolean;
};

export const PRIMARIES = [
  "#A62A38",
  "#1E7A54",
  "#2A5FA0",
  "#7A3DA0",
  "#B0601E",
  "#0E7C86",
] as const;

export const SECONDARIES = [
  "#E8A33D",
  "#E0A62B",
  "#4E9C6B",
  "#C24450",
  "#5865F2",
  "#2A2620",
] as const;

export const INITIAL_APPS: PlatformApp[] = [
  {
    id: 1,
    nameEn: "Shree Saurashtra Patel Samaj",
    nameGu: "\u0AB6\u0ACD\u0AB0\u0AC0 \u0AB8\u0ACC\u0AB0\u0ABE\u0AB7\u0ACD\u0A9F\u0ACD\u0AB0 \u0AAA\u0A9F\u0AC7\u0AB2 \u0AB8\u0AAE\u0ABE\u0A9C",
    logoText: "\u0AB6\u0ACD\u0AB0\u0AC0",
    type: "parivar",
    grouping: "24 Parivar",
    sub: "saurashtra_patel",
    primary: "#A62A38",
    secondary: "#E8A33D",
    members: 734,
    live: true,
  },
  {
    id: 2,
    nameEn: "Mota Zinzuda Gam",
    nameGu: "\u0AAE\u0ACB\u0A9F\u0ABE \u0A9D\u0AC0\u0A82\u0A9D\u0AC1\u0AA1\u0ABE \u0A97\u0ABE\u0AAE",
    logoText: "\u0AAE\u0ACB",
    type: "gam",
    grouping: "32 Gam",
    sub: "mota_zinzuda",
    primary: "#1E7A54",
    secondary: "#E0A62B",
    members: 186,
    live: true,
  },
  {
    id: 3,
    nameEn: "Leva Patel Mandal",
    nameGu: "\u0AB2\u0AC7\u0AB5\u0ABE \u0AAA\u0A9F\u0AC7\u0AB2 \u0AAE\u0A82\u0AA1\u0AB3",
    logoText: "\u0AB2\u0AC7",
    type: "parivar",
    grouping: "12 Parivar",
    sub: "leva_patel",
    primary: "#2A5FA0",
    secondary: "#E8A33D",
    members: 0,
    live: false,
  },
];

export function blankForm(): AppForm {
  return {
    nameEn: "",
    nameGu: "",
    logoText: "",
    type: "parivar",
    grouping: "24 Parivar",
    primary: "#A62A38",
    secondary: "#E8A33D",
    subdomain: "",
    adminName: "",
    adminPhone: "",
  };
}

export function slugify(v: string) {
  return (v || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function tintPrimary(hex: string) {
  try {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const m = (c: number) => Math.round(c + (255 - c) * 0.86);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  } catch {
    return "#FBEDEE";
  }
}
