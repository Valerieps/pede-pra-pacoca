// The admin's download of the group's data (ADR-006: the Durable Object has no dashboard).
// Every table goes in, so tables added later are not forgotten; what would let someone in or
// send pushes in someone's name stays out.
import type { GroupExport } from '../../src/application/api-contract';
import { isAdmin } from '../../src/domain/group/roles';
import { nowIso, type Context } from './context';
import type { Member } from './members';

/** Session token hashes and push keys: never leave the server. */
export const EXPORT_EXCLUDED_TABLES: readonly string[] = ['sessions', 'push_subscriptions'];
/** Config keys that hold secrets. */
export const EXPORT_EXCLUDED_CONFIG = /secret|key|token/i;

export function exportGroup(ctx: Context, actor: Member): GroupExport | null {
  if (!isAdmin(actor)) return null;
  const names = ctx.sql
    .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .map((r) => r.name)
    .filter((name) => /^[a-z_]+$/.test(name) && !name.startsWith('sqlite_') && !name.startsWith('_cf') && !EXPORT_EXCLUDED_TABLES.includes(name));
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const name of names) {
    const rows = ctx.sql.all<Record<string, unknown>>(`SELECT * FROM ${name}`);
    tables[name] = name === 'config' ? rows.filter((r) => !EXPORT_EXCLUDED_CONFIG.test(String(r.key))) : rows;
  }
  const [{ version }] = ctx.sql.all<{ version: number | null }>('SELECT MAX(version) AS version FROM schema_migrations');
  return { exportedAt: nowIso(ctx), schemaVersion: version ?? 0, tables };
}
