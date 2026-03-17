export function resolveTalkbackSummaryLabel(ownerName: string | undefined): string {
  return ownerName && ownerName.length > 0 ? ownerName : "Not selected";
}
