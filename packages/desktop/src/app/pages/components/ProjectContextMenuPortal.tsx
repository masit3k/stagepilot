import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ProjectSummary } from "../../shell/types";

export function ProjectContextMenuPortal({
  project,
  projectLabel,
  onClose,
  children,
}: {
  project: ProjectSummary;
  projectLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const anchor = document.querySelector<HTMLButtonElement>(
      `[aria-controls="project-menu-${project.id}"]`,
    );
    anchorRef.current = anchor;

    const margin = 8;
    const offset = 6;
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    const update = () => {
      const anchorRect = anchorRef.current?.getBoundingClientRect();
      const menuRect = menuRef.current?.getBoundingClientRect();
      if (!anchorRect || !menuRect) return;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const preferredTop = anchorRect.bottom + offset;
      const top =
        preferredTop + menuRect.height + margin <= viewportHeight
          ? preferredTop
          : Math.max(margin, anchorRect.top - menuRect.height - offset);
      const centeredLeft = anchorRect.left + anchorRect.width / 2 - menuRect.width / 2;
      const left = clamp(centeredLeft, margin, viewportWidth - menuRect.width - margin);
      setPosition({ top, left });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [project.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="project-context-menu-shell"
      role="dialog"
      aria-label={`${projectLabel} actions`}
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <div id={`project-menu-${project.id}`} className="project-context-menu" ref={menuRef}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
