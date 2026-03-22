export type FormatVocalLabelArgs = {
  role: "lead" | "back";
  index: number;
  gender?: string;
  roleCount: number;
  genderMode?: "include" | "omit";
};

function normalizeGenderLabel(gender: string): string {
  if (gender === "m") return "male";
  if (gender === "f") return "female";
  return gender;
}

export function formatVocalLabel({
  role,
  index,
  gender,
  roleCount,
  genderMode = "include",
}: FormatVocalLabelArgs): string {
  const base = role === "lead" ? "Lead vocal" : "Back vocal";

  const showGender = genderMode === "include" && gender && gender !== "x";
  const genderSuffix = showGender ? ` (${normalizeGenderLabel(gender)})` : "";
  const safeIndex = Number.isFinite(index) && index > 0 ? index : 1;

  if (role === "lead" && roleCount === 1) return base;
  if (role === "back" && roleCount === 1) return `${base}${genderSuffix}`;
  if (roleCount <= 0) return `${base} ${safeIndex}${genderSuffix}`;

  return `${base} ${safeIndex}${genderSuffix}`;
}
