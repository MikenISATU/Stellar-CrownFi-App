// Pageant approval workflow — shared constants + helpers.

export const PAGEANT_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  IN_REVIEW: "in_review",
  REQUIRES_CHANGES: "requires_changes",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type PageantStatus = (typeof PAGEANT_STATUS)[keyof typeof PAGEANT_STATUS];

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In Review",
  requires_changes: "Requires Changes",
  approved: "Approved",
  rejected: "Rejected",
};

// Tailwind chip classes per status (light theme).
export const STATUS_CHIP: Record<string, string> = {
  draft: "bg-[#f1eee4] text-[#6b6552]",
  submitted: "bg-[#e6eefb] text-[#2c4a80]",
  in_review: "bg-[#faf0d2] text-[#8a6d1f]",
  requires_changes: "bg-[#fbeede] text-[#9a5a12]",
  approved: "bg-[#e1f5ee] text-[#0f6e56]",
  rejected: "bg-[#fbe9ef] text-[#9f1239]",
};

// Who may move a pageant to a given status.
export function canOrganizerSubmit(status: string): boolean {
  return status === "draft" || status === "requires_changes";
}
export function isEditableByOrganizer(status: string): boolean {
  return status === "draft" || status === "requires_changes";
}
export function isAdminActionable(status: string): boolean {
  return status === "submitted" || status === "in_review";
}

// URL-safe slug from a title (used for the pageant route + asset folder).
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "pageant";
}
