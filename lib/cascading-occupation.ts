import type { DropdownChoice } from "@/components/admin/dropdown-with-other";
import { OTHER, commitOtherValue } from "@/components/admin/dropdown-with-other";
import {
  type OccupationTreeNode,
  choiceLabel,
  findOccupationNode,
  isDiplomaLevel,
  isNokriOccupation,
  isStreamLevel,
  isStudentOccupation,
  isVeparOccupation,
  labelOf,
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

/** Resolve stored member fields into cascading form state. */
export function cascadingFromStored(
  tree: OccupationTreeNode[],
  stored: {
    occupation?: string | null;
    occupationOther?: string | null;
    education?: string | null;
    course?: string | null;
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
    const course = stored.course?.trim();
    if (course) {
      const eduNode = out.education
        ? findOccupationNode(root.children, out.education === OTHER ? edu! : out.education)
        : undefined;
      const courseNode = eduNode ? findOccupationNode(eduNode.children, course) : undefined;
      out.course = courseNode ? labelOf(courseNode) : OTHER;
      if (!courseNode) out.courseCustom = course;
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

export async function resolveCascadingOccupationForSave(
  tree: OccupationTreeNode[],
  values: CascadingOccupationValues,
): Promise<{
  occupation: string;
  occupationOther?: string;
  education?: string;
  course?: string;
}> {
  const rootChoices = occupationChoices(tree);
  const rootStored = await commitOtherValue(
    "occupation",
    values.occupation,
    values.occupationCustom,
    rootChoices,
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
      { parentId: root.id },
    );
    let course: string | undefined;
    if (education) {
      const eduNode = findOccupationNode(root.children, education);
      if (eduNode && (isStreamLevel(eduNode.nameEn) || isDiplomaLevel(eduNode.nameEn))) {
        const courseChoices = childChoices(eduNode);
        const resolvedCourse = await commitOtherValue(
          "occupation",
          values.course,
          values.courseCustom,
          courseChoices,
          { parentId: eduNode.id },
        );
        course = resolvedCourse || undefined;
      }
    }
    return {
      occupation: labelOf(root),
      education: education || undefined,
      course,
    };
  }

  if (isVeparOccupation(root.nameEn) || isNokriOccupation(root.nameEn)) {
    const subChoices = childChoices(root);
    const occupationOther = await commitOtherValue(
      "occupation",
      values.occupationOther,
      values.occupationOtherCustom,
      subChoices,
      { parentId: root.id },
    );
    return {
      occupation: labelOf(root),
      occupationOther: occupationOther || undefined,
    };
  }

  return { occupation: labelOf(root) };
}
