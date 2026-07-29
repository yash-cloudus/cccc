"use client";

import {
  DropdownWithOther,
  OTHER,
} from "@/components/admin/dropdown-with-other";
import { FilterChip } from "@/components/admin/admin-ui";
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
  const showStreamChips = eduNode && isStreamLevel(eduNode.nameEn) && hasEduChildren;

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

          {showStreamChips && (
            <div>
              <div className="mb-1 text-[11.5px] font-bold text-[var(--muted)]">
                Stream · પ્રવાહ *
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {eduChildren.map((o) => (
                  <FilterChip
                    key={o.value}
                    label={o.label}
                    active={values.course === o.value}
                    onClick={() =>
                      onChange({
                        course: o.value,
                        courseCustom: "",
                        specialization: "",
                        specializationCustom: "",
                      })
                    }
                  />
                ))}
                <FilterChip
                  label="＋ નવું ઉમેરો · Add new"
                  active={values.course === OTHER}
                  onClick={() =>
                    onChange({
                      course: OTHER,
                      courseCustom: "",
                      specialization: "",
                      specializationCustom: "",
                    })
                  }
                />
              </div>
              {values.course === OTHER && (
                <DropdownWithOther
                  label="Stream · પ્રવાહ"
                  value={OTHER}
                  otherValue={values.courseCustom}
                  options={[]}
                  onChange={() => {}}
                  onOtherChange={(v) => onChange({ courseCustom: v })}
                  onOtherGuChange={(v) => onChange({ courseCustomGu: v })}
                  t={t}
                />
              )}
            </div>
          )}

          {/* College / Diploma / any level with children — same cascade as masters Nested */}
          {eduNode && hasEduChildren && !showStreamChips && (
            <DropdownWithOther
              label={courseFieldLabel(eduNode)}
              value={values.course}
              otherValue={values.courseCustom}
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
