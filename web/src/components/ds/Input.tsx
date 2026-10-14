import { useId, type ChangeEvent, type KeyboardEvent } from 'react';

interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  error?: string;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
}

export function Input({ label, placeholder, value, onChange, onBlur, onKeyDown, error, type = 'text', min, max, step }: InputProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 font-sans">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`h-control-lg w-full md:h-control rounded-sm border bg-surface px-3 text-base text-text placeholder:text-text-muted focus:border-border-strong focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring ${error ? 'border-danger' : 'border-border'}`}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
