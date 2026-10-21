// Dates on screen, in the group's calendar (docs/SPEC.md), whatever the phone's time zone.
import { GROUP_TIME_ZONE } from '../domain/time';

/** An ISO instant as "21/10/2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: GROUP_TIME_ZONE });
}

/** A calendar day "2026-10-21" as "21/10/2026". */
export function formatDateKey(key: string): string {
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year}`;
}
