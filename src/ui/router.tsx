// A tiny router over the History API: the app has a handful of screens and no router dependency.
import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

const listeners = new Set<() => void>();

export function navigate(path: string, options: { replace?: boolean } = {}): void {
  // The screen I leave travels with the new entry, so a detail screen knows which tab it was opened from.
  const state = { from: window.location.pathname };
  if (options.replace) window.history.replaceState(state, '', path);
  else window.history.pushState(state, '', path);
  listeners.forEach((l) => l());
}

export function usePath(): string {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return path;
}

/** The path I came from in this app, when the browser entry remembers it. */
export function cameFrom(): string | null {
  const from = (window.history.state as { from?: unknown } | null)?.from;
  return typeof from === 'string' ? from : null;
}

export function Link({ to, ...rest }: { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  };
  return <a {...rest} href={to} onClick={onClick} />;
}
