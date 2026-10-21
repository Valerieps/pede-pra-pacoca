// Group settings, one JSON value per key. Secrets (the webhook secret) live here too: the
// database is only reachable through the server, never from the app.
import type { Context } from './context';

export interface ConfigValues {
  monthlyPetiscos: number;
  cashback: { coRequesters: { enabled: boolean; threshold: number } };
  jellyseerrBaseUrl: string | null;
  webhookSecret: string | null;
}

export function readConfig<K extends keyof ConfigValues>(ctx: Context, key: K, fallback: ConfigValues[K]): ConfigValues[K] {
  const [row] = ctx.sql.all<{ value: string }>('SELECT value FROM config WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as ConfigValues[K]) : fallback;
}

export function writeConfig<K extends keyof ConfigValues>(ctx: Context, key: K, value: ConfigValues[K]): void {
  ctx.sql.run(
    'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
}
