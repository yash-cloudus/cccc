"use client";

import {
  DropdownWithOther,
  OTHER,
} from "@/components/admin/dropdown-with-other";
import {
  type CascadingOccupationValues,
  childChoices,
  occupationChoices,
} from "@/lib/cascading-occupation";
import {
  type OccupationTreeNode,
  findOccupationNode,
  isDiplomaLevel,
  isNokriOccupation,
  isStreamLevel,
  isStudentOccupation,
  isVeparOccupation,
  labelOf,
} from "@/lib/occupation-defaults";

function courseFieldLabel(eduNode: OccupationTreeNode) {
  if (isStreamLevel(eduNode.nameEn)) return "Stream · પ્રવાહ";
  if (isDiplomaLevel(eduNode.nameEn)) return "Diploma field · ડિપ્લોમા ક્ષેત્ર";
  return "Program / course · કોર્સ";
}

function specializationLabel(courseNode: OccupationTreeNode) {
  return `Under ${courseNode.nameEn} · વિશેષતા`;
}

export function CascadingOccupationFields({
  tree,
  values,
  onChange,
  t = (_gu, en) => en,
}: {
  tree: OccupationTreeNode[];
  values: CascadingOccupationValues;
  onChange: (patch: Partial<CascadingOccupationValues>) => void;
  /** Translator for the add-new UI — member screens pass their Gujarati-first `T`. */
  t?: (gu: string, en: string) => string;
}) {
  const rootNode =
    values.occupation && values.occupation !== OTHER
      ? tree.find((r) => labelOf(r) === values.occupation) ??
        findOccupationNode(tree, values.occupation)
      : undefined;

  const eduNode =
    rootNode && values.education && values.education !== OTHER
      ? findOccupationNode(rootNode.children, values.education)
      : undefined;

  const courseNode =
    eduNode && values.course && values.course !== OTHER
      ? findOccupationNode(eduNode.children, values.course)
      : undefined;

  const showVeparNokri =
    rootNode && (isVeparOccupation(rootNode.nameEn) || isNokriOccupation(rootNode.nameEn));
  const showStudent = rootNode && isStudentOccupation(rootNode.nameEn);

  const eduChildren = childChoices(eduNode);
  const courseChildren = childChoices(courseNode);
  const hasEduChildren = eduChildren.length > 0;
  const hasCourseChildren = courseChildren.length > 0;

  const subLabel = rootNode
    ? isVeparOccupation(rootNode.nameEn)
      ? "Business type · વ્યવસાય પ્રકાર"
      : isNokriOccupation(rootNode.nameEn)
        ? "Job type · નોકરી પ્રકાર"
        : "Work / business · વ્યવસાય / ધંધો"
    : "Work / business · વ્યવસાય / ધંધો";

  return (
    <>
      <DropdownWithOther
        label="Occupation · વ્યવસાય"
        value={values.occupation}
        otherValue={values.occupationCustom}
        otherValueGu={values.occupationCustomGu}
        options={occupationChoices(tree)}
        otherPlaceholder="e.g. Trade, Job, Farming…"
        onChange={(v) =>
          onChange({
            occupation: v,
            occupationCustom: "",
            occupationOther: "",
            occupationOtherCustom: "",
            education: "",
            educationCustom: "",
            course: "",
            courseCustom: "",
            specialization: "",
            specializationCustom: "",
          })
        }
        onOtherChange={(v) => onChange({ occupationCustom: v })}
        onOtherGuChange={(v) => onChange({ occupationCustomGu: v })}
        t={t}
      />

      {showVeparNokri && (
        <DropdownWithOther
          label={subLabel}
          value={values.occupationOther}
          otherValue={values.occupationOtherCustom}
          otherValueGu={values.occupationOtherCustomGu}
          options={childChoices(rootNode)}
          otherPlaceholder="Type business or job…"
          onChange={(v) =>
            onChange({ occupationOther: v, occupationOtherCustom: "" })
          }
          onOtherChange={(v) => onChange({ occupationOtherCustom: v })}
          onOtherGuChange={(v) => onChange({ occupationOtherCustomGu: v })}
          t={t}
        />
      )}

      {showStudent && (
        <>
          <DropdownWithOther
            label="Education level · ધોરણ"
            value={values.education}
            otherValue={values.educationCustom}
            otherValueGu={values.educationCustomGu}
            options={childChoices(rootNode)}
            otherPlaceholder="e.g. Std 10, College…"
            onChange={(v) =>
              onChange({
                education: v,
                educationCustom: "",
                course: "",
                courseCustom: "",
                specialization: "",
                specializationCustom: "",
              })
            }
            onOtherChange={(v) => onChange({ educationCustom: v })}
            onOtherGuChange={(v) => onChange({ educationCustomGu: v })}
            t={t}
          />

          {/* Stream / College / Diploma / any level with children — one shape for
              every level, so "add new" always lives inside the dropdown it
              belongs to instead of in a field of its own underneath. */}
          {eduNode && hasEduChildren && (
            <DropdownWithOther
              label={courseFieldLabel(eduNode)}
              value={values.course}
              otherValue={values.courseCustom}
              otherValueGu={values.courseCustomGu}
              options={eduChildren}
              otherPlaceholder="e.g. B.Tech, B.Com, IT…"
              onChange={(v) =>
                onChange({
                  course: v,
                  courseCustom: "",
                  specialization: "",
                  specializationCustom: "",
                })
              }
              onOtherChange={(v) => onChange({ courseCustom: v })}
                  onOtherGuChange={(v) => onChange({ courseCustomGu: v })}
                  t={t}
            />
          )}

          {courseNode && hasCourseChildren && (
            <DropdownWithOther
              label={specializationLabel(courseNode)}
              value={values.specialization}
              otherValue={values.specializationCustom}
              otherValueGu={values.specializationCustomGu}
              options={courseChildren}
              otherPlaceholder="e.g. IT, Mechanical…"
              onChange={(v) =>
                onChange({ specialization: v, specializationCustom: "" })
              }
              onOtherChange={(v) => onChange({ specializationCustom: v })}
              onOtherGuChange={(v) => onChange({ specializationCustomGu: v })}
              t={t}
            />
          )}
        </>
      )}
    </>
  );
}
