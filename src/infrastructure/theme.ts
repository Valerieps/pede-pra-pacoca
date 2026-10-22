// The theme (docs/spec/app-e-instalacao.md, "Navegação"): Claro, Escuro or Igual ao aparelho,
// remembered on this device only. The dark tokens apply under <html data-theme="dark"> (ADR-015).

export type ThemeChoice = 'system' | 'light' | 'dark';
export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

const KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The theme the page shows for a choice and the phone's own setting. */
export function resolveTheme(choice: ThemeChoice, deviceDark: boolean): 'light' | 'dark' {
  return choice === 'system' ? (deviceDark ? 'dark' : 'light') : choice;
}

export function readTheme(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(KEY);
    return THEME_CHOICES.includes(saved as ThemeChoice) ? (saved as ThemeChoice) : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(choice, window.matchMedia(DARK_QUERY).matches);
  // The system bars take the page background of the theme shown, not the phone's
  const background = getComputedStyle(root).getPropertyValue('--color-bg').trim();
  if (background) document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', background));
}

export function saveTheme(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice lasts until the app closes.
  }
  apply(choice);
}

/** Before the first render: shows the saved theme and follows the phone while it is "system". */
export function startTheme(): void {
  apply(readTheme());
  window.matchMedia(DARK_QUERY).addEventListener('change', () => apply(readTheme()));
}
