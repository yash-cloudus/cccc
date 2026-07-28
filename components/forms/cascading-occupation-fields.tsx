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

export function CascadingOccupationFields({
  tree,
  values,
  onChange,
}: {
  tree: OccupationTreeNode[];
  values: CascadingOccupationValues;
  onChange: (patch: Partial<CascadingOccupationValues>) => void;
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

  const showVeparNokri =
    rootNode && (isVeparOccupation(rootNode.nameEn) || isNokriOccupation(rootNode.nameEn));
  const showStudent = rootNode && isStudentOccupation(rootNode.nameEn);
  const showStream = eduNode && isStreamLevel(eduNode.nameEn);
  const showDiplomaField = eduNode && isDiplomaLevel(eduNode.nameEn);

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
          })
        }
        onOtherChange={(v) => onChange({ occupationCustom: v })}
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
              onChange({ education: v, educationCustom: "", course: "", courseCustom: "" })
            }
            onOtherChange={(v) => onChange({ educationCustom: v })}
          />

          {showStream && (
            <div>
              <div className="mb-1 text-[11.5px] font-bold text-[var(--muted)]">
                Stream · પ્રવાહ *
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {childChoices(eduNode!).map((o) => (
                  <FilterChip
                    key={o.value}
                    label={o.label}
                    active={values.course === o.value}
                    onClick={() =>
                      onChange({ course: o.value, courseCustom: "" })
                    }
                  />
                ))}
                <FilterChip
                  label="Other · અન્ય"
                  active={values.course === OTHER}
                  onClick={() => onChange({ course: OTHER, courseCustom: "" })}
                />
              </div>
              {values.course === OTHER && (
                <DropdownWithOther
                  label="Stream — type it"
                  value={OTHER}
                  otherValue={values.courseCustom}
                  options={[]}
                  onChange={() => {}}
                  onOtherChange={(v) => onChange({ courseCustom: v })}
                />
              )}
            </div>
          )}

          {showDiplomaField && (
            <DropdownWithOther
              label="Diploma field · ડિપ્લોમા ક્ષેત્ર"
              value={values.course}
              otherValue={values.courseCustom}
              options={childChoices(eduNode!)}
              otherPlaceholder="e.g. IT, EC, Mechanical…"
              onChange={(v) => onChange({ course: v, courseCustom: "" })}
              onOtherChange={(v) => onChange({ courseCustom: v })}
            />
          )}
        </>
      )}
    </>
  );
}
