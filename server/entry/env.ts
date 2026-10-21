import type { Group } from './group-object';

/** Bindings and settings from wrangler.jsonc; secrets are set with `wrangler secret put`. */
export interface Env {
  readonly ASSETS: Fetcher;
  readonly GROUP: DurableObjectNamespace<Group>;
  readonly GOOGLE_CLIENT_ID: string;
  readonly GOOGLE_CLIENT_SECRET: string;
  /** Comma-separated. Only used while the group has no admin at all. */
  readonly BOOTSTRAP_ADMIN_EMAILS: string;
  /** Web Push (ADR-011), from `npm run vapid:keys`. Without them, notices reach the inbox only. */
  readonly VAPID_PUBLIC_KEY?: string;
  readonly VAPID_PRIVATE_KEY?: string;
  /** "mailto:..." the push services may write to. */
  readonly VAPID_SUBJECT?: string;
  /** TMDB v3 API key or v4 read access token. Secret: never reaches the app. */
  readonly TMDB_API_KEY: string;
  /** "1" turns on the test sign-in on localhost (ADR-009). Only ever set in `.dev.vars`. */
  readonly DEV_SIGN_IN?: string;
}
