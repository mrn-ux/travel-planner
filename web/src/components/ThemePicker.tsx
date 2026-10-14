import { useState } from 'react';
import { getTheme, setTheme, THEMES, type ThemeId } from '../lib/theme';

/** Four colour dots: choosing one recolours the whole app and is remembered on this device. */
export function ThemePicker() {
  const [current, setCurrent] = useState<ThemeId>(getTheme());
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Colour theme">
      {THEMES.map((t) => (
        // The data-theme on each dot makes its bg-accent show that theme's own colour.
        <button
          key={t.id}
          type="button"
          data-theme={t.id}
          title={`${t.label} theme`}
          aria-label={`${t.label} theme`}
          aria-pressed={current === t.id}
          onClick={() => {
            setTheme(t.id);
            setCurrent(t.id);
          }}
          className={`size-swatch cursor-pointer rounded-full border-0 bg-accent p-0 transition-transform hover:scale-110 ${current === t.id ? 'outline outline-2 outline-offset-2 outline-text' : ''}`}
        />
      ))}
    </div>
  );
}
