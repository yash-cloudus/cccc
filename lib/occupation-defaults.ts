import type { Prisma } from "@prisma/client";

/** One node in the default occupation master tree. */
export type OccupationSeedNode = {
  nameEn: string;
  nameGu: string;
  sortOrder?: number;
  children?: OccupationSeedNode[];
};

/** Default streams for Std 11 / Std 12. */
export const DEFAULT_STREAMS = [
  { nameEn: "Science", nameGu: "વિજ્ઞાન", sortOrder: 1 },
  { nameEn: "Commerce", nameGu: "વાણિજ્ય", sortOrder: 2 },
  { nameEn: "Arts", nameGu: "કલા", sortOrder: 3 },
] as const;

/** Default diploma fields. */
export const DEFAULT_DIPLOMA_FIELDS = [
  { nameEn: "IT", nameGu: "આઈટી", sortOrder: 1 },
  { nameEn: "EC", nameGu: "ઈસી", sortOrder: 2 },
  { nameEn: "Mechanical", nameGu: "મિકેનિકલ", sortOrder: 3 },
  { nameEn: "Civil", nameGu: "સિવિલ", sortOrder: 4 },
  { nameEn: "Electrical", nameGu: "ઇલેક્ટ્રિકલ", sortOrder: 5 },
  { nameEn: "Computer", nameGu: "કમ્પ્યુટર", sortOrder: 6 },
] as const;

const STREAMS: OccupationSeedNode[] = DEFAULT_STREAMS.map((s) => ({ ...s }));

const DIPLOMA_FIELDS: OccupationSeedNode[] = DEFAULT_DIPLOMA_FIELDS.map((s) => ({ ...s }));

const EDUCATION_LEVELS: OccupationSeedNode[] = [
  { nameEn: "Balmandir", nameGu: "બાલમંદિર", sortOrder: 1 },
  { nameEn: "Junior", nameGu: "જુનિયર", sortOrder: 2 },
  { nameEn: "Senior", nameGu: "સિનિયર", sortOrder: 3 },
  ...Array.from({ length: 12 }, (_, i) => ({
    nameEn: `Std ${i + 1}`,
    nameGu: `ધોરણ ${i + 1}`,
    sortOrder: 10 + i,
    children: i + 1 === 11 || i + 1 === 12 ? STREAMS : undefined,
  })),
  { nameEn: "College", nameGu: "કોલેજ", sortOrder: 30 },
  {
    nameEn: "Diploma",
    nameGu: "ડિપ્લોમા",
    sortOrder: 31,
    children: DIPLOMA_FIELDS,
  },
];

const VEPAR_SUBS: OccupationSeedNode[] = [
  { nameEn: "Textiles", nameGu: "કાપડ", sortOrder: 1 },
  { nameEn: "Grocery", nameGu: "કરિયાણું", sortOrder: 2 },
  { nameEn: "Jewellery", nameGu: "ઝવેરાત", sortOrder: 3 },
  { nameEn: "Travel", nameGu: "ટ્રાવેલ્સ", sortOrder: 4 },
  { nameEn: "Real Estate", nameGu: "રિયલ એસ્ટેટ", sortOrder: 5 },
  { nameEn: "Food & Restaurant", nameGu: "ખાણ-પીણ", sortOrder: 6 },
  { nameEn: "Automobile", nameGu: "ઓટોમોબાઇલ", sortOrder: 7 },
];

const NOKRI_SUBS: OccupationSeedNode[] = [
  { nameEn: "Teacher", nameGu: "શિક્ષક", sortOrder: 1 },
  { nameEn: "Engineer", nameGu: "એન્જિનિયર", sortOrder: 2 },
  { nameEn: "Doctor", nameGu: "ડૉક્ટર", sortOrder: 3 },
  { nameEn: "Clerk", nameGu: "ક્લાર્ક", sortOrder: 4 },
  { nameEn: "Software Engineer", nameGu: "સોફ્ટવેર એન્જિનિયર", sortOrder: 5 },
  { nameEn: "Accountant", nameGu: "એકાઉન્ટન્ટ", sortOrder: 6 },
  { nameEn: "Nurse", nameGu: "નર્સ", sortOrder: 7 },
];

/** Default root occupations + nested sub-categories for every new community. */
export const DEFAULT_OCCUPATION_TREE: OccupationSeedNode[] = [
  {
    nameEn: "Vepar (Business)",
    nameGu: "વેપાર",
    sortOrder: 1,
    children: VEPAR_SUBS,
  },
  {
    nameEn: "Nokri (Job)",
    nameGu: "નોકરી",
    sortOrder: 2,
    children: NOKRI_SUBS,
  },
  {
    nameEn: "Kheti (Farming)",
    nameGu: "ખેતી",
    sortOrder: 3,
  },
  {
    nameEn: "Student",
    nameGu: "વિદ્યાર્થી",
    sortOrder: 4,
    children: EDUCATION_LEVELS,
  },
  {
    nameEn: "Homemaker",
    nameGu: "ગૃહિણી",
    sortOrder: 5,
  },
];

