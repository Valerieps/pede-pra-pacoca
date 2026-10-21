// The desktop's right column takes a link or a search and hands it to Pedir
// (docs/spec/app-e-instalacao.md, "Navegação"). The text waits here until Pedir opens and takes it.
import { parseSharedLink } from '../domain/media/media';

export type AskDraft = { readonly kind: 'link'; readonly text: string } | { readonly kind: 'search'; readonly query: string };

let draft: AskDraft | null = null;
let version = 0;
const listeners = new Set<() => void>();

/** A known link goes straight to the confirmation; anything else is a search. */
export function draftFor(text: string): AskDraft | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return parseSharedLink(trimmed) ? { kind: 'link', text: trimmed } : { kind: 'search', query: trimmed };
}

/** Keeps the text for Pedir; returns false when there is nothing to ask. */
export function submitAskDraft(text: string): boolean {
  const next = draftFor(text);
  if (!next) return false;
  draft = next;
  version += 1;
  listeners.forEach((l) => l());
  return true;
}

/** The waiting draft, taken once. */
export function takeAskDraft(): AskDraft | null {
  const taken = draft;
  draft = null;
  return taken;
}

/** Changes on every submit, so an open Pedir starts over with the new text. */
export function askDraftVersion(): number {
  return version;
}

export function subscribeAskDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
