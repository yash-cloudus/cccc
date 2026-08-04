/**
 * FamilyMember columns a member may request a change to via ProfileUpdateRequest.
 * Shared by the submission endpoint (`/api/profile/update-request`) and the
 * admin apply endpoint (`/api/admin/update-requests`) so the two ends of the
 * approval flow can never drift apart.
 */
export const APPLIABLE_MEMBER_FIELDS = new Set([
  "fullNameEn",
  "fullNameGu",
  "relation",
  "mobile",
  "dateOfBirth",
  "occupation",
  "occupationOther",
  "education",
  "course",
  "specialization",
  "currentlyAt",
  "bloodGroup",
  "hasWhatsApp",
  "showPhone",
]);

/** Human label for each field, shown in the admin's diff review. */
export const MEMBER_FIELD_LABELS: Record<string, string> = {
  fullNameEn: "Full name (English)",
  fullNameGu: "Full name (Gujarati)",
  relation: "Relation",
  mobile: "Mobile",
  dateOfBirth: "Birth date",
  occupation: "Occupation",
  occupationOther: "Business / job",
  education: "Education",
  course: "Course",
  specialization: "Specialization",
  currentlyAt: "Currently at",
  bloodGroup: "Blood group",
};

/**
 * Coerce a change's stored string value into the FamilyMember column type.
 * ProfileUpdateRequest.changes serializes everything as strings; without this,
 * applying hasWhatsApp/showPhone/dateOfBirth would write a string into a
 * Boolean/DateTime column and fail at the Prisma layer.
 */
export function coerceMemberFieldValue(
  field: string,
  to: string | null,
): string | boolean | Date | null {
  if (field === "hasWhatsApp" || field === "showPhone") return to === "true";
  if (field === "dateOfBirth") return to ? new Date(to) : null;
  return to;
}
