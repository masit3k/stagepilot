type NavigateFn = (path: string) => void;

export function TopTabs({
  pathname,
  navigate,
}: {
  pathname: string;
  navigate: NavigateFn;
}) {
  const current = pathname.startsWith("/library")
    ? "library"
    : pathname.startsWith("/settings")
      ? "settings"
      : "projects";
  return (
    <nav className="top-tabs" aria-label="Primary">
      <button
        type="button"
        className={current === "projects" ? "button-secondary is-active" : "button-secondary"}
        onClick={() => navigate("/")}
      >
        Projects
      </button>
      <button
        type="button"
        className={current === "library" ? "button-secondary is-active" : "button-secondary"}
        onClick={() => navigate("/library")}
      >
        Library
      </button>
      <button
        type="button"
        className={current === "settings" ? "button-secondary is-active" : "button-secondary"}
        onClick={() => navigate("/settings")}
      >
        Settings
      </button>
    </nav>
  );
}

export function SettingsPage() {
  return (
    <section className="panel">
      <div className="panel__header panel__header--stack">
        <h2>Settings</h2>
        <p className="subtle">Settings will be available in a future update.</p>
      </div>
    </section>
  );
}

export function LibraryHomePage({ navigate }: { navigate: NavigateFn }) {
  const items = [
    ["Bands", "/library/bands"],
    ["Musicians", "/library/musicians"],
    ["Instruments", "/library/instruments"],
    ["Contacts", "/library/contacts"],
    ["Messages", "/library/messages"],
  ];
  return (
    <section className="panel">
      <div className="panel__header panel__header--stack">
        <h2>Library</h2>
        <p className="subtle">Manage reusable bands, musicians, instruments, contacts, and message templates.</p>
      </div>
      <div className="project-list">
        {items.map(([label, path]) => (
          <button key={path} type="button" className="project-card project-surface" onClick={() => navigate(path)}>
            <strong>{label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
