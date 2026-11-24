import { describe, expect, it } from "vitest";
import { commitProjectSave } from "./commitProjectSave";

function createRecorder() {
  const committing: boolean[] = [];
  const errors: unknown[] = [];
  return {
    committing,
    errors,
    setIsCommitting: (value: boolean) => {
      committing.push(value);
    },
    onError: (error: unknown) => {
      errors.push(error);
    },
  };
}

describe("commitProjectSave", () => {
  it("reports a failed save and releases the committing flag", async () => {
    const recorder = createRecorder();
    const failure = new Error("disk full");

    const saved = await commitProjectSave({
      persist: () => Promise.reject(failure),
      setIsCommitting: recorder.setIsCommitting,
      onError: recorder.onError,
    });

    expect(saved).toBe(false);
    expect(recorder.errors).toEqual([failure]);
    expect(recorder.committing).toEqual([true, false]);
  });

  it("keeps the committing flag set after a successful save", async () => {
    const recorder = createRecorder();

    const saved = await commitProjectSave({
      persist: () => Promise.resolve("p-1"),
      setIsCommitting: recorder.setIsCommitting,
      onError: recorder.onError,
    });

    expect(saved).toBe(true);
    expect(recorder.errors).toEqual([]);
    expect(recorder.committing).toEqual([true]);
  });

  it("does not let a failed save escape as a rejection", async () => {
    const recorder = createRecorder();

    await expect(
      commitProjectSave({
        persist: () => Promise.reject("tauri error string"),
        setIsCommitting: recorder.setIsCommitting,
        onError: recorder.onError,
      }),
    ).resolves.toBe(false);
  });
});
