export type RegStatus = "pending" | "approved" | "rejected";

export interface QueueFamily {
  id: number;
  head: string;
  surname: string;
  city: string;
  members: number;
  submitted: string;
  status: RegStatus;
}

export interface ReviewMember {
  id: number;
  nameEn: string;
  nameGu: string;
  rel: string;
  phone: string;
  dob: string;
  blood: string;
  occ: string;
  edu: string;
}

export interface ReviewFamily {
  id: number;
  head: string;
  headGu: string;
  surnameEn: string;
  surname: string;
  addressEn: string;
  address: string;
  business: string;
  elder: string;
  elderPhone: string;
  city: string;
  members: ReviewMember[];
}

export interface FamilyRow {
  id: string;
  head: string;
  surname: string;
  city: string;
  members: number;
}

export interface FamilyMember {
  id: number;
  n: string;
  rel: string;
  phone: string;
  head: boolean;
  visible: boolean;
  deceased: boolean;
}

export interface Village {
  id: number;
  nameGu: string;
  nameEn: string;
  families: number;
  show: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  roles: string[];
  groups: string[];
}

export interface CoordinatorAssignment {
  group: string;
  adminId: string;
  showContact: boolean;
}

export const DASHBOARD_STATS = {
  families: 182,
  members: 734,
  pending: 3,
  activeAds: 4,
} as const;

export const RESULT_DRIVE = {
  title: "પરિણામ 2026",
  status: "Open" as const,
  standards: [
    { standard: "ધોરણ 10", entries: 18, reviewed: 12 },
    { standard: "ધોરણ 12", entries: 9, reviewed: 3 },
  ],
} as const;

export const AD_PERFORMANCE = [
  { ad: "Real Peprika", views: 412, clicks: 36 },
  { ad: "Gajera Jewellers", views: 390, clicks: 21 },
] as const;

export const QUEUE_FAMILIES: QueueFamily[] = [
  { id: 1, head: "આલ્પેશભાઈ કનુભાઈ", surname: "સાવલિયા", city: "સુરત", members: 4, submitted: "Today 10:12", status: "pending" },
  { id: 2, head: "રમેશભાઈ ગોરધનભાઈ", surname: "નસીત", city: "રાજકોટ", members: 6, submitted: "Today 10:05", status: "pending" },
  { id: 3, head: "જયેશભાઈ મોહનભાઈ", surname: "દેસાઈ", city: "સુરત", members: 3, submitted: "Yesterday", status: "pending" },
  { id: 4, head: "કિરીટભાઈ ધીરુભાઈ", surname: "ગજેરા", city: "અમદાવાદ", members: 5, submitted: "Yesterday", status: "approved" },
  { id: 5, head: "મનસુખભાઈ વલ્લભભાઈ", surname: "કાકડિયા", city: "રાજકોટ", members: 2, submitted: "2 days ago", status: "pending" },
  { id: 6, head: "(અધૂરું ફોર્મ)", surname: "—", city: "—", members: 1, submitted: "2 days ago", status: "rejected" },
];

