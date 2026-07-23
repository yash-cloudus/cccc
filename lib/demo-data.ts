export type Bilingual = { gu: string; en: string };

export function pick(b: Bilingual, lang: "gu" | "en") {
  return lang === "gu" ? b.gu : b.en;
}

export type SurnameGroup = {
  slug: string;
  name: Bilingual;
  count: number;
};

export type FamilyMember = {
  id: string;
  name: Bilingual;
  relation: Bilingual;
  dob?: string;
  blood?: string;
  occupation?: Bilingual;
  mobile?: string;
  hasWhatsapp?: boolean;
  tag?: Bilingual;
  avatarColor: string;
  avatarBg: string;
};

export type Family = {
  id: string;
  surnameSlug: string;
  headName: Bilingual;
  headSub: Bilingual;
  address: Bilingual;
  hal: Bilingual;
  homePhone?: string;
  mobile: string;
  members: FamilyMember[];
  business?: {
    type: Bilingual;
    address: Bilingual;
    phone: string;
  };
};

export type Business = {
  id: string;
  memberName: Bilingual;
  name: Bilingual;
  category: string;
  categoryKey: string;
  logo: string;
  bg: string;
  fg: string;
  phone: string;
  address: Bilingual;
  description: Bilingual;
};

export type NewsItem = {
  id: string;
  title: Bilingual;
  date: Bilingual;
  pinned?: boolean;
  body: Bilingual;
  bg: string;
  fg: string;
};

export type AdBanner = {
  id: string;
  name: string;
  subtitle: Bilingual;
  gradient: string;
  link?: string;
};

export type Album = {
  id: string;
  title: Bilingual;
  subtitle: Bilingual;
  photoCount: number;
  bg: string;
};

export type BloodGroupMember = {
  id: string;
  name: Bilingual;
  blood: string;
  location: Bilingual;
  mobile: string;
};

export type EducationMember = {
  id: string;
  name: Bilingual;
  level: Bilingual;
  institution: Bilingual;
  mobile?: string;
};

export type ResultEntry = {
  id: string;
  childName: Bilingual;
  standard: Bilingual;
  board: Bilingual;
  percentage: string;
  year: string;
};

export type Notification = {
  id: string;
  title: Bilingual;
  body: Bilingual;
  time: Bilingual;
  read?: boolean;
};

export const surnameGroups: SurnameGroup[] = [
  { slug: "savaliya", name: { gu: "સાવલિયા", en: "Savaliya" }, count: 32 },
  { slug: "nasit", name: { gu: "નસીત", en: "Nasit" }, count: 24 },
  { slug: "desai", name: { gu: "દેસાઈ", en: "Desai" }, count: 21 },
  { slug: "gajera", name: { gu: "ગજેરા", en: "Gajera" }, count: 18 },
  { slug: "kakadiya", name: { gu: "કાકડિયા", en: "Kakadiya" }, count: 16 },
  { slug: "ranpariya", name: { gu: "રાણપરીયા", en: "Ranpariya" }, count: 14 },
  { slug: "suhagiya", name: { gu: "સુહાગીયા", en: "Suhagiya" }, count: 12 },
  { slug: "sukhadiya", name: { gu: "સુખડીયા", en: "Sukhadiya" }, count: 11 },
  { slug: "rangholiya", name: { gu: "રંઘોળીયા", en: "Rangholiya" }, count: 9 },
  { slug: "mangroliya", name: { gu: "માંગરોળીયા", en: "Mangroliya" }, count: 8 },
];

