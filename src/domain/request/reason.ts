// Why a request was refused or could not be fulfilled (docs/spec/atendente.md, "Atualizar status"):
// a code from a short list plus optional free text, and the attendant's note on fulfillment.
import { MAX_NOTE_LENGTH } from '../media/media';
import { strings } from '../strings';
import type { Reason, ReasonCode } from './lifecycle';

/** The codes an attendant picks from; `server_failure` comes only from the Jellyseerr. */
export const ATTENDANT_REASONS = ['not_found', 'bad_quality', 'try_later', 'other'] as const satisfies readonly ReasonCode[];

export const MAX_REASON_TEXT = 200;
export const MAX_FULFILLMENT_NOTE = MAX_NOTE_LENGTH;

const trimmed = (value: unknown): string | null | undefined => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  return value.trim() || null;
};

/** Reads an attendant's reason from untrusted input. "Outro" needs the text. Null when invalid. */
export function parseReason(value: unknown): Reason | null {
  if (typeof value !== 'object' || value === null) return null;
  const { code, text } = value as Record<string, unknown>;
  if (!(ATTENDANT_REASONS as readonly unknown[]).includes(code)) return null;
  const free = trimmed(text);
  if (free === undefined || (free && free.length > MAX_REASON_TEXT)) return null;
  if (code === 'other' && !free) return null;
  return free ? { code: code as ReasonCode, text: free } : { code: code as ReasonCode };
}

/** The optional note sent with Atendido. `undefined` when invalid. */
export function parseFulfillmentNote(value: unknown): string | null | undefined {
  const note = trimmed(value);
  if (note && note.length > MAX_FULFILLMENT_NOTE) return undefined;
  return note;
}

/** The reason as the requesters read it: "não encontrei", "não encontrei (só tinha dublado)". */
export function reasonText(reason: Reason): string {
  if (reason.code === 'other') return reason.text ?? strings.reasons.other;
  const label = strings.reasons[reason.code];
  return reason.text ? `${label} (${reason.text})` : label;
}
