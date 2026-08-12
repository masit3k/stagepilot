import { Page } from "../layout/Page";

type NavigateFn = (path: string) => void;

export function LibraryHomePage({ navigate }: { navigate: NavigateFn }) {
  const items = [
    ["Bands", "/library/bands"],
    ["Musicians", "/library/musicians"],
    ["Instruments", "/library/instruments"],
    ["Contacts", "/library/contacts"],
    ["Messages", "/library/messages"],
  ];

  return (
    <Page title="Library" description="Manage reusable bands, musicians, instruments, contacts, and message templates.">
      <div className="project-list">
        {items.map(([label, path]) => (
          <button key={path} type="button" className="project-card project-surface" onClick={() => navigate(path)}>
            <strong>{label}</strong>
          </button>
        ))}
      </div>
    </Page>
  );
}
