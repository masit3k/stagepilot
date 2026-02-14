import { shellNavItems } from "./nav";

type NavigateFn = (path: string) => void;

export function Header({ pathname, navigate }: { pathname: string; navigate: NavigateFn }) {
  const current = pathname.startsWith("/library")
    ? "library"
    : pathname.startsWith("/settings")
      ? "settings"
      : "projects";

  return (
    <nav className="top-tabs" aria-label="Primary">
      {shellNavItems.map((item) => (
        <button
          key={item.path}
          type="button"
          className={current === item.id ? "button-secondary is-active" : "button-secondary"}
          onClick={() => navigate(item.path)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
