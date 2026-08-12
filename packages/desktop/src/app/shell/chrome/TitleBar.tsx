import { BrandMark } from "../../../components/ui/BrandMark";
import { WindowControls } from "./WindowControls";
import {
  type TitleBarProject,
  hasNativeWindowApi,
  titleBarProjectLabel,
} from "./windowChrome";

/**
 * The window's own title bar, which replaced the native decorations.
 *
 * Tauri's drag region matches the element the pointer actually hits, so the bar
 * carries the attribute and everything inside it is `pointer-events: none` in
 * CSS — otherwise a drag started on the app name would do nothing. The controls
 * put their pointer events back.
 */
export function TitleBar({
  pathname,
  projects,
}: {
  pathname: string;
  projects: readonly TitleBarProject[];
}) {
  const projectLabel = titleBarProjectLabel(pathname, projects);

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar__identity">
        {/* 22px rather than the handoff's 18px. At 18 the mark stops being
            legible: the ring stroke (6 of 64 units) and the pins (r 5.5) both
            fall under 2px, so the ring reads as a grey band and the two lower
            pins dissolve into it. 22px is the smallest size where all three pins
            separate from the ring — verified by rasterising the mark at 18, 20
            and 22px and comparing the pixels, not the vectors. The geometry is
            untouched, only the size.

            Hidden from assistive tech: the mark's own label would repeat the app
            name printed right next to it. */}
        <span className="titlebar__mark" aria-hidden="true">
          <BrandMark size={22} />
        </span>
        <span className="titlebar__app">StagePilot</span>
        {projectLabel === null ? null : (
          <span className="titlebar__project">{projectLabel}</span>
        )}
      </div>
      {hasNativeWindowApi() ? <WindowControls /> : null}
    </header>
  );
}