export const families: Family[] = [
  {
    id: "f1",
    surnameSlug: "savaliya",
    headName: { gu: "આલ્પેશભાઈ કનુભાઈ", en: "Alpeshbhai Kanubhai" },
    headSub: { gu: "સાવલિયા · સુરત", en: "Savaliya · Surat" },
    address: {
      gu: "રાજ ઈમ્પિરિયલ, ઊંડા કમલ મોલ પાસે, કતારગામ, સુરત",
      en: "Raj Imperial, near Unda Kamal Mall, Katargam, Surat",
    },
    hal: { gu: "સુરત", en: "Surat" },
    homePhone: "0261 245 8890",
    mobile: "9876543210",
    business: {
      type: { gu: "વેપાર — ટેક્સટાઇલ", en: "Trade — Textile" },
      address: { gu: "Ring Road, Surat", en: "Ring Road, Surat" },
      phone: "9876543210",
    },
    members: [
      {
        id: "m1",
        name: { gu: "આલ્પેશભાઈ કનુભાઈ", en: "Alpeshbhai Kanubhai" },
        relation: { gu: "વડા", en: "Head" },
        dob: "1979-02-01",
        blood: "B+",
        occupation: { gu: "વેપાર", en: "Trade" },
        mobile: "9876543210",
        hasWhatsapp: true,
        tag: { gu: "વડા", en: "Head" },
        avatarColor: "#B0303A",
        avatarBg: "#FCE7E7",
      },
      {
        id: "m2",
        name: { gu: "સવિતાબેન આલ્પેશભાઈ", en: "Savitaben Alpeshbhai" },
        relation: { gu: "પત્ની", en: "Wife" },
        dob: "1982-06-08",
        blood: "O+",
        tag: { gu: "પત્ની", en: "Wife" },
        avatarColor: "#6A4E9C",
        avatarBg: "#F0ECFB",
      },
      {
        id: "m3",
        name: { gu: "કવિતા આલ્પેશભાઈ", en: "Kavita Alpeshbhai" },
        relation: { gu: "પુત્રી", en: "Daughter" },
        dob: "2005-06-15",
        blood: "B+",
        occupation: { gu: "વિદ્યાર્થી", en: "Student" },
        tag: { gu: "પુત્રી", en: "Daughter" },
        avatarColor: "#4E7A45",
        avatarBg: "#EAF6EC",
      },
      {
        id: "m4",
        name: { gu: "રાહુલ આલ્પેશભાઈ", en: "Rahul Alpeshbhai" },
        relation: { gu: "પુત્ર", en: "Son" },
        dob: "2011-09-03",
        blood: "B+",
        tag: { gu: "પુત્ર", en: "Son" },
        avatarColor: "#B26A1E",
        avatarBg: "#FEF3E0",
      },
    ],
  },
  {
    id: "f2",
    surnameSlug: "savaliya",
    headName: { gu: "જયેશભાઈ મોહનભાઈ", en: "Jayeshbhai Mohanbhai" },
    headSub: { gu: "સાવલિયા · અમદાવાદ", en: "Savaliya · Ahmedabad" },
    address: {
      gu: "Bopal, Ahmedabad",
      en: "Bopal, Ahmedabad",
    },
    hal: { gu: "અમદાવાદ", en: "Ahmedabad" },
    mobile: "9988776655",
    members: [
      {
        id: "m5",
        name: { gu: "જયેશભાઈ મોહનભાઈ", en: "Jayeshbhai Mohanbhai" },
        relation: { gu: "વડા", en: "Head" },
        blood: "A+",
        mobile: "9988776655",
        hasWhatsapp: true,
        tag: { gu: "વડા", en: "Head" },
        avatarColor: "#B0303A",
        avatarBg: "#FCE7E7",
      },
    ],
  },
  {
    id: "f3",
    surnameSlug: "nasit",
    headName: { gu: "રમેશભાઈ હરેશભાઈ", en: "Rameshbhai Hareshbhai" },
    headSub: { gu: "નસીત · સુરત", en: "Nasit · Surat" },
    address: { gu: "Adajan, Surat", en: "Adajan, Surat" },
    hal: { gu: "સુરત", en: "Surat" },
    mobile: "9123456780",
    members: [
      {
        id: "m6",
        name: { gu: "રમેશભાઈ હરેશભાઈ", en: "Rameshbhai Hareshbhai" },
        relation: { gu: "વડા", en: "Head" },
        blood: "O+",
        mobile: "9123456780",
        tag: { gu: "વડા", en: "Head" },
        avatarColor: "#B0303A",
        avatarBg: "#FCE7E7",
      },
    ],
  },
];