export const REVIEW_BY_ID: Record<number, ReviewFamily> = {
  1: {
    id: 1,
    head: "Alpeshbhai Kanubhai",
    headGu: "આલ્પેશભાઈ કનુભાઈ",
    surnameEn: "Savaliya",
    surname: "સાવલિયા",
    addressEn: "Raj Imperial, Katargam, Surat",
    address: "રાજ ઈમ્પિરિયલ, કતારગામ, સુરત",
    business: "વેપાર — કાપડ, ઊંડા કમલ મોલ",
    elder: "કનુભાઈ કાનજીભાઈ",
    elderPhone: "99889 98822",
    city: "સુરત",
    members: [
      { id: 1, nameEn: "Alpeshbhai Kanubhai", nameGu: "આલ્પેશભાઈ કનુભાઈ", rel: "Head", phone: "98765 43210", dob: "1979-02-01", blood: "B+", occ: "વેપાર", edu: "B.COM" },
      { id: 2, nameEn: "Savitaben Alpeshbhai", nameGu: "સવિતાબેન આલ્પેશભાઈ", rel: "પત્ની", phone: "", dob: "1982-06-08", blood: "O+", occ: "ગૃહિણી", edu: "" },
      { id: 3, nameEn: "Kavita Alpeshbhai", nameGu: "કવિતા આલ્પેશભાઈ", rel: "પુત્રી", phone: "91234 56780", dob: "2005-06-15", blood: "B+", occ: "વિદ્યાર્થી", edu: "B.Sc" },
      { id: 4, nameEn: "Rahul Alpeshbhai", nameGu: "રાહુલ આલ્પેશભાઈ", rel: "પુત્ર", phone: "", dob: "2011-09-03", blood: "B+", occ: "વિદ્યાર્થી", edu: "ધોરણ 9" },
    ],
  },
  2: {
    id: 2,
    head: "Rameshbhai Gordhanbhai",
    headGu: "રમેશભાઈ ગોરધનભાઈ",
    surnameEn: "Nasit",
    surname: "નસીત",
    addressEn: "Rajkot",
    address: "રાજકોટ",
    business: "નોકરી",
    elder: "ગોરધનભાઈ",
    elderPhone: "98765 11111",
    city: "રાજકોટ",
    members: [
      { id: 1, nameEn: "Rameshbhai Gordhanbhai", nameGu: "રમેશભાઈ ગોરધનભાઈ", rel: "Head", phone: "98765 11111", dob: "1975-03-10", blood: "A+", occ: "નોકરી", edu: "B.COM" },
    ],
  },
  3: {
    id: 3,
    head: "Jayshbhai Mohanbhai",
    headGu: "જયેશભાઈ મોહનભાઈ",
    surnameEn: "Desai",
    surname: "દેસાઈ",
    addressEn: "Surat",
    address: "સુરત",
    business: "વેપાર",
    elder: "મોહનભાઈ",
    elderPhone: "98765 22222",
    city: "સુરત",
    members: [
      { id: 1, nameEn: "Jayshbhai Mohanbhai", nameGu: "જયેશભાઈ મોહનભાઈ", rel: "Head", phone: "98765 22222", dob: "1980-01-15", blood: "O+", occ: "વેપાર", edu: "C.A." },
    ],
  },
};

export const APPROVE_MEMBERS = [
  { n: "આલ્પેશભાઈ કનુભાઈ", rel: "Head", phone: "98765 43210 ✓", c: "#B0303A", bg: "#FCE7E7" },
  { n: "સવિતાબેન આલ્પેશભાઈ", rel: "પત્ની", phone: "— (no login)", c: "#6A4E9C", bg: "#F0ECFB" },
  { n: "કવિતા આલ્પેશભાઈ", rel: "પુત્રી", phone: "91234 56780 ✓", c: "#4E7A45", bg: "#EAF6EC" },
  { n: "રાહુલ આલ્પેશભાઈ", rel: "પુત્ર", phone: "— (minor)", c: "#B26A1E", bg: "#FEF3E0" },
];

export const FAMILY_LIST: FamilyRow[] = [
  { id: "f1", head: "આલ્પેશભાઈ કનુભાઈ", surname: "સાવલિયા", city: "સુરત", members: 4 },
  { id: "f2", head: "કનુભાઈ પાંચાભાઈ", surname: "સાવલિયા", city: "સુરત", members: 6 },
  { id: "f3", head: "રમેશભાઈ ગોરધનભાઈ", surname: "નસીત", city: "રાજકોટ", members: 5 },
];

export const FAMILY_MEMBERS: Record<string, FamilyMember[]> = {
  f1: [
    { id: 1, n: "આલ્પેશભાઈ કનુભાઈ", rel: "વડા", phone: "98765 43210", head: true, visible: true, deceased: false },
    { id: 2, n: "સવિતાબેન આલ્પેશભાઈ", rel: "પત્ની", phone: "— (no login)", head: false, visible: true, deceased: false },
    { id: 3, n: "કવિતા આલ્પેશભાઈ", rel: "પુત્રી", phone: "91234 56780", head: false, visible: true, deceased: false },
    { id: 4, n: "રાહુલ આલ્પેશભાઈ", rel: "પુત્ર", phone: "— (minor)", head: false, visible: false, deceased: false },
  ],
  f2: [
    { id: 1, n: "કનુભાઈ પાંચાભાઈ", rel: "વડા", phone: "98765 00001", head: true, visible: true, deceased: false },
  ],
  f3: [
    { id: 1, n: "રમેશભાઈ ગોરધનભાઈ", rel: "વડા", phone: "98765 11111", head: true, visible: true, deceased: false },
  ],
};

