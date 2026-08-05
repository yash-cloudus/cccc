"use client";

/**
 * "What's next for this student?" — shown right after a result is
 * uploaded/edited, on both the family app and the admin side.
 *
 * The choice is stored on the ResultEntry immediately, but only ever applied
 * to the student's actual record (FamilyMember.education/course) once the
 * result itself is approved by an admin — see PATCH /api/results.
 */

import { useMemo, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { CourseField, SpecializationField } from "@/components/results/course-field";
import { PickerWithAdd } from "@/components/ui/picker-with-add";
import { specializationOptionsForCourse } from "@/lib/cascading-occupation";
import { DEFAULT_STREAMS, EDUCATION_LEVELS, type OccupationTreeNode } from "@/lib/occupation-defaults";
import {
  HIGHER_STANDARDS,
  STREAM_STANDARDS,
  canonicalStandard,
  liveLevelLabel,
  type StudyOutcome,
} from "@/lib/result-drive";
import { cn } from "@/lib/utils";

/** Last standard whose promotion is a plain "+1" with nothing to decide. */
const LOCKED_THROUGH = 9;

function stdNumber(nameEn: string): number | null {
  const m = /^Standard (\d+)$/.exec(nameEn);
  return m ? Number(m[1]) : null;
}

/**
 * What a student of `current` may be promoted into.
 *
 * Standard 1–9 promote straight to the next numbered standard — there is no
 * decision to make, so `locked` carries that one value and no picker is shown.
 *
 * Standard 10 is the first real fork (Standard 11's streams, Diploma, …) so
 * it does get a picker, but only of standards *after* Standard 10. A
 * promotion never runs backwards, and offering the full list let a Standard
 * 10 result quietly demote the student to Standard 3. College / Diploma are
 * siblings rather than a sequence, so they offer each other (moving on, or
 * the next year of the same course).
 *
 * A standard this app doesn't know — a community-specific level — can't be
 * ordered, so it falls back to the full list rather than an empty picker.
 */
function nextStandardChoices(current: string | undefined): {
  locked: string;
  options: typeof EDUCATION_LEVELS;
} {
  const std = canonicalStandard(current);
  const idx = std ? EDUCATION_LEVELS.findIndex((l) => l.nameEn === std) : -1;
  if (idx < 0) return { locked: "", options: EDUCATION_LEVELS };

  const n = stdNumber(std);
  if (n != null && n <= LOCKED_THROUGH) {
    return { locked: EDUCATION_LEVELS[idx + 1]?.nameEn ?? "", options: [] };
  }
  if (HIGHER_STANDARDS.has(std)) {
    return { locked: "", options: EDUCATION_LEVELS.filter((l) => HIGHER_STANDARDS.has(l.nameEn)) };
  }
  return { locked: "", options: EDUCATION_LEVELS.slice(idx + 1) };
}

export type NextStandardValue = {
  studyOutcome: StudyOutcome;
  nextStandard: string | null;
  nextStream: string | null;
  nextCourse: string | null;
  nextSpecialization: string | null;
};

const OUTCOME_CHOICES: { value: StudyOutcome; en: string; gu: string }[] = [
  { value: "PROMOTED", en: "Moving to next standard", gu: "આગળના ધોરણમાં જશે" },
  { value: "STUDY_COMPLETE", en: "Study complete", gu: "અભ્યાસ પૂર્ણ" },
  { value: "FAILED_REPEAT", en: "Failed / repeating this year", gu: "નાપાસ / ફરી આ જ ધોરણ" },
  { value: "DROPPED_OUT", en: "Dropped out", gu: "અભ્યાસ છોડ્યો" },
];

function stop(e: React.MouseEvent) {
  e.stopPropagation();
}

/** A standard's *current* name — read live from Dropdown lists. */
function levelLabel(nameEn: string, lang: "en" | "gu", tree: OccupationTreeNode[]): string {
  return liveLevelLabel(tree, nameEn, lang);
}

export function NextStandardModal({
  studentName,
  currentStandard,
  initial,
  onSkip,
  onConfirm,
  busy = false,
  lang = "en",
  occupationTree,
}: {
  studentName: string;
  /** The student's standard for *this* result — Standard 1-9 fix the next standard below, Standard 10+ pick from it. */
  currentStandard?: string;
  initial?: Partial<NextStandardValue> | null;
  onSkip: () => void;
  onConfirm: (value: NextStandardValue) => void;
  busy?: boolean;
  lang?: "en" | "gu";
  /** Dropdown lists' occupation tree — backs the College/Diploma course picker below. */
  occupationTree: OccupationTreeNode[];
}) {
  const T = (en: string, gu: string) => (lang === "gu" ? gu : en);
  // This modal is its own small scrollable popup — passed to PickerWithAdd
  // so its open-up/open-down decision is measured against the card, not the
  // full viewport, or the option list opens downward straight over the
  // Save / Decide later row instead of flipping up.
  const cardRef = useRef<HTMLDivElement>(null);

  const { locked, options } = useMemo(
    () => nextStandardChoices(currentStandard),
    [currentStandard],
  );

  const [outcome, setOutcome] = useState<StudyOutcome | "">(initial?.studyOutcome ?? "");
  // A locked standard wins over whatever was saved before — an earlier entry
  // made while the picker was still open may hold a standard this student
  // cannot actually be promoted into.
  const [nextStandard, setNextStandard] = useState(locked || initial?.nextStandard || "");
  const [nextStream, setNextStream] = useState(initial?.nextStream ?? "");
  const [nextCourse, setNextCourse] = useState(initial?.nextCourse ?? "");
  const [nextSpecialization, setNextSpecialization] = useState(initial?.nextSpecialization ?? "");
  const [error, setError] = useState<string | null>(null);

  const showStream = STREAM_STANDARDS.has(nextStandard);
  const isHigher = HIGHER_STANDARDS.has(nextStandard);
  // Only some courses nest a branch of their own (College → BE → CSE / IT) —
  // most don't, and the field stays hidden rather than offer an empty list.
  const showSpecialization =
    isHigher && specializationOptionsForCourse(occupationTree, nextStandard, nextCourse).options.length > 0;

  const valid = useMemo(() => {
    if (!outcome) return false;
    if (outcome !== "PROMOTED") return true;
    if (!nextStandard) return false;
    if (showStream && !nextStream) return false;
    if (isHigher && !nextCourse.trim()) return false;
    return true;
  }, [outcome, nextStandard, showStream, nextStream, isHigher, nextCourse]);

  function confirm() {
    if (!outcome) return setError(T("Pick one option", "એક વિકલ્પ પસંદ કરો"));
    if (!valid) {
      return setError(
        T("Fill in the highlighted field", "હાઇલાઇટ કરેલ ફીલ્ડ ભરો"),
      );
    }
    onConfirm({
      studyOutcome: outcome,
      nextStandard: outcome === "PROMOTED" ? nextStandard : null,
      nextStream: outcome === "PROMOTED" && showStream ? nextStream : null,
      nextCourse: outcome === "PROMOTED" && isHigher ? nextCourse.trim() : null,
      nextSpecialization:
        outcome === "PROMOTED" && showSpecialization ? nextSpecialization.trim() || null : null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(42,38,32,.5)] p-6"
      onClick={onSkip}
    >
      <div
        ref={cardRef}
        className="max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-white shadow-[0_30px_60px_rgba(0,0,0,.34)]"
        onClick={stop}
      >
        <div className="border-b border-[#F1EBDE] px-6 py-[18px]">
          <h3 className="text-base font-extrabold text-[#2A2620]">
            {T("What's next for", "હવે પછી")} {studentName}?
          </h3>
          <p className="mt-0.5 text-[12px] text-[#938C80]">
            {T(
              "Applied once the result is approved — you can skip this for now.",
              "પરિણામ મંજૂર થાય ત્યારે જ લાગુ થશે — હમણાં છોડી પણ શકાય.",
            )}
          </p>
        </div>

        <div className="px-6 py-[18px]">
          <div className="mb-3 flex flex-col gap-2">
            {OUTCOME_CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setOutcome(c.value);
                  setError(null);
                }}
                className="cursor-pointer rounded-[13px] border-[1.5px] px-3.5 py-2.5 text-left text-[13.5px] font-bold"
                style={{
                  borderColor: outcome === c.value ? "#A62A38" : "#EDE4D4",
                  background: outcome === c.value ? "#FBEBEC" : "#FCFAF6",
                  color: outcome === c.value ? "#A62A38" : "#57524A",
                }}
              >
                {T(c.en, c.gu)}
              </button>
            ))}
          </div>

          {outcome === "PROMOTED" && (
            <>
              <Label>{T("Next standard", "આગળનું ધોરણ")} *</Label>
              {locked ? (
                <>
                  <div className="flex h-11 items-center justify-between gap-2 rounded-[13px] border-[1.5px] border-[#EDE4D4] bg-[#F3EFE6] px-3.5 text-[13.5px] font-semibold text-[var(--ink)]">
                    <span className="min-w-0 truncate">{levelLabel(locked, lang, occupationTree)}</span>
                    <Lock className="size-3.5 flex-none text-[#A79E92]" strokeWidth={2.2} />
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-[#938C80]">
                    {T(
                      "Standard 1–9 always move up one standard.",
                      "ધોરણ 1–9 હંમેશા એક ધોરણ આગળ જ જાય છે.",
                    )}
                  </p>
                </>
              ) : (
                <PickerWithAdd
                  value={nextStandard}
                  onChange={(v) => {
                    setNextStandard(v);
                    setNextStream("");
                    setNextCourse("");
                  }}
                  placeholder={T("Select…", "પસંદ કરો…")}
                  options={options.map((l) => ({
                    value: l.nameEn,
                    label: levelLabel(l.nameEn, lang, occupationTree),
                  }))}
                  className={PICKER_CLASS}
                  scrollContainerRef={cardRef}
                />
              )}

              {showStream && (
                <>
                  <Label>{T("Stream", "પ્રવાહ")} *</Label>
                  <PickerWithAdd
                    value={nextStream}
                    onChange={setNextStream}
                    placeholder={T("Select…", "પસંદ કરો…")}
                    options={DEFAULT_STREAMS.map((s) => ({
                      value: s.nameEn,
                      label: lang === "gu" ? s.nameGu : s.nameEn,
                    }))}
                    className={PICKER_CLASS}
                    scrollContainerRef={cardRef}
                  />
                </>
              )}

              {isHigher && (
                <>
                  <Label>{T("Degree / Course name", "ડિગ્રી / કોર્સનું નામ")} *</Label>
                  <CourseField
                    tree={occupationTree}
                    standard={nextStandard}
                    value={nextCourse}
                    onChange={(v) => {
                      setNextCourse(v);
                      setNextSpecialization("");
                    }}
                    lang={lang}
                    className={PICKER_CLASS}
                    scrollContainerRef={cardRef}
                  />
                </>
              )}

              {showSpecialization && (
                <>
                  <Label>{T("Specialization", "વિશેષતા")}</Label>
                  <SpecializationField
                    tree={occupationTree}
                    standard={nextStandard}
                    course={nextCourse}
                    value={nextSpecialization}
                    onChange={setNextSpecialization}
                    lang={lang}
                    className={PICKER_CLASS}
                    scrollContainerRef={cardRef}
                  />
                </>
              )}
            </>
          )}

          {error && (
            <div className="mt-3 rounded-[11px] border border-[#EFCED1] bg-[#FCE7E7] px-3 py-2.5 text-[12.5px] font-semibold text-[#B0303A]">
              {error}
            </div>
          )}

          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[13px] bg-gradient-to-br from-[#A62A38] to-[#7E1E29] px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : T("Save", "સેવ કરો")}
            </button>
            <button
              type="button"
              onClick={onSkip}
              disabled={busy}
              className="flex-1 cursor-pointer rounded-[13px] border-[1.5px] border-[#EDE4D4] bg-white px-4 py-2.5 text-[13.5px] font-bold text-[#6B6357] disabled:opacity-60"
            >
              {T("Decide later", "પછી નક્કી કરીશ")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 mb-1.5 text-[12px] font-bold text-[#8B8375]">{children}</div>;
}

// `[&>button]`, not `[&_button]` — this must land on the trigger only. A
// descendant selector also reaches into the open popup and re-skins the
// Add/Cancel buttons and the Gujarati field's mic/keyboard buttons as if
// they were the trigger (squashed into little bordered pills).
const PICKER_CLASS = cn(
  "[&>button]:h-11 [&>button]:rounded-[13px] [&>button]:border-[1.5px]",
  "[&>button]:border-[#EDE4D4] [&>button]:bg-[#FCFAF6] [&>button]:px-3.5",
  "[&>button]:text-[13.5px] [&>button]:font-semibold [&>button]:text-[var(--ink)]",
);
