import { describe, expect, it } from "vitest";
import { activeNavId } from "./navItems";

describe("activeNavId", () => {
  it("lights Library across the whole library section", () => {
    expect(activeNavId("/library")).toBe("library");
    expect(activeNavId("/library/bands")).toBe("library");
    expect(activeNavId("/library/bands/b1")).toBe("library");
  });

  it("lights Settings on the settings route", () => {
    expect(activeNavId("/settings")).toBe("settings");
  });

  it("lights Projects on the hub and on every project route", () => {
    expect(activeNavId("/")).toBe("projects");
    expect(activeNavId("/projects/new")).toBe("projects");
    expect(activeNavId("/projects/p1/setup")).toBe("projects");
    expect(activeNavId("/projects/p1/preview")).toBe("projects");
  });

  it("lights Projects on a route it does not know", () => {
    // A dead route should still leave the shell in a sane state.
    expect(activeNavId("/nonsense")).toBe("projects");
  });
});
