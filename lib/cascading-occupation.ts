import type { DropdownChoice } from "@/components/admin/dropdown-with-other";
import { OTHER, commitOtherValue } from "@/components/admin/dropdown-with-other";
import {
  type OccupationTreeNode,
  choiceLabel,
  findOccupationNode,
  isNokriOccupation,
  isStudentOccupation,
  isVeparOccupation,
  labelOf,
  liveStudentChildNode,
} from "@/lib/occupation-defaults";

export type CascadingOccupationValues = {
  occupation: string;
  occupationCustom: string;
  occupationOther: string;
  occupationOtherCustom: string;
  education: string;
  educationCustom: string;
  course: string;
  courseCustom: string;
  /** Third level under Student (e.g. College → B.Tech → IT). Stored as leaf in `course` when set. */
  specialization: string;
  specializationCustom: string;
  /**
   * Gujarati halves of the typed-in ("add new") values. Kept beside each
   * `*Custom` so a newly created master carries a real Gujarati name instead
   * of repeating the English one. Optional — an older draft without them still
   * saves, it just falls back to the English text.
   */
  occupationCustomGu?: string;
  occupationOtherCustomGu?: string;
  educationCustomGu?: string;
  courseCustomGu?: string;
  specializationCustomGu?: string;
};

export const blankCascadingOccupation = (): CascadingOccupationValues => ({
  occupation: "",
  occupationCustom: "",
  occupationOther: "",
  occupationOtherCustom: "",
  education: "",
  educationCustom: "",
  course: "",
  courseCustom: "",
  specialization: "",
  specializationCustom: "",
  occupationCustomGu: "",
  occupationOtherCustomGu: "",
  educationCustomGu: "",
  courseCustomGu: "",
  specializationCustomGu: "",
});

export function occupationChoices(tree: OccupationTreeNode[]): DropdownChoice[] {
  return tree
    .filter((n) => n.isActive)
    .map((n) => ({ value: labelOf(n), label: choiceLabel(n) }));
}

export function childChoices(node: OccupationTreeNode | undefined): DropdownChoice[] {
  if (!node) return [];
  return node.children
    .filter((n) => n.isActive)
    .map((n) => ({ value: labelOf(n), label: choiceLabel(n) }));
}

/** Find a node by label anywhere under `nodes` (any depth). */
function findDeep(
  nodes: OccupationTreeNode[],
  needle: string,
): OccupationTreeNode | undefined {
  const direct = findOccupationNode(nodes, needle);
  if (direct) return direct;
  for (const n of nodes) {
    const hit = findDeep(n.children, needle);
    if (hit) return hit;
  }
  return undefined;
}

function findParentOf(
  roots: OccupationTreeNode[],
  childId: string,
): OccupationTreeNode | undefined {
  for (const n of roots) {
    if (n.children.some((c) => c.id === childId)) return n;
    const deeper = findParentOf(n.children, childId);
    if (deeper) return deeper;
  }
  return undefined;
}

/**
 * Walk Student → path[0] → path[1] → … in the occupation tree.
 *
 * `path[0]` — the standard (College, Diploma, …) — is resolved via
 * `liveStudentChildNode`, matched by its seed identity rather than by name,
 * so renaming "Diploma" to something else in Dropdown lists doesn't make its
 * course list resolve to nothing. Deeper steps (course, specialization) have
 * no seed identity of their own to preserve, so they're still matched by
 * name, same as before.
 */
function studentNode(
  tree: OccupationTreeNode[],
  ...path: string[]
): OccupationTreeNode | undefined {
  const [first, ...rest] = path;
  if (!first) return tree.find((r) => isStudentOccupation(r.nameEn, r.nameGu));
  let node = liveStudentChildNode(tree, first);
  for (const step of rest) {
    node = node ? findOccupationNode(node.children, step) : undefined;
  }
  return node;
}

function activeChildOptions(
  node: OccupationTreeNode | undefined,
): { parentId: string | null; options: { nameEn: string; nameGu: string }[] } {
  if (!node) return { parentId: null, options: [] };
  return {
    parentId: node.id,
    options: node.children
      .filter((c) => c.isActive)
      .map((c) => ({ nameEn: c.nameEn, nameGu: c.nameGu })),
  };
}

