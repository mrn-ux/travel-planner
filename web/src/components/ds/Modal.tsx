import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
}

export function Modal({ title, children, actions, onClose }: ModalProps) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-modal-backdrop p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-modal rounded-lg bg-surface p-8 font-sans shadow-modal"
      >
        {title && <div className="mb-4 font-display text-lg font-semibold text-text">{title}</div>}
        <div className="text-sm text-text">{children}</div>
        {actions && <div className="mt-6 flex justify-end gap-3">{actions}</div>}
      </div>
    </div>
  );
}
