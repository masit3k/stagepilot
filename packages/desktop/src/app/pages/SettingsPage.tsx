import { Page } from "../../layout/Page";
import type { ThemePreference } from "../providers/theme";
import { useTheme } from "../providers/useTheme";

const THEME_OPTIONS: readonly {
  value: ThemePreference;
  label: string;
  hint: string;
}[] = [
  {
    value: "light",
    label: "Light",
    hint: "Always light, whatever Windows uses.",
  },
  { value: "dark", label: "Dark", hint: "Always dark, whatever Windows uses." },
  { value: "system", label: "System", hint: "Follow the Windows setting." },
];

/**
 * The only setting so far is the theme, and it is here because it has three
 * states while the toggle in the shell has two — this is the only place the
 * "follow the system" option can be chosen again once it has been left.
 */
export function SettingsPage() {
  const { preference, setPreference } = useTheme();

  return (
    <Page title="Settings" description="Application preferences.">
      <section className="settings-section">
        <h3 className="settings-section__title">Appearance</h3>
        <fieldset className="settings-choice">
          <legend className="settings-choice__legend">Theme</legend>
          {THEME_OPTIONS.map((option) => (
            <label key={option.value} className="settings-choice__option">
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={preference === option.value}
                onChange={() => setPreference(option.value)}
              />
              <span className="settings-choice__label">{option.label}</span>
              <span className="settings-choice__hint">{option.hint}</span>
            </label>
          ))}
        </fieldset>
      </section>
    </Page>
  );
}