export const SURNAME_GROUPS = [
  { en: "Savaliya", gu: "સાવલિયા", flagged: false },
  { en: "Nasit", gu: "નસીત", flagged: false },
  { en: "Desai", gu: "દેસાઈ", flagged: true },
];

export const DEGREES = [
  { en: "B.COM", gu: "બી.કોમ" },
  { en: "C.A.", gu: "સી.એ." },
];

export const OCCUPATIONS = [
  { en: "Vepar", gu: "વેપાર" },
  { en: "Nokri", gu: "નોકરી" },
  { en: "Kheti", gu: "ખેતી" },
];

export const GALLERY_ALBUMS = [
  { title: "પાટોત્સવ 2026", date: "15 Jun 2026", photos: 48 },
  { title: "રક્તદાન કેમ્પ", date: "02 May 2026", photos: 26 },
];

export const NEWS_POSTS = [
  { title: "પાટોત્સવ તા. 15 ના રોજ", date: "2 Jul", extras: "📌 · 📷 · 📄 · 🔗", notify: "sent" as const },
  { title: "નવી કારોબારી જાહેર", date: "28 Jun", extras: "🔗 external", notify: null },
];

export const ADS_LIST = [
  { name: "Real Peprika", start: "1 Jun", end: "31 Aug", status: "Active" as const, priority: 1, views: 412, clicks: 36 },
  { name: "Gajera Jewellers", start: "15 Jun", end: "15 Sep", status: "Active" as const, priority: 2, views: 390, clicks: 21 },
  { name: "Desai Travels", start: "1 Mar", end: "31 May", status: "Expired" as const, priority: null, views: 1204, clicks: 88 },
];

export const COMMITTEES = [
  { name: "મુખ્ય સમિતિ", members: 7 },
  { name: "ભંડોળ સમિતિ", members: 4 },
];

export const INFO_PAGES = ["સમિતિનો હેતુ", "સમાજના નિયમો"];

export const VILLAGES: Village[] = [
  { id: 1, nameGu: "સુરત", nameEn: "Surat", families: 112, show: true },
  { id: 2, nameGu: "રાજકોટ", nameEn: "Rajkot", families: 38, show: true },
  { id: 3, nameGu: "અમદાવાદ", nameEn: "Ahmedabad", families: 21, show: false },
  { id: 4, nameGu: "મોટા ઝીંઝુડા", nameEn: "Mota Zinzuda", families: 11, show: false },
];

export const RESULT_REVIEW = {
  student: "કવિતા આલ્પેશભાઈ સાવલિયા",
  school: "સરસ્વતી વિદ્યાલય",
  standard: "ધોરણ 10",
  remaining: 6,
  totalMarks: 600,
  obtainedMarks: 521,
  percentage: 86.8,
};

export const ADMIN_USERS: AdminUser[] = [
  { id: "a1", name: "આલ્પેશભાઈ કનુભાઈ", roles: ["Owner"], groups: ["દેસાઈ જૂથ"] },
  { id: "a2", name: "જયેશભાઈ મોહનભાઈ", roles: ["Data Manager", "Content Manager"], groups: ["સાવલિયા જૂથ"] },
  { id: "a3", name: "કિરણબેન રમેશભાઈ", roles: ["Content Manager"], groups: ["નસીત જૂથ"] },
];

export const COORDINATOR_ASSIGNMENTS: CoordinatorAssignment[] = [
  { group: "સાવલિયા જૂથ", adminId: "a2", showContact: true },
  { group: "નસીત જૂથ", adminId: "a3", showContact: true },
  { group: "દેસાઈ જૂથ", adminId: "a1", showContact: false },
];

export const ADMIN_ROLES = ["Owner", "Data Manager", "Content Manager", "Moderator"] as const;

export const QUEUE_CITIES = ["all", "સુરત", "રાજકોટ", "અમદાવાદ"] as const;

export const BLOOD_OPTIONS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

export function getPendingCount(families: QueueFamily[] = QUEUE_FAMILIES) {
  return families.filter((f) => f.status === "pending").length;
}
