/**
 * Runs the save behind "Save & Create" / "Save & Continue".
 *
 * The committing flag stays set after a successful save on purpose: the page
 * navigates away next and the flag keeps the unsaved-changes guard quiet until
 * it unmounts. A failed save releases the flag and hands the error to the
 * page, so the form stays usable and the failure is visible.
 */
export async function commitProjectSave(args: {
  persist: () => Promise<unknown>;
  setIsCommitting: (value: boolean) => void;
  onError: (error: unknown) => void;
}): Promise<boolean> {
  args.setIsCommitting(true);
  try {
    await args.persist();
    return true;
  } catch (error) {
    args.setIsCommitting(false);
    args.onError(error);
    return false;
  }
}
