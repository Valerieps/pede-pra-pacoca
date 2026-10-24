// The group's database (docs/ARQUITETURA.md). Migrations run in order, once each, when the
// Durable Object starts. Never edit a migration that has shipped: add the next one.
import type { Sql } from './ports';

export const MIGRATIONS: readonly (readonly string[])[] = [
  // 1: the whole phase 1 model.
  [
    `CREATE TABLE members (
      id TEXT PRIMARY KEY,
      google_sub TEXT UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      photo_url TEXT,
      roles TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      monthly_petiscos INTEGER,
      notification_prefs TEXT NOT NULL DEFAULT '{}',
      vacation INTEGER NOT NULL DEFAULT 0,
      vacation_until TEXT,
      joined_at TEXT NOT NULL,
      removed_at TEXT
    )`,
    `CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`,
    `CREATE INDEX sessions_member ON sessions(member_id)`,
    `CREATE TABLE invites (
      email TEXT PRIMARY KEY,
      invited_by TEXT NOT NULL REFERENCES members(id),
      state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      accepted_at TEXT,
      revoked_at TEXT
    )`,
    `CREATE TABLE requests (
      id TEXT PRIMARY KEY,
      origin TEXT NOT NULL,
      media_type TEXT NOT NULL,
      tmdb_id INTEGER,
      media_key TEXT,
      title TEXT NOT NULL,
      year INTEGER,
      poster_path TEXT,
      release_date TEXT,
      genres TEXT NOT NULL DEFAULT '[]',
      link TEXT,
      note TEXT,
      requester_id TEXT NOT NULL REFERENCES members(id),
      status TEXT NOT NULL,
      assignee_id TEXT REFERENCES members(id),
      petisco_lot TEXT,
      reason_code TEXT,
      reason_text TEXT,
      fulfillment_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX requests_media_key ON requests(media_key, status)`,
    `CREATE INDEX requests_status ON requests(status, created_at)`,
    `CREATE INDEX requests_requester ON requests(requester_id, created_at)`,
    `CREATE TABLE request_transitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL REFERENCES requests(id),
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '{}',
      at TEXT NOT NULL
    )`,
    `CREATE INDEX request_transitions_request ON request_transitions(request_id, id)`,
    `CREATE TABLE co_requests (
      request_id TEXT NOT NULL REFERENCES requests(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      at TEXT NOT NULL,
      PRIMARY KEY (request_id, member_id)
    )`,
    `CREATE TABLE inheritance_offers (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES requests(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      state TEXT NOT NULL,
      offered_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`,
    `CREATE TABLE feedback (
      request_id TEXT NOT NULL REFERENCES requests(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      watched_at TEXT,
      rating INTEGER,
      thanked_at TEXT,
      PRIMARY KEY (request_id, member_id)
    )`,
    `CREATE TABLE feed_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      actor_id TEXT NOT NULL REFERENCES members(id),
      request_id TEXT REFERENCES requests(id),
      data TEXT NOT NULL DEFAULT '{}',
      like_count INTEGER NOT NULL DEFAULT 0,
      at TEXT NOT NULL
    )`,
    `CREATE INDEX feed_events_at ON feed_events(at)`,
    `CREATE TABLE likes (
      event_id TEXT NOT NULL REFERENCES feed_events(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      at TEXT NOT NULL,
      PRIMARY KEY (event_id, member_id)
    )`,
    `CREATE TABLE petisco_movements (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      kind TEXT NOT NULL,
      operation TEXT NOT NULL,
      lot TEXT NOT NULL,
      request_id TEXT REFERENCES requests(id),
      expires_at TEXT,
      reason TEXT,
      actor TEXT NOT NULL,
      at TEXT NOT NULL
    )`,
    `CREATE INDEX petisco_movements_member ON petisco_movements(member_id, at)`,
    `CREATE TABLE known_media (
      media_key TEXT PRIMARY KEY,
      at TEXT NOT NULL
    )`,
    `CREATE TABLE config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE inbox (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      type TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      read INTEGER NOT NULL DEFAULT 0,
      at TEXT NOT NULL
    )`,
    `CREATE INDEX inbox_member ON inbox(member_id, at)`,
    `CREATE TABLE outbox (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      type TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      group_key TEXT,
      deliver_after TEXT NOT NULL,
      sent_at TEXT
    )`,
    `CREATE INDEX outbox_due ON outbox(sent_at, deliver_after)`,
    `CREATE TABLE push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE webhook_events (
      id TEXT PRIMARY KEY,
      received_at TEXT NOT NULL
    )`,
  ],
  // 2: first access and the photo choice. Members who existed before confirm their profile once.
  [
    `ALTER TABLE members ADD COLUMN profile_confirmed_at TEXT`,
    `ALTER TABLE members ADD COLUMN photo_choice TEXT NOT NULL DEFAULT 'google'`,
    `ALTER TABLE members ADD COLUMN google_photo_url TEXT`,
    `UPDATE members SET google_photo_url = photo_url`,
  ],
  // 3: the 7-day expiry notice goes out once per bonus or cashback lot.
  [
    `CREATE TABLE petisco_expiry_notices (
      lot TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      notified_at TEXT NOT NULL
    )`,
  ],
  // 4: the statistics read requests by attendant, and likes and movements by request or author.
  [
    `CREATE INDEX requests_assignee ON requests(assignee_id, created_at)`,
    `CREATE INDEX feed_events_request ON feed_events(request_id)`,
    `CREATE INDEX feed_events_actor ON feed_events(actor_id)`,
    `CREATE INDEX petisco_movements_request ON petisco_movements(request_id)`,
  ],
  // 5: "Assisti" and its rating are gone (docs/spec/pedidos.md); the columns leave in a later one.
  [
    `DELETE FROM likes WHERE event_id IN (SELECT id FROM feed_events WHERE type = 'watched')`,
    `DELETE FROM feed_events WHERE type = 'watched'`,
    `DELETE FROM feedback WHERE thanked_at IS NULL`,
    `UPDATE feedback SET watched_at = NULL, rating = NULL`,
  ],
];

export function migrate(sql: Sql): void {
  sql.run('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const [{ current }] = sql.all<{ current: number | null }>('SELECT MAX(version) AS current FROM schema_migrations');
  for (let version = (current ?? 0) + 1; version <= MIGRATIONS.length; version++) {
    sql.transaction(() => {
      for (const statement of MIGRATIONS[version - 1]) sql.run(statement);
      sql.run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', version, new Date().toISOString());
    });
  }
}