export function isStudentOccupation(nameEn: string, nameGu?: string) {
  return /student|વિદ્યાર્થી/i.test(`${nameEn} ${nameGu ?? ""}`);
}

export function isVeparOccupation(nameEn: string, nameGu?: string) {
  return /vepar|business|trade|વેપાર/i.test(`${nameEn} ${nameGu ?? ""}`);
}

export function isNokriOccupation(nameEn: string, nameGu?: string) {
  return (
    /nokri|job|નોકરી/i.test(`${nameEn} ${nameGu ?? ""}`) &&
    !isVeparOccupation(nameEn, nameGu)
  );
}

export function isStreamLevel(nameEn: string) {
  return /^std\s*1[12]$/i.test(nameEn.trim());
}

export function isDiplomaLevel(nameEn: string) {
  return /diploma|ડિપ્લોમ/i.test(nameEn);
}

type Tx = Prisma.TransactionClient | typeof import("@/lib/prisma").prisma;

async function seedNode(
  tx: Tx,
  communityId: string,
  node: OccupationSeedNode,
  parentId: string | null,
) {
  let row = await tx.dropdownOption.findFirst({
    where: {
      communityId,
      type: "occupation",
      parentId,
      nameEn: node.nameEn,
    },
  });
  if (!row) {
    row = await tx.dropdownOption.create({
      data: {
        communityId,
        type: "occupation",
        parentId,
        nameEn: node.nameEn,
        nameGu: node.nameGu,
        sortOrder: node.sortOrder ?? 0,
        isActive: true,
      },
    });
  }
  for (const child of node.children ?? []) {
    await seedNode(tx, communityId, child, row.id);
  }
}

/** Seed the full occupation tree for a community (idempotent). */
export async function seedOccupationDefaults(tx: Tx, communityId: string) {
  for (const root of DEFAULT_OCCUPATION_TREE) {
    await seedNode(tx, communityId, root, null);
  }
}

export type OccupationTreeNode = {
  id: string;
  nameEn: string;
  nameGu: string;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null;
  children: OccupationTreeNode[];
};

/** Build a nested tree from flat DropdownOption rows. */
export function buildOccupationTree(
  rows: {
    id: string;
    nameEn: string;
    nameGu: string;
    isActive: boolean;
    sortOrder: number;
    parentId: string | null;
  }[],
): OccupationTreeNode[] {
  const byParent = new Map<string | null, typeof rows>();
  for (const r of rows) {
    const key = r.parentId;
    const list = byParent.get(key) ?? [];
    list.push(r);
    byParent.set(key, list);
  }
  const sort = (a: (typeof rows)[0], b: (typeof rows)[0]) =>
    a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn);

  function walk(parentId: string | null): OccupationTreeNode[] {
    return (byParent.get(parentId) ?? [])
      .sort(sort)
      .map((r) => ({
        id: r.id,
        nameEn: r.nameEn,
        nameGu: r.nameGu,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
        parentId: r.parentId,
        children: walk(r.id),
      }));
  }
  return walk(null);
}

/** Find any node in the tree by id. */
export function findOccupationNodeById(
  tree: OccupationTreeNode[],
  id: string,
): OccupationTreeNode | undefined {
  for (const n of tree) {
    if (n.id === id) return n;
    const child = findOccupationNodeById(n.children, id);
    if (child) return child;
  }
  return undefined;
}

/** Find any node in the tree by stored En/Gu label. */
export function findOccupationNode(
  tree: OccupationTreeNode[],
  stored: string,
): OccupationTreeNode | undefined {
  const needle = stored.trim().toLowerCase();
  if (!needle) return undefined;
  for (const n of tree) {
    if (
      n.nameEn.toLowerCase() === needle ||
      n.nameGu.toLowerCase() === needle ||
      n.nameEn === stored ||
      n.nameGu === stored
    ) {
      return n;
    }
    const child = findOccupationNode(n.children, stored);
    if (child) return child;
  }
  return undefined;
}

export function labelOf(node: Pick<OccupationTreeNode, "nameEn" | "nameGu">) {
  return node.nameGu || node.nameEn;
}

export function choiceLabel(node: Pick<OccupationTreeNode, "nameEn" | "nameGu">) {
  return node.nameGu ? `${node.nameEn} · ${node.nameGu}` : node.nameEn;
}
