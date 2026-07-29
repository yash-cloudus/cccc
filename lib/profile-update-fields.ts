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
  "occupation",
  "occupationOther",
  "education",
  "course",
  "currentlyAt",
  "bloodGroup",
  "hasWhatsApp",
  "showPhone",
]);

/** Human label for each field, shown in the admin's diff review. */
export const MEMBER_FIELD_LABELS: Record<string, string> = {
  fullNameEn: "Full name (English)",
  fullNameGu: "Full name (Gujarati)",
  mobile: "Mobile",
  occupation: "Occupation",
  occupationOther: "Business / job",
  education: "Education",
  course: "Course",
  currentlyAt: "Currently at",
  bloodGroup: "Blood group",
};
