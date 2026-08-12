import { describe, expect, it } from "vitest";
import {
  DISMISS_AFTER_MS,
  MAX_VISIBLE,
  type Toast,
  appendToast,
  removeToast,
} from "./toastQueue";

const toast = (id: number, message = `message ${id}`): Toast => ({
  id,
  kind: "info",
  message,
});

describe("appendToast", () => {
  it("adds to the end so the newest toast is last", () => {
    const result = appendToast([toast(1)], toast(2));

    expect(result.toasts.map((t) => t.id)).toEqual([1, 2]);
    expect(result.evicted).toEqual([]);
  });

  it("caps the queue and reports what fell off", () => {
    const full = [toast(1), toast(2), toast(3)];

    const result = appendToast(full, toast(4));

    expect(result.toasts.map((t) => t.id)).toEqual([2, 3, 4]);
    // The caller needs these to clear timers that would otherwise fire against
    // an id no longer on screen.
    expect(result.evicted).toEqual([1]);
  });

  it("evicts every overflowing toast when the queue starts over the cap", () => {
    const over = [toast(1), toast(2), toast(3), toast(4)];

    const result = appendToast(over, toast(5));

    expect(result.toasts).toHaveLength(MAX_VISIBLE);
    expect(result.toasts.map((t) => t.id)).toEqual([3, 4, 5]);
    expect(result.evicted).toEqual([1, 2]);
  });

  it("does not mutate the queue it was given", () => {
    const original = [toast(1)];

    appendToast(original, toast(2));

    expect(original.map((t) => t.id)).toEqual([1]);
  });

  it("honours a custom cap", () => {
    const result = appendToast([toast(1)], toast(2), 1);

    expect(result.toasts.map((t) => t.id)).toEqual([2]);
    expect(result.evicted).toEqual([1]);
  });
});

describe("removeToast", () => {
  it("drops the matching id and keeps the order of the rest", () => {
    const result = removeToast([toast(1), toast(2), toast(3)], 2);

    expect(result.map((t) => t.id)).toEqual([1, 3]);
  });

  it("is a no-op for an id that is not present", () => {
    const result = removeToast([toast(1)], 99);

    expect(result.map((t) => t.id)).toEqual([1]);
  });
});

describe("DISMISS_AFTER_MS", () => {
  it("keeps errors on screen longer than confirmations", () => {
    expect(DISMISS_AFTER_MS.error).toBeGreaterThan(DISMISS_AFTER_MS.success);
    expect(DISMISS_AFTER_MS.error).toBeGreaterThan(DISMISS_AFTER_MS.info);
  });
});
