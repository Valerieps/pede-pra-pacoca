// Vacation mode (docs/spec/atendente.md). The return date is a day in the group's calendar: the
// attendant is back from 00:00 of that day, and the vacation ends on its own.
import { isDateKey, localDateKey } from '../time';

export interface Vacation {
  readonly onVacation: boolean;
  /** "YYYY-MM-DD", or null when no return date was given. */
  readonly until: string | null;
}

/** Whether the vacation still holds at `now`. */
export function isOnVacation(vacation: Vacation, now: Date): boolean {
  return vacation.onVacation && (vacation.until === null || localDateKey(now) < vacation.until);
}

/** A return date must be a real day after today; none is fine too. */
export function isValidReturnDate(until: unknown, now: Date): until is string | null {
  return until === null || (isDateKey(until) && until > localDateKey(now));
}

export interface GroupSleep {
  /** "A Paçoca está dormindo": there are attendants and all of them are on vacation. */
  readonly sleeping: boolean;
  /** The earliest return date among them, when the Paçoca sleeps and someone gave one. */
  readonly returnsOn: string | null;
}

export function groupSleep(attendants: readonly Vacation[], now: Date): GroupSleep {
  const sleeping = attendants.length > 0 && attendants.every((a) => isOnVacation(a, now));
  if (!sleeping) return { sleeping, returnsOn: null };
  const dates = attendants.map((a) => a.until).filter((d): d is string => d !== null).sort();
  return { sleeping, returnsOn: dates[0] ?? null };
}
