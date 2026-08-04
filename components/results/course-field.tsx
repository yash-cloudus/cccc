"use client";

import { useState } from "react";
import { PickerWithAdd } from "@/components/ui/picker-with-add";
import { courseOptionsForStandard, specializationOptionsForCourse } from "@/lib/cascading-occupation";
import { api } from "@/lib/http";
import type { OccupationTreeNode } from "@/lib/occupation-defaults";

type TreeOption = { nameEn: string; nameGu: string };

/**
 * Picker over a resolved occupation-tree node's children, with an inline
 * "add new" that saves straight back to that same list — shared by
 * `CourseField` (Student → standard) and `SpecializationField` (…→ course),
 * the two tiers the results form can offer.
 */
function TreePicker({
  parentId,
  known,
  value,
  onChange,
  lang,
  variant,
  className,
  scrollContainerRef,
  syncKey,
}: {
  parentId: string | null;
  known: TreeOption[];
  value: string;
  onChange: (v: string) => void;
  lang: "en" | "gu";
  variant: "member" | "admin";
  className?: string;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  syncKey: string;
}) {
  // Options added this session, before a reload picks them up from `tree`.
  const [extra, setExtra] = useState<TreeOption[]>([]);
  const all = [...known, ...extra];
  const label = (o: TreeOption) => (lang === "gu" ? o.nameGu || o.nameEn : o.nameEn);

  const options = [
    ...all.map((o) => ({ value: o.nameEn, label: label(o) })),
    // A value already on the record but missing from the list — typed before
    // this field existed, or added elsewhere — still shows as its own row
    // instead of the field falling back to blank.
    ...(value && !all.some((o) => o.nameEn === value) ? [{ value, label: value }] : []),
  ];

  async function addNew({ nameEn, nameGu }: { nameEn: string; nameGu: string }) {
    onChange(nameEn);
    setExtra((prev) => [...prev, { nameEn, nameGu: nameGu || nameEn }]);
    if (!parentId) return;
    await api.post("/api/dropdowns", {
      type: "occupation",
      parentId,
      nameEn,
      nameGu: nameGu || nameEn,
    });
  }

  return (
    <PickerWithAdd
      value={value}
      onChange={onChange}
      options={options}
      variant={variant}
      syncKey={syncKey}
      placeholder={lang === "gu" ? "પસંદ કરો…" : "Select…"}
      addLabel={lang === "gu" ? "નવું ઉમેરો" : "Add new"}
      onAddNew={addNew}
      className={className}
      scrollContainerRef={scrollContainerRef}
    />
  );
}

type FieldProps = {
  tree: OccupationTreeNode[];
  value: string;
  onChange: (v: string) => void;
  lang?: "en" | "gu";
  variant?: "member" | "admin";
  className?: string;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
};

/**
 * "Degree / Course name" picker for College / Diploma results — backed by
 * the same Dropdown lists → Student → College/Diploma masters an admin
 * manages (screenshot: DIPLOMA FIELDS), with an inline "add new" for
 * anything not listed yet. Shared by the family app's upload form and the
 * admin's upload/verify + next-standard modals, so a course typed in either
 * place joins the same list everyone else picks from.
 */
export function CourseField({
  tree,
  standard,
  value,
  onChange,
  lang = "en",
  variant = "member",
  className,
  scrollContainerRef,
}: FieldProps & { standard: string }) {
  const { parentId, options } = courseOptionsForStandard(tree, standard);
  return (
    <TreePicker
      parentId={parentId}
      known={options}
      value={value}
      onChange={onChange}
      lang={lang}
      variant={variant}
      className={className}
      scrollContainerRef={scrollContainerRef}
      syncKey={`course:${standard}`}
    />
  );
}

/**
 * One tier deeper than `CourseField` — some courses nest a branch of their
 * own in Dropdown lists (College → BE → CSE / IT). Render this only when
 * `specializationOptionsForCourse` comes back with options; most courses
 * have none, and the field would otherwise offer an empty dropdown.
 */
export function SpecializationField({
  tree,
  standard,
  course,
  value,
  onChange,
  lang = "en",
  variant = "member",
  className,
  scrollContainerRef,
}: FieldProps & { standard: string; course: string }) {
  const { parentId, options } = specializationOptionsForCourse(tree, standard, course);
  return (
    <TreePicker
      parentId={parentId}
      known={options}
      value={value}
      onChange={onChange}
      lang={lang}
      variant={variant}
      className={className}
      scrollContainerRef={scrollContainerRef}
      syncKey={`specialization:${standard}:${course}`}
    />
  );
}
