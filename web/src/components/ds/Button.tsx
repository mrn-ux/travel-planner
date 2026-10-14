import type { ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const base =
  'inline-flex h-control-lg shrink-0 md:h-control items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent px-4 font-sans text-sm font-medium cursor-pointer transition-all duration-150 active:scale-95';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white shadow-raised hover:bg-accent-hover hover:shadow-overlay',
  secondary: 'border-accent bg-accent-soft text-accent hover:bg-accent hover:text-white',
  ghost: 'bg-transparent font-semibold text-text hover:bg-surface-muted',
  danger: 'bg-danger text-white',
};

interface ButtonProps {
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  disabled = false,
  type = 'button',
  onClick,
  fullWidth = false,
  children,
}: ButtonProps) {
  const cls = [
    base,
    variants[variant],
    fullWidth ? 'w-full' : '',
    disabled ? 'pointer-events-none opacity-40' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