export const businesses: Business[] = [
  {
    id: "b1",
    memberName: { gu: "આલ્પેશભાઈ સાવલિયા", en: "Alpeshbhai Savaliya" },
    name: { gu: "Patel Jewellers", en: "Patel Jewellers" },
    category: "Jewellery",
    categoryKey: "jewellery",
    logo: "PJ",
    bg: "#FCE7E7",
    fg: "#B0303A",
    phone: "9876543210",
    address: { gu: "Ring Road, Surat", en: "Ring Road, Surat" },
    description: {
      gu: "સોનું, ચાંદી અને ડાયમંડ જ્વેલરી",
      en: "Gold, silver and diamond jewellery",
    },
  },
  {
    id: "b2",
    memberName: { gu: "વિજયભાઈ દેસાઈ", en: "Vijaybhai Desai" },
    name: { gu: "Shivam Motors", en: "Shivam Motors" },
    category: "Automobile",
    categoryKey: "automobile",
    logo: "SM",
    bg: "#E7F0FB",
    fg: "#3D6B8C",
    phone: "9898989898",
    address: { gu: "Varachha, Surat", en: "Varachha, Surat" },
    description: {
      gu: "નવી બાઇક અને સ્કૂટર ડીલર",
      en: "New bike and scooter dealer",
    },
  },
  {
    id: "b3",
    memberName: { gu: "સુનીલભાઈ ગજેરા", en: "Sunilbhai Gajera" },
    name: { gu: "Annapurna Farsan", en: "Annapurna Farsan" },
    category: "Food",
    categoryKey: "food",
    logo: "AF",
    bg: "#FEF3E0",
    fg: "#B26A1E",
    phone: "9765432100",
    address: { gu: "Katargam, Surat", en: "Katargam, Surat" },
    description: {
      gu: "તાજું ફરસાણ · ઓર્ડર પર ડિલિવરી",
      en: "Fresh farsan · home delivery on orders",
    },
  },
  {
    id: "b4",
    memberName: { gu: "હિતેશભાઈ નસીત", en: "Hiteshbhai Nasit" },
    name: { gu: "Nasit Textiles", en: "Nasit Textiles" },
    category: "Textile",
    categoryKey: "textile",
    logo: "NT",
    bg: "#EAF6EC",
    fg: "#4E7A45",
    phone: "9012345678",
    address: { gu: "Udhna, Surat", en: "Udhna, Surat" },
    description: {
      gu: "કપડા અને ફેબ્રિક વેપાર",
      en: "Fabric and cloth trading",
    },
  },
  {
    id: "b5",
    memberName: { gu: "પ્રakash Kakadiya", en: "Prakash Kakadiya" },
    name: { gu: "Kakadiya Clinic", en: "Kakadiya Clinic" },
    category: "Medical",
    categoryKey: "medical",
    logo: "KC",
    bg: "#F0ECFB",
    fg: "#6A4E9C",
    phone: "9825123456",
    address: { gu: "Adajan, Surat", en: "Adajan, Surat" },
    description: {
      gu: "જનરલ ફિઝિશિયન ક્લિનિક",
      en: "General physician clinic",
    },
  },
];

export const businessCategories = [
  { key: "all", label: { gu: "બધા", en: "All" } },
  { key: "jewellery", label: { gu: "Jewellery", en: "Jewellery" } },
  { key: "automobile", label: { gu: "Automobile", en: "Automobile" } },
  { key: "food", label: { gu: "Food", en: "Food" } },
  { key: "textile", label: { gu: "Textile", en: "Textile" } },
  { key: "medical", label: { gu: "Medical", en: "Medical" } },
];

