// Vacation mode (docs/spec/atendente.md).
import type { VacationView } from '../../src/application/api-contract';
import { isAttendant, normalizeRoles } from '../../src/domain/group/roles';
import { groupSleep, isOnVacation, isValidReturnDate, type Vacation } from '../../src/domain/group/vacation';
import { localDateKey } from '../../src/domain/time';
import { failure, type CommandResult, type Context } from './context';
import type { Member } from './members';

interface VacationRow {
  id: string;
  roles: string;
  vacation: number;
  vacation_until: string | null;
}

const toVacation = (row: VacationRow): Vacation => ({ onVacation: row.vacation === 1, until: row.vacation_until });

export function vacationView(ctx: Context, actor: Member): VacationView {
  const now = ctx.clock.now();
  const attendants = ctx.sql
    .all<VacationRow>('SELECT id, roles, vacation, vacation_until FROM members WHERE active = 1')
    .filter((row) => isAttendant({ roles: normalizeRoles(JSON.parse(row.roles) as string[]) }));
  const own = attendants.find((row) => row.id === actor.id);
  const away = own !== undefined && isOnVacation(toVacation(own), now);
  const mine = own ? { onVacation: away, until: away ? own.vacation_until : null } : null;
  return { ...groupSleep(attendants.map(toVacation), now), mine };
}

/** Only attendants go on vacation: an admin without the role does not count as one. */
export function setVacation(ctx: Context, actor: Member, input: { onVacation?: unknown; until?: unknown }): CommandResult<VacationView> {
  if (!isAttendant(actor)) return failure('forbidden');
  if (typeof input.onVacation !== 'boolean') return failure('invalid');
  const until = input.onVacation ? (input.until ?? null) : null;
  if (!isValidReturnDate(until, ctx.clock.now())) return failure('invalid');
  ctx.sql.run('UPDATE members SET vacation = ?, vacation_until = ? WHERE id = ?', input.onVacation ? 1 : 0, until, actor.id);
  return { ok: true, value: vacationView(ctx, actor), changed: ['vacation'] };
}

/**
 * Job for `tick()`: ends the vacations whose return date has come, so the `vacation` column is
 * true only while the vacation holds. Returns whether anything changed.
 */
export function endFinishedVacations(ctx: Context): boolean {
  const today = localDateKey(ctx.clock.now());
  const ended = ctx.sql.all<{ id: string }>('SELECT id FROM members WHERE vacation = 1 AND vacation_until IS NOT NULL AND vacation_until <= ?', today);
  if (ended.length === 0) return false;
  ctx.sql.run('UPDATE members SET vacation = 0, vacation_until = NULL WHERE vacation = 1 AND vacation_until IS NOT NULL AND vacation_until <= ?', today);
  return true;
}
