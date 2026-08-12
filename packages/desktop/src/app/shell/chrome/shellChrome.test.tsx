import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "../../providers/ThemeProvider";
import { ShellNav } from "./ShellNav";
import { TitleBar } from "./TitleBar";

const PROJECTS = [
  { id: "p1", displayName: "Friday Night Band – 22.08.2026 – Bon Repos" },
];

function renderNav(pathname: string): string {
  return renderToStaticMarkup(
    <ThemeProvider>
      <ShellNav
        pathname={pathname}
        navigate={() => undefined}
        onOpenAbout={() => undefined}
      />
    </ThemeProvider>,
  );
}

describe("shell chrome where the Tauri bridge is absent", () => {
  it("names the open project in the title bar", () => {
    const html = renderToStaticMarkup(
      <TitleBar pathname="/projects/p1/setup" projects={PROJECTS} />,
    );
    expect(html).toContain("Friday Night Band – 22.08.2026 – Bon Repos");
  });

  it("leaves out the window controls, which could not work anyway", () => {
    const html = renderToStaticMarkup(
      <TitleBar pathname="/projects/p1/setup" projects={PROJECTS} />,
    );
    expect(html).not.toContain('aria-label="Close"');
  });

  it("marks the section the route belongs to", () => {
    expect(renderNav("/library/bands")).toContain('aria-current="page"');
  });

  it("shows all four steps inside a project", () => {
    const html = renderNav("/projects/p1/setup");
    for (const label of ["LINEUP", "INPUTS", "STAGE PLAN", "EXPORT"]) {
      expect(html, label).toContain(label);
    }
  });

  it("drops the trail outside a project", () => {
    expect(renderNav("/library")).not.toContain("STAGE PLAN");
  });
});
