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

/** Pages the app links to (opened by the member in a new tab); the app never requests them. */
export const LINK_ORIGINS: readonly string[] = ['https://www.imdb.com', 'https://letterboxd.com'];

/**
 * The Web Push services of the phones' browsers (ADR-011): Chrome and Android (FCM), Safari on
 * iPhone and Mac (Apple), Firefox (Mozilla). A push subscription whose endpoint is anywhere else
 * is refused, so the Worker never sends a request to an address a member made up.
 */
export const PUSH_SERVICE_ORIGINS: readonly string[] = [
  'https://fcm.googleapis.com',
  'https://web.push.apple.com',
  'https://updates.push.services.mozilla.com',
];

/** The only servers the Worker (server/) calls: Google sign-in, TMDB, OMDb and the push services. */
export const SERVER_ORIGINS: readonly string[] = [
  'https://accounts.google.com',
  'https://oauth2.googleapis.com',
  'https://api.themoviedb.org',
  'https://www.omdbapi.com',
  ...PUSH_SERVICE_ORIGINS,
];
