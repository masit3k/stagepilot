export type FormatVocalLabelArgs = {
  role: "lead";
  index: number;
  gender?: string;
  leadCount: number;
  genderMode?: "include" | "omit";
};

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
  const genderSuffix = showGender ? ` (${gender})` : "";
  return `${base} ${index}${genderSuffix}`;
}
