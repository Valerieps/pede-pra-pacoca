// A member's notification preferences (docs/spec/notificacoes.md): which types are on, how an
// attendant gets new requests, and the quiet hours. Stored as JSON; anything missing or invalid
// falls back to the default, so old rows keep working when a preference is added.
import { CONFIGURABLE_TYPES, type ConfigurableType } from './types';

export type NewRequestsMode = 'immediate' | 'digest';

export interface QuietHours {
  /** Local time in the group's time zone, "HH:MM". */
  readonly start: string;
  readonly end: string;
}

export interface NotificationPrefs {
  readonly enabled: Readonly<Record<ConfigurableType, boolean>>;
  readonly newRequests: NewRequestsMode;
  /** When the attendant's daily digest goes out, "HH:MM" local. */
  readonly digestTime: string;
  /** Null: no quiet hours. */
  readonly quietHours: QuietHours | null;
}

/** "Petiscos mensais renovados" starts off; everything else starts on. */
const DEFAULT_ENABLED = Object.fromEntries(CONFIGURABLE_TYPES.map((t) => [t, t !== 'monthly_renewed'])) as Record<ConfigurableType, boolean>;

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: DEFAULT_ENABLED,
  newRequests: 'digest',
  digestTime: '20:00',
  quietHours: { start: '23:00', end: '08:00' },
};

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isClockTime(value: unknown): value is string {
  return typeof value === 'string' && CLOCK.test(value);
}

/** Minutes since local midnight of an "HH:MM" time. */
export function clockMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function isQuietHours(value: unknown): value is QuietHours {
  if (typeof value !== 'object' || value === null) return false;
  const { start, end } = value as Record<string, unknown>;
  return isClockTime(start) && isClockTime(end);
}

/**
 * Applies `changes` (untrusted: stored JSON or a command's input) over `base`, keeping only valid
 * fields. Returns null when something present is invalid, so a command can refuse it.
 */
export function applyPrefs(base: NotificationPrefs, changes: unknown): NotificationPrefs | null {
  if (typeof changes !== 'object' || changes === null || Array.isArray(changes)) return null;
  const input = changes as Record<string, unknown>;
  let next = base;

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== 'object' || input.enabled === null) return null;
    const enabled = { ...next.enabled };
    for (const [type, on] of Object.entries(input.enabled)) {
      if (!(CONFIGURABLE_TYPES as readonly string[]).includes(type) || typeof on !== 'boolean') return null;
      enabled[type as ConfigurableType] = on;
    }
    next = { ...next, enabled };
  }
  if (input.newRequests !== undefined) {
    if (input.newRequests !== 'immediate' && input.newRequests !== 'digest') return null;
    next = { ...next, newRequests: input.newRequests };
  }
  if (input.digestTime !== undefined) {
    if (!isClockTime(input.digestTime)) return null;
    next = { ...next, digestTime: input.digestTime };
  }
  if (input.quietHours !== undefined) {
    if (input.quietHours !== null && !isQuietHours(input.quietHours)) return null;
    next = { ...next, quietHours: input.quietHours === null ? null : { start: input.quietHours.start, end: input.quietHours.end } };
  }
  return next;
}

/** Reads stored preferences, ignoring what is broken rather than failing. */
export function parsePrefs(json: string | null | undefined): NotificationPrefs {
  let stored: unknown;
  try {
    stored = JSON.parse(json || '{}');
  } catch {
    return DEFAULT_PREFS;
  }
  if (typeof stored !== 'object' || stored === null) return DEFAULT_PREFS;
  // Field by field, so one bad field does not discard the others.
  let prefs = DEFAULT_PREFS;
  for (const [key, value] of Object.entries(stored)) {
    if (key === 'enabled' && typeof value === 'object' && value !== null) {
      for (const [type, on] of Object.entries(value)) prefs = applyPrefs(prefs, { enabled: { [type]: on } }) ?? prefs;
    } else {
      prefs = applyPrefs(prefs, { [key]: value }) ?? prefs;
    }
  }
  return prefs;
}