/**
 * Course/degree options configured under Student → this standard (College,
 * Diploma, …) in Dropdown lists — the same nested list an admin manages
 * there. Backs the results "Degree / Course name" field so it offers a
 * dropdown instead of a bare text box; `parentId` is where a newly typed-in
 * course gets saved back to that same list.
 */
export function courseOptionsForStandard(
  tree: OccupationTreeNode[],
  standard: string,
): { parentId: string | null; options: { nameEn: string; nameGu: string }[] } {
  return activeChildOptions(studentNode(tree, standard));
}

/**
 * One tier deeper still — Dropdown lists lets a course itself nest a branch
 * (College → BE → CSE / IT). Empty when the picked course has no such
 * nesting, which is most courses; the results form only shows the
 * specialization field when this comes back non-empty.
 */
export function specializationOptionsForCourse(
  tree: OccupationTreeNode[],
  standard: string,
  course: string,
): { parentId: string | null; options: { nameEn: string; nameGu: string }[] } {
  if (!standard || !course) return { parentId: null, options: [] };
  return activeChildOptions(studentNode(tree, standard, course));
}

/** Resolve stored member fields into cascading form state. */
export function cascadingFromStored(
  tree: OccupationTreeNode[],
  stored: {
    occupation?: string | null;
    occupationOther?: string | null;
    education?: string | null;
    course?: string | null;
    specialization?: string | null;
  },
): CascadingOccupationValues {
  const base = blankCascadingOccupation();
  const occ = stored.occupation?.trim();
  if (!occ) return base;

  const root =
    tree.find(
      (r) =>
        r.nameEn === occ ||
        r.nameGu === occ ||
        labelOf(r) === occ ||
        r.nameEn.toLowerCase() === occ.toLowerCase(),
    ) ?? undefined;

  if (!root) {
    return { ...base, occupation: OTHER, occupationCustom: occ };
  }

  const out: CascadingOccupationValues = {
    ...base,
    occupation: labelOf(root),
  };

  if (isStudentOccupation(root.nameEn)) {
    const edu = stored.education?.trim();
    if (edu) {
      const eduNode = findOccupationNode(root.children, edu);
      out.education = eduNode ? labelOf(eduNode) : OTHER;
      if (!eduNode) out.educationCustom = edu;
    }

    const courseStored = stored.course?.trim();
    if (courseStored && out.education && out.education !== OTHER) {
      const eduNode = findOccupationNode(root.children, out.education);
      if (eduNode) {
        // Prefer direct child (B.Tech under College)
        const direct = findOccupationNode(eduNode.children, courseStored);
        if (direct) {
          out.course = labelOf(direct);
          const specStored = stored.specialization?.trim();
          if (specStored) {
            const specNode = findOccupationNode(direct.children, specStored);
            out.specialization = specNode ? labelOf(specNode) : OTHER;
            if (!specNode) out.specializationCustom = specStored;
          }
        } else {
          // Legacy rows saved before `specialization` had its own column: the
          // deepest pick was collapsed into `course` — reconstruct the path.
          const leaf = findDeep(eduNode.children, courseStored);
          if (leaf) {
            const parent = findParentOf(eduNode.children, leaf.id);
            if (parent && parent.id !== eduNode.id) {
              out.course = labelOf(parent);
              out.specialization = labelOf(leaf);
            } else {
              out.course = labelOf(leaf);
            }
          } else {
            out.course = OTHER;
            out.courseCustom = courseStored;
          }
        }
      }
    }
    return out;
  }

  const sub = stored.occupationOther?.trim();
  if (sub) {
    const subNode = findOccupationNode(root.children, sub);
    out.occupationOther = subNode ? labelOf(subNode) : OTHER;
    if (!subNode) out.occupationOtherCustom = sub;
  }
  return out;
}

