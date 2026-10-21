// Sharing to the app on Android (docs/spec/app-e-instalacao.md, "Compartilhar para o app").
// The manifest's share_target opens /compartilhar?url=…&text=…&title=…; the app reads the shared
// text once, moves to /pedir without the query (so the text leaves the address bar and the
// history) and keeps the text for this tab until the Pedir screen takes it. The tab's storage
// lets the text survive the Google sign-in round trip.

export const SHARE_PATH = '/compartilhar';
export const ASK_PATH = '/pedir';

/** Longer text is cut: only a link is wanted, and the field it feeds is short. */
export const MAX_SHARED_LENGTH = 1000;

const PENDING_KEY = 'pending-share';

/**
 * The text an Android share brought. Apps put the link in `url`, in `text` or in both, so all
 * three fields are kept, the link first; parseSharedLink then finds it anywhere in the text.
 */
export function sharedTextFrom(search: string): string | null {
  const params = new URLSearchParams(search);
  const parts: string[] = [];
  for (const name of ['url', 'text', 'title']) {
    const value = params.get(name)?.trim();
    if (value && !parts.includes(value)) parts.push(value);
  }
  const text = parts.join(' ').slice(0, MAX_SHARED_LENGTH).trim();
  return text || null;
}

export interface ShareEnvironment {
  readonly location: { readonly pathname: string; readonly search: string };
  replaceUrl(path: string): void;
  readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
}

let memory: string | null = null;

/**
 * Run once at startup. On the share route, keeps the shared text and replaces the address with
 * /pedir. Returns whether a share arrived (even an empty one, which the Pedir screen explains).
 */
export function captureShare(env: ShareEnvironment): boolean {
  if (env.location.pathname !== SHARE_PATH) return false;
  // An empty share still opens Pedir with the "não reconheci" message.
  const text = sharedTextFrom(env.location.search) ?? '';
  memory = text;
  try {
    env.storage?.setItem(PENDING_KEY, text);
  } catch {
    // Blocked storage: the text lives in memory, enough unless the sign-in reloads the page.
  }
  env.replaceUrl(ASK_PATH);
  return true;
}

/** The shared text waiting for the Pedir screen, or null when there is none. */
export function pendingShare(env: Pick<ShareEnvironment, 'storage'>): string | null {
  if (memory !== null) return memory;
  try {
    return env.storage?.getItem(PENDING_KEY) ?? null;
  } catch {
    return null;
  }
}

export function clearPendingShare(env: Pick<ShareEnvironment, 'storage'>): void {
  memory = null;
  try {
    env.storage?.removeItem(PENDING_KEY);
  } catch {
    // Nothing to clear.
  }
}

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function browserShareEnvironment(): ShareEnvironment {
  return {
    location: window.location,
    replaceUrl: (path) => window.history.replaceState(null, '', path),
    storage: safeSessionStorage(),
  };
}
