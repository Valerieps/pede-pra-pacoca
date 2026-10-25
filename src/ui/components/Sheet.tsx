import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A sheet over the screen, from the bottom on a phone: the native modal dialog, so the focus stays
 * inside and Esc closes it. Tapping the backdrop closes it too. The parent unmounts it on close.
 */
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {/* The dialog has no padding, so a tap on it and not on the body is a tap on the backdrop */}
      <div className="sheet-body">{children}</div>
    </dialog>
  );
}
