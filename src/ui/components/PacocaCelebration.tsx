import { useEffect, type ReactNode } from 'react';
import { strings } from '../../domain/strings';
import { PacocaArt } from './PacocaArt';

// The Paçoca animation when I confirm a request and when I get an Atendido
// (docs/spec/identidade.md). The real animation arrives later; until then the placeholder hops, so
// swapping it in touches PacocaArt and its styles only. With reduced motion it stands still.
// On a phone it sits in the page; on a computer the CSS opens it as a centered card over a dimmed
// backdrop, where `onClose` adds "Fechar", Esc and a click outside.
export function PacocaCelebration({ text, children, onClose }: { text: string; children?: ReactNode; onClose?: () => void }) {
  useEffect(() => {
    if (!onClose) return;
    const close = onClose;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="celebration-layer" onClick={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className="celebration">
        <div className="celebration-pacoca">
          <PacocaArt large glyph="🐶" />
        </div>
        <p className="celebration-text pacoca-line" role="status">
          {text}
        </p>
        {children}
        {onClose && (
          <button type="button" className="ghost celebration-close" onClick={onClose}>
            {strings.close}
          </button>
        )}
      </div>
    </div>
  );
}
