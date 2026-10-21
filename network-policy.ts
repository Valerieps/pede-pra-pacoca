/**
 * The one place that says which servers the app and its server may talk to (docs/SEGURANCA.md).
 *
 * The app (browser) talks to its own origin only: the Worker serves the files and the API under
 * /api, so the production CSP has `connect-src 'self'` plus ALLOWED_ORIGINS, which stays empty.
 * Requests may only be made from src/infrastructure/; src/security.test.ts checks it.
 */
export const ALLOWED_ORIGINS: readonly string[] = [];

/** Where images may load from (CSP `img-src`): TMDB posters and Google profile photos (ADR-008). */
export const IMAGE_ORIGINS: readonly string[] = ['https://image.tmdb.org', 'https://lh3.googleusercontent.com'];

/**
 * The only servers the Worker (server/) calls. Push services join this list with notifications,
 * and the push sender refuses any subscription endpoint outside it.
 */
export const SERVER_ORIGINS: readonly string[] = [
  'https://accounts.google.com',
  'https://oauth2.googleapis.com',
  'https://api.themoviedb.org',
];
