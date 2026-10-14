import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface NavItemProps {
  active?: boolean;
  /** Internal route. Omit for a plain clickable item (for example a tab). */
  to?: string;
  onClick?: () => void;
  large?: boolean;
  children: ReactNode;
}

export function NavItem({ active = false, to, onClick, large = false, children }: NavItemProps) {
  const cls = [
    'inline-flex items-center whitespace-nowrap rounded-md px-3 font-sans text-sm font-medium no-underline cursor-pointer transition-colors duration-150',
    large ? 'py-3' : 'py-2',
    active ? 'bg-accent-soft text-accent' : 'text-text-secondary hover:text-text',
  ].join(' ');
  if (to) {
    return (
      <Link to={to} className={cls} aria-current={active ? 'page' : undefined} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}
