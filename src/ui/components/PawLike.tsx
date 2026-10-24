// Curtir as a paw, "patinha" (docs/spec/feed.md, "Curtidas"): cherry when liked, and a short pop
// on every tap, which stands still with reduced motion (the CSS takes care of that).
import { useState } from 'react';
import { strings } from '../../domain/strings';

/** The paw itself, also the icon of "farejando mídias" (docs/spec/estatisticas.md). */
export function PawGlyph({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 12.5c-3 0-5.5 3.2-5.5 5.5 0 1.7 1.4 2.5 3 2.5 1 0 1.7-.5 2.5-.5s1.5.5 2.5.5c1.6 0 3-.8 3-2.5 0-2.3-2.5-5.5-5.5-5.5z" />
      <ellipse cx="5" cy="10" rx="1.9" ry="2.4" />
      <ellipse cx="9.2" cy="5.8" rx="2" ry="2.6" />
      <ellipse cx="14.8" cy="5.8" rx="2" ry="2.6" />
      <ellipse cx="19" cy="10" rx="1.9" ry="2.4" />
    </svg>
  );
}

export function PawLike({ liked, disabled, onToggle }: { liked: boolean; disabled: boolean; onToggle: () => void }) {
  // A new key restarts the pop on every tap.
  const [taps, setTaps] = useState(0);
  const label = liked ? strings.feed.unlike : strings.feed.like;
  return (
    <button
      type="button"
      className="paw-like"
      aria-pressed={liked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => {
        setTaps(taps + 1);
        onToggle();
      }}
    >
      <PawGlyph key={taps} className={taps > 0 ? 'paw paw-pop' : 'paw'} />
    </button>
  );
}
