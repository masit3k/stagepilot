export type FormatVocalLabelArgs = {
  role: "lead";
  index: number;
  gender?: string;
  leadCount: number;
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
  leadCount,
  genderMode = "include",
}: FormatVocalLabelArgs): string {
  const base = role === "lead" ? "Lead vocal" : "Vocal";

  if (role === "lead" && leadCount <= 1) {
    return base;
  }

  const showGender = genderMode === "include" && gender && gender !== "x";
  const genderSuffix = showGender ? ` (${normalizeGenderLabel(gender)})` : "";
  return `${base} ${index}${genderSuffix}`;
}