/**
 * The whole occupation path as one readable line — "Student · Std 12 · Science",
 * "Vepar (Business) · Agro".
 *
 * For summaries drawn from a form that is still in cascading state, where a
 * typed-in level holds the `OTHER` sentinel rather than its text. Printing the
 * raw field put a literal `__other__` on the review screen; printing only the
 * deepest one threw away the path that was just picked.
 */
export function cascadingOccupationSummary(values: CascadingOccupationValues): string {
  const shown = (value: string, custom?: string, customGu?: string) =>
    value === OTHER ? customGu?.trim() || custom?.trim() || "" : value.trim();

  return [
    shown(values.occupation, values.occupationCustom, values.occupationCustomGu),
    shown(values.occupationOther, values.occupationOtherCustom, values.occupationOtherCustomGu),
    shown(values.education, values.educationCustom, values.educationCustomGu),
    shown(values.course, values.courseCustom, values.courseCustomGu),
    shown(values.specialization, values.specializationCustom, values.specializationCustomGu),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The same path, read off a saved record instead of a live form.
 *
 * Stored members keep the levels in separate columns and never hold the OTHER
 * sentinel, so this is just the join — but admin screens showing one column
 * ("Business": —) were hiding the flow the member actually picked.
 */
export function storedOccupationPath(m: {
  occupation?: string | null;
  occupationOther?: string | null;
  education?: string | null;
  course?: string | null;
  specialization?: string | null;
}): string {
  return [m.occupation, m.occupationOther, m.education, m.course, m.specialization]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" · ");
}

export async function resolveCascadingOccupationForSave(
  tree: OccupationTreeNode[],
  values: CascadingOccupationValues,
): Promise<{
  occupation: string;
  occupationOther?: string;
  education?: string;
  course?: string;
  specialization?: string;
}> {
  const rootChoices = occupationChoices(tree);
  const rootStored = await commitOtherValue(
    "occupation",
    values.occupation,
    values.occupationCustom,
    rootChoices,
    { nameGu: values.occupationCustomGu },
  );
  if (!rootStored) {
    return { occupation: "" };
  }

  const root =
    tree.find(
      (r) =>
        labelOf(r) === rootStored ||
        r.nameEn === rootStored ||
        r.nameGu === rootStored,
    ) ?? tree.find((r) => r.nameEn === rootStored || r.nameGu === rootStored);

  if (!root) {
    return { occupation: rootStored };
  }

  if (isStudentOccupation(root.nameEn)) {
    const eduChoices = childChoices(root);
    const education = await commitOtherValue(
      "occupation",
      values.education,
      values.educationCustom,
      eduChoices,
      { parentId: root.id, nameGu: values.educationCustomGu },
    );
    let course: string | undefined;
    let specialization: string | undefined;
    if (education) {
      const eduNode = findOccupationNode(root.children, education);
      if (eduNode && eduNode.children.length > 0) {
        const courseChoices = childChoices(eduNode);
        const mid = await commitOtherValue(
          "occupation",
          values.course,
          values.courseCustom,
          courseChoices,
          { parentId: eduNode.id, nameGu: values.courseCustomGu },
        );
        if (mid) {
          course = mid;
          const courseNode = findOccupationNode(eduNode.children, mid);
          if (
            courseNode &&
            courseNode.children.length > 0 &&
            (values.specialization || values.specializationCustom)
          ) {
            const specChoices = childChoices(courseNode);
            specialization =
              (await commitOtherValue(
                "occupation",
                values.specialization,
                values.specializationCustom,
                specChoices,
                { parentId: courseNode.id, nameGu: values.specializationCustomGu },
              )) || undefined;
          }
        }
      }
    }
    return {
      occupation: labelOf(root),
      education: education || undefined,
      course,
      specialization,
    };
  }

  if (isVeparOccupation(root.nameEn) || isNokriOccupation(root.nameEn)) {
    const subChoices = childChoices(root);
    const occupationOther = await commitOtherValue(
      "occupation",
      values.occupationOther,
      values.occupationOtherCustom,
      subChoices,
      { parentId: root.id, nameGu: values.occupationOtherCustomGu },
    );
    return {
      occupation: labelOf(root),
      occupationOther: occupationOther || undefined,
    };
  }

  return { occupation: labelOf(root) };
}
