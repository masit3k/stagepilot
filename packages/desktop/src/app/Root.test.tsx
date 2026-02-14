import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("./router/Router", () => ({
  AppRouter: () => <div data-testid="router-stub" />, 
}));

vi.mock("../components/ui/Modal", () => ({
  ModalHost: () => null,
}));

import Root from "./Root";

describe("Root", () => {
  it("renders without throwing", () => {
    expect(() => renderToString(<Root />)).not.toThrow();
  });
});
