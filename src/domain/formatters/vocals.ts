export type FormatVocalLabelArgs = {
  role: "lead";
  index: number;
  gender?: string;
  leadCount: number;
  genderMode?: "include" | "omit";
  multiLeadStyle?: "legacy_parentheses" | "input_list_upper_suffix";
};

export function formatVocalLabel({
  role,
  index,
  gender,
  leadCount,
  genderMode = "include",
  multiLeadStyle = "legacy_parentheses",
}: FormatVocalLabelArgs): string {
  const base = role === "lead" ? "Lead vocal" : "Vocal";

  if (role === "lead" && leadCount <= 1) {
    return base;
  }

  const showGender = genderMode === "include" && gender && gender !== "x";
  if (showGender && multiLeadStyle === "input_list_upper_suffix") {
    const marker = gender === "m" ? "MALE" : gender === "f" ? "FEMALE" : gender.toUpperCase();
    return `${base} ${index} ${marker}`;
  }

  const genderSuffix = showGender ? ` (${gender})` : "";
  return `${base} ${index}${genderSuffix}`;
}
