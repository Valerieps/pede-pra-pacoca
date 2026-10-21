// A member's name and photo (docs/spec/grupo-e-papeis.md, "Perfil").
export const NAME_MAX_LENGTH = 40;

/** The photo a member shows: the one from their Google account, or none. */
export type PhotoChoice = 'google' | 'none';

export function isPhotoChoice(value: unknown): value is PhotoChoice {
  return value === 'google' || value === 'none';
}

/** The name as stored: trimmed, inner spaces collapsed. Null when empty or too long. */
export function normalizeName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0 || name.length > NAME_MAX_LENGTH) return null;
  return name;
}

/** The photo shown for a choice: a member who chose none keeps none, even if Google has one. */
export function photoFor(choice: PhotoChoice, googlePhotoUrl: string | null): string | null {
  return choice === 'google' ? googlePhotoUrl : null;
}
