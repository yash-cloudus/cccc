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
import { Loader2 } from "lucide-react";
import { PickerWithAdd } from "@/components/ui/picker-with-add";
import { DEFAULT_STREAMS, EDUCATION_LEVELS } from "@/lib/occupation-defaults";
import { HIGHER_STANDARDS, STREAM_STANDARDS, type StudyOutcome } from "@/lib/result-drive";
import { cn } from "@/lib/utils";

export type NextStandardValue = {
  studyOutcome: StudyOutcome;
  nextStandard: string | null;
  nextStream: string | null;
  nextCourse: string | null;
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

export function NextStandardModal({
  studentName,
  initial,
  onSkip,
  onConfirm,
  busy = false,
  lang = "en",
}: {
  studentName: string;
  initial?: Partial<NextStandardValue> | null;
  onSkip: () => void;
  onConfirm: (value: NextStandardValue) => void;
  busy?: boolean;
  lang?: "en" | "gu";
}) {
  const T = (en: string, gu: string) => (lang === "gu" ? gu : en);
  // This modal is its own small scrollable popup — passed to PickerWithAdd
  // so its open-up/open-down decision is measured against the card, not the
  // full viewport, or the option list opens downward straight over the
  // Save / Decide later row instead of flipping up.
  const cardRef = useRef<HTMLDivElement>(null);

  const [outcome, setOutcome] = useState<StudyOutcome | "">(initial?.studyOutcome ?? "");
  const [nextStandard, setNextStandard] = useState(initial?.nextStandard ?? "");
  const [nextStream, setNextStream] = useState(initial?.nextStream ?? "");
  const [nextCourse, setNextCourse] = useState(initial?.nextCourse ?? "");
  const [error, setError] = useState<string | null>(null);

  const showStream = STREAM_STANDARDS.has(nextStandard);
  const isHigher = HIGHER_STANDARDS.has(nextStandard);

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
              <PickerWithAdd
                value={nextStandard}
                onChange={(v) => {
                  setNextStandard(v);
                  setNextStream("");
                  setNextCourse("");
                }}
                placeholder={T("Select…", "પસંદ કરો…")}
                options={EDUCATION_LEVELS.map((l) => ({
                  value: l.nameEn,
                  label: lang === "gu" ? l.nameGu : l.nameEn,
                }))}
                className={PICKER_CLASS}
                scrollContainerRef={cardRef}
              />

              {showStream && (
                <>
                  <Label>{T("Stream", "પ્રવાહ")} *</Label>
                  <PickerWithAdd
                    value={nextStream}
                    onChange={setNextStream}
                    placeholder={T("Select…", "પસંદ કરો…")}
                    options={DEFAULT_STREAMS.map((s) => ({
                      value: s.nameEn,
                      label: lang === "gu" ? `${s.nameGu} (${s.nameEn})` : s.nameEn,
                    }))}
                    className={PICKER_CLASS}
                    scrollContainerRef={cardRef}
                  />
                </>
              )}

              {isHigher && (
                <>
                  <Label>{T("Degree / Course name", "ડિગ્રી / કોર્સનું નામ")} *</Label>
                  <input
                    value={nextCourse}
                    onChange={(e) => setNextCourse(e.target.value)}
                    placeholder={T("e.g. B.Com, Mechanical Engineering", "દા.ત. B.Com, મિકેનિકલ એન્જિનિયરિંગ")}
                    className={FIELD}
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

const FIELD =
  "w-full h-11 rounded-[13px] border-[1.5px] border-[#EDE4D4] bg-[#FCFAF6] px-3.5 text-[13.5px] font-semibold text-[var(--ink)] outline-none";

const PICKER_CLASS = cn(
  "[&_button]:h-11 [&_button]:rounded-[13px] [&_button]:border-[1.5px]",
  "[&_button]:border-[#EDE4D4] [&_button]:bg-[#FCFAF6] [&_button]:px-3.5",
  "[&_button]:text-[13.5px] [&_button]:font-semibold [&_button]:text-[var(--ink)]",
);
