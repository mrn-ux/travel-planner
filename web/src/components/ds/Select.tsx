import { useId, type ChangeEvent } from 'react';

interface SelectProps {
  label?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  options?: string[];
  disabled?: boolean;
  /** Text shown for an option instead of its value, when it has one. */
  labels?: Record<string, string>;
}

export function Select({ label, value, onChange, options = [], labels, disabled = false }: SelectProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 font-sans">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`h-control-lg w-full md:h-control rounded-sm border border-border ${disabled ? 'bg-surface-muted text-text-secondary cursor-not-allowed' : 'bg-surface text-text'} px-3 text-base focus:border-border-strong focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring`}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}
