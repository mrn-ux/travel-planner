export const THEMES = [
  { id: 'ocean', label: 'Ocean' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'forest', label: 'Forest' },
  { id: 'violet', label: 'Violet' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

const KEY = 'faro.theme';

/** The saved colour theme (ocean when none was chosen or storage is unavailable). */
export function getTheme(): ThemeId {
  try {
    const t = localStorage.getItem(KEY);
    if (THEMES.some((x) => x.id === t)) return t as ThemeId;
  } catch {
    /* storage unavailable */
  }
  return 'ocean';
}

/** Apply a theme to the whole page and remember it. */
export function setTheme(id: ThemeId): void {
  document.documentElement.setAttribute('data-theme', id);
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* the theme still applies for this visit */
  }
}
