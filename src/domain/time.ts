// Calendar rules run in the group's time zone (docs/SPEC.md), whatever the server or phone uses.
export const GROUP_TIME_ZONE = 'America/Sao_Paulo';

const DAY_MS = 24 * 60 * 60 * 1000;

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: GROUP_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
});

export function localParts(instant: Date): LocalParts {
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** The group's month an instant falls in, as "YYYY-MM". */
export function monthKey(instant: Date): string {
  const { year, month } = localParts(instant);
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** The instant a local wall-clock time happens in the group's time zone. */
export function localToInstant(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wanted;
  // Two passes settle the offset even across a daylight saving change.
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess));
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wanted - seen;
  }
  return new Date(guess);
}

/** Day 1, 00:00 of the next month: when monthly petiscos renew and the current ones expire. */
export function nextMonthStart(instant: Date): Date {
  const { year, month } = localParts(instant);
  return month === 12 ? localToInstant(year + 1, 1, 1) : localToInstant(year, month + 1, 1);
}

export function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * DAY_MS);
}

/** The group's calendar day an instant falls in, as "YYYY-MM-DD". */
export function localDateKey(instant: Date): string {
  const { year, month, day } = localParts(instant);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Calendar days in the group's calendar from `then` to `now`: 0 the same day, 1 the day before. */
export function calendarDaysBetween(then: Date, now: Date): number {
  const utc = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
  return Math.round((utc(localDateKey(now)) - utc(localDateKey(then))) / DAY_MS);
}

/** Whether `value` is a real calendar day written as "YYYY-MM-DD". */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
