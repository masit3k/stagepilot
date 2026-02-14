import type { Group } from "../../../../../src/domain/model/groups";

type SetupMusicianItem = {
  slotKey: string;
  musicianId: string;
  musicianName: string;
  role: Group;
  hasOverride: boolean;
};

type MusicianSelectorProps = {
  items: SetupMusicianItem[];
  selectedSlotKey: string;
  onSelect: (slotKey: string) => void;
};

export function MusicianSelector({ items, selectedSlotKey, onSelect }: MusicianSelectorProps) {
  if (items.length <= 1) return null;
  return (
    <aside className="setup-musician-selector" aria-label="Musician selector">
      {items.map((item) => (
        <button
          key={item.slotKey}
          type="button"
          className={item.slotKey === selectedSlotKey ? "setup-musician-selector__item setup-musician-selector__item--active" : "setup-musician-selector__item"}
          onClick={() => onSelect(item.slotKey)}
        >
          <span>{item.musicianName}</span>
          {item.hasOverride ? <span className="setup-badge setup-badge--override">Overridden</span> : null}
        </button>
      ))}
    </aside>
  );
}

export type { SetupMusicianItem };