export const newsItems: NewsItem[] = [
  {
    id: "n1",
    title: {
      gu: "પાટોત્સવ તા. 15 ના રોજ ઉજવાશે",
      en: "Patotsav to be celebrated on the 15th",
    },
    date: { gu: "2 જુલાઈ 2026", en: "2 July 2026" },
    pinned: true,
    body: {
      gu: "શ્રી સૌરાષ્ટ્ર પટેલ સમાજનો વાર્ષિક પાટોત્સવ 15 જુલાઈ 2026 ના રોજ સવારે 8:00 વાગ્યે યોજાશે. સભ્યોને સહરભર હાજરી આપવા વિનંતી.",
      en: "The annual Patotsav of Shree Saurashtra Patel Samaj will be held on 15 July 2026 at 8:00 AM. All members are requested to attend.",
    },
    bg: "linear-gradient(150deg,#8E2230,#B24C3B)",
    fg: "#fff",
  },
  {
    id: "n2",
    title: {
      gu: "વાર્ષિક સ્નેહમિલન — નોંધણી શરૂ",
      en: "Annual Snehmilan — registration open",
    },
    date: { gu: "28 જૂન 2026", en: "28 June 2026" },
    body: {
      gu: "વાર્ષિક સ્નેહમિલન માટે નોંધણી શરૂ થઈ ગઈ છે. ઓનલાઇન ફોર્મ ભરો અથવા સંભાળનારનો સંપર્ક કરો.",
      en: "Registration for the annual Snehmilan has opened. Fill the online form or contact your coordinator.",
    },
    bg: "linear-gradient(150deg,#1F4C6B,#3D7BA0)",
    fg: "#fff",
  },
  {
    id: "n3",
    title: {
      gu: "નવા સભ્યો માટે ઓરિએન્ટેશન",
      en: "Orientation for new members",
    },
    date: { gu: "10 જૂન 2026", en: "10 June 2026" },
    body: {
      gu: "નવા નોંધાયેલા પરિવારો માટે એપ ઓરિએન્ટેશન સessions યોજાશે.",
      en: "App orientation sessions will be held for newly registered families.",
    },
    bg: "linear-gradient(150deg,#4E7A45,#6BA85E)",
    fg: "#fff",
  },
  {
    id: "n4",
    title: {
      gu: "રક્તદાન camp — 20 જુલાઈ",
      en: "Blood donation camp — 20 July",
    },
    date: { gu: "5 જૂન 2026", en: "5 June 2026" },
    body: {
      gu: "20 જુલાઈ 2026 ના રોજ સમાજ ભવનમાં રક્તદાન camp યોજાશે.",
      en: "A blood donation camp will be held at Samaj Bhavan on 20 July 2026.",
    },
    bg: "linear-gradient(150deg,#B15A16,#E09A3A)",
    fg: "#fff",
  },
];

export const adBanners: AdBanner[] = [
  {
    id: "a1",
    name: "Patel Jewellers",
    subtitle: {
      gu: "તહેવાર પર 100% ઘડામણ મુક્ત",
      en: "100% making charges free this festive season",
    },
    gradient: "linear-gradient(120deg,#7A2E5C,#B0417E)",
    link: "/business/b1",
  },
  {
    id: "a2",
    name: "Shivam Motors",
    subtitle: {
      gu: "નવી બાઇક પર ખાસ સમાજ ડિસ્કાઉન્ટ",
      en: "Special Samaj discount on new bikes",
    },
    gradient: "linear-gradient(120deg,#1F4C6B,#3D7BA0)",
    link: "/business/b2",
  },
  {
    id: "a3",
    name: "Annapurna Farsan",
    subtitle: {
      gu: "તાજું ફરસાણ · ઓર્ડર પર ડિલિવરી",
      en: "Fresh farsan · home delivery on orders",
    },
    gradient: "linear-gradient(120deg,#B15A16,#E09A3A)",
    link: "/business/b3",
  },
];

