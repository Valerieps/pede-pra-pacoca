/**
 * The one place that says which servers the app may talk to (docs/SEGURANCA.md).
 *
 * Empty means local-only: the production CSP gets `connect-src 'none'` and
 * src/security.test.ts forbids every network API in the app source.
 * Listing origins (e.g. 'https://api.example.com') opens the CSP to exactly those origins and
 * lets src/infrastructure/ (and only it) make requests to them. BOOTSTRAP.md asks which it is.
 */
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://firestore.googleapis.com',
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://firebaseinstallations.googleapis.com',
  'https://fcmregistrations.googleapis.com',
];

export const LOCAL_ONLY = ALLOWED_ORIGINS.length === 0;
