import { createRoot } from "react-dom/client";
import Root from "../Root";

export function renderRoot(container: HTMLElement | null) {
  if (!container) {
    throw new Error("Root container was not found.");
  }

  createRoot(container).render(<Root />);
}