export const albums: Album[] = [
  {
    id: "al1",
    title: { gu: "પાટોત્સવ 2025", en: "Patotsav 2025" },
    subtitle: { gu: "48 ફોટો", en: "48 photos" },
    photoCount: 48,
    bg: "linear-gradient(135deg,#8E2230,#B24C3B)",
  },
  {
    id: "al2",
    title: { gu: "સ્નેહમિલન 2024", en: "Snehmilan 2024" },
    subtitle: { gu: "32 ફોટો", en: "32 photos" },
    photoCount: 32,
    bg: "linear-gradient(135deg,#1F4C6B,#3D7BA0)",
  },
  {
    id: "al3",
    title: { gu: "યુવા કાર્યક્રમ", en: "Youth event" },
    subtitle: { gu: "24 ફોટો", en: "24 photos" },
    photoCount: 24,
    bg: "linear-gradient(135deg,#4E7A45,#6BA85E)",
  },
  {
    id: "al4",
    title: { gu: "રક્તદાન camp", en: "Blood donation camp" },
    subtitle: { gu: "18 ફોટો", en: "18 photos" },
    photoCount: 18,
    bg: "linear-gradient(135deg,#B15A16,#E09A3A)",
  },
];

export const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export const bloodGroupMembers: Record<string, BloodGroupMember[]> = {
  "B+": [
    {
      id: "bg1",
      name: { gu: "આલ્પેશભાઈ કનુભાઈ", en: "Alpeshbhai Kanubhai" },
      blood: "B+",
      location: { gu: "સુરત", en: "Surat" },
      mobile: "9876543210",
    },
    {
      id: "bg2",
      name: { gu: "કવિતા આલ્પેશભાઈ", en: "Kavita Alpeshbhai" },
      blood: "B+",
      location: { gu: "સુરત", en: "Surat" },
      mobile: "9876543210",
    },
  ],
  "O+": [
    {
      id: "bg3",
      name: { gu: "સવિતાબેન આલ્પેશભાઈ", en: "Savitaben Alpeshbhai" },
      blood: "O+",
      location: { gu: "સુરત", en: "Surat" },
      mobile: "9876543210",
    },
    {
      id: "bg4",
      name: { gu: "રમેશભાઈ હરેશભાઈ", en: "Rameshbhai Hareshbhai" },
      blood: "O+",
      location: { gu: "સુરત", en: "Surat" },
      mobile: "9123456780",
    },
  ],
  "A+": [
    {
      id: "bg5",
      name: { gu: "જયેશભાઈ મોહનભાઈ", en: "Jayeshbhai Mohanbhai" },
      blood: "A+",
      location: { gu: "અમદાવાદ", en: "Ahmedabad" },
      mobile: "9988776655",
    },
  ],
};

export const educationMembers: EducationMember[] = [
  {
    id: "e1",
    name: { gu: "કવિતા આલ્પેશભાઈ", en: "Kavita Alpeshbhai" },
    level: { gu: "B.Com — 2nd year", en: "B.Com — 2nd year" },
    institution: { gu: "VNSGU, Surat", en: "VNSGU, Surat" },
  },
  {
    id: "e2",
    name: { gu: "રાહુલ આલ્પેશભાઈ", en: "Rahul Alpeshbhai" },
    level: { gu: "ધોરણ 10", en: "Std 10" },
    institution: { gu: "Delhi Public School", en: "Delhi Public School" },
  },
  {
    id: "e3",
    name: { gu: "પ્રિયા દેસાઈ", en: "Priya Desai" },
    level: { gu: "MBBS — 3rd year", en: "MBBS — 3rd year" },
    institution: { gu: "Government Medical College", en: "Government Medical College" },
  },
];

export const results: ResultEntry[] = [
  {
    id: "r1",
    childName: { gu: "રાહુલ આલ્પેશભાઈ", en: "Rahul Alpeshbhai" },
    standard: { gu: "ધોરણ 10", en: "Std 10" },
    board: { gu: "GSEB", en: "GSEB" },
    percentage: "89.4%",
    year: "2026",
  },
  {
    id: "r2",
    childName: { gu: "પ્રિયા દેસાઈ", en: "Priya Desai" },
    standard: { gu: "ધોરણ 12", en: "Std 12" },
    board: { gu: "GSEB", en: "GSEB" },
    percentage: "92.1%",
    year: "2026",
  },
];

export const notifications: Notification[] = [
  {
    id: "nt1",
    title: { gu: "પાટોત્સવ 15 જુલાઈ", en: "Patotsav on 15 July" },
    body: {
      gu: "વાર્ષિક પાટોત્સવ માટે હાજરી આપવા વિનંતી.",
      en: "Please attend the annual Patotsav.",
    },
    time: { gu: "2 કલાક પહેલાં", en: "2 hours ago" },
  },
  {
    id: "nt2",
    title: { gu: "નવો સમાચાર પિન કર્યો", en: "New pinned news" },
    body: {
      gu: "પાટોત્સવ સંબંધિત સમાચાર જુઓ.",
      en: "See Patotsav related news.",
    },
    time: { gu: "1 દિવસ પહેલાં", en: "1 day ago" },
    read: true,
  },
];

export const currentUser = {
  name: { gu: "આલ્પેશભાઈ કનુભાઈ", en: "Alpeshbhai Kanubhai" },
  role: { gu: "સભ્ય · સાવલિયા", en: "Member · Savaliya" },
  mobile: "9876543210",
  blood: "B+",
  dob: "1979-02-01",
  occupation: { gu: "વેપાર", en: "Trade" },
  familyId: "f1",
};

export const aboutContent = {
  title: { gu: "શ્રી સૌરાષ્ટ્ર પટેલ સમાજ", en: "Shree Saurashtra Patel Samaj" },
  body: {
    gu: "શ્રી સૌરાષ્ટ્ર પટેલ સમાજ એક નોંધાયેલ સામાજિક સંસ્થા છે જે સૌરાષ્ટ્રના પટેલ સમાજના પરિવારોને જોડે છે. અમારું ધ્યેય સભ્યો વચ્ચે સંપર્ક, સહાય અને સાંસ્કૃતિક એકતા જાળવવાનું છે.",
    en: "Shree Saurashtra Patel Samaj is a registered community organisation connecting Patel families from Saurashtra. Our aim is to maintain contact, support and cultural unity among members.",
  },
  address: {
    gu: "સમાજ ભવન, Ring Road, Surat, Gujarat",
    en: "Samaj Bhavan, Ring Road, Surat, Gujarat",
  },
  phone: "0261 245 8890",
  email: "info@saurashtrapatel.org",
};

export const donationInfo = {
  title: { gu: "દાન / યોગદાન", en: "Donation / Contribution" },
  body: {
    gu: "સમાજની ગતિવિધિઓ અને સેવાઓ માટે તમારું યોગદાન સ્વાગતયોગ્ય છે. UPI થી QR સ્કેન કરી ચૂકવણી કરો.",
    en: "Your contribution towards community activities and services is welcome. Scan the QR code to pay via UPI.",
  },
  upiId: "saurashtrapatel@upi",
  amountSuggestions: [501, 1100, 2100, 5100],
};

export function getSurnameBySlug(slug: string) {
  return surnameGroups.find((s) => s.slug === slug);
}

export function getFamiliesBySurname(slug: string) {
  return families.filter((f) => f.surnameSlug === slug);
}

export function getFamilyById(id: string) {
  return families.find((f) => f.id === id);
}

export function getBusinessById(id: string) {
  return businesses.find((b) => b.id === id);
}

export function getNewsById(id: string) {
  return newsItems.find((n) => n.id === id);
}

export function formatMobile(mobile: string) {
  const d = mobile.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
  return mobile;
}

export function waLink(mobile: string) {
  const d = mobile.replace(/\D/g, "");
  return `https://wa.me/91${d}`;
}

export function telLink(mobile: string) {
  const d = mobile.replace(/\D/g, "");
  return `tel:+91${d}`;
}
