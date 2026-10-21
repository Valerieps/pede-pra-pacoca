import { describe, expect, it } from 'vitest';
import { groupQueue, jellyseerrUrl, queueOf, sortQueue, type QueueItem } from './queue';
import { parseFulfillmentNote, parseReason, reasonText } from './reason';

const ana = { id: 'ana', name: 'Ana' };
const bia = { id: 'bia', name: 'Bia' };

function item(title: string, extra: Partial<QueueItem> = {}): QueueItem & { title: string } {
  return { title, createdAt: '2026-10-01', releaseDate: null, mediaType: 'movie', requester: ana, assignee: null, coRequesters: [], ...extra };
}

const titles = (items: readonly { title: string }[]) => items.map((i) => i.title);

describe('queueOf', () => {
  it('puts each active request in its queue', () => {
    expect(queueOf({ status: 'awaiting_approval', origin: 'manual' })).toBe('awaiting');
    expect(queueOf({ status: 'approved', origin: 'tmdb' })).toBe('toSend');
    expect(queueOf({ status: 'approved', origin: 'manual' })).toBe('manual');
    expect(queueOf({ status: 'in_jellyseerr', origin: 'tmdb' })).toBe('inJellyseerr');
    expect(queueOf({ status: 'fulfilled', origin: 'tmdb' })).toBeNull();
  });
});

describe('sortQueue', () => {
  const old = item('Old', { createdAt: '2026-10-01', releaseDate: '2025-01-01' });
  const crowded = item('Crowded', { createdAt: '2026-10-03', coRequesters: [1, 2], releaseDate: '2024-05-01' });
  const manual = item('Manual', { createdAt: '2026-10-02', coRequesters: [1] });
  const items = [crowded, manual, old];

  it('by request date, oldest first', () => {
    expect(titles(sortQueue(items, 'date'))).toEqual(['Old', 'Manual', 'Crowded']);
  });

  it('by co-requesters, most first', () => {
    expect(titles(sortQueue(items, 'coRequesters'))).toEqual(['Crowded', 'Manual', 'Old']);
  });

  it('by release date, earliest first, no date last', () => {
    expect(titles(sortQueue(items, 'release'))).toEqual(['Crowded', 'Old', 'Manual']);
  });

  it('does not change the list it got', () => {
    sortQueue(items, 'date');
    expect(titles(items)).toEqual(['Crowded', 'Manual', 'Old']);
  });
});

describe('groupQueue', () => {
  const items = [item('A', { requester: bia, assignee: ana }), item('B', { mediaType: 'tv' }), item('C', { requester: bia, assignee: bia })];

  it('by person, in the order of the first item', () => {
    expect(groupQueue(items, 'person').map((g) => [g.label, titles(g.items)])).toEqual([
      ['Bia', ['A', 'C']],
      ['Ana', ['B']],
    ]);
  });

  it('by type', () => {
    expect(groupQueue(items, 'type').map((g) => g.key)).toEqual(['movie', 'tv']);
  });

  it('by assignee, nobody last', () => {
    expect(groupQueue(items, 'assignee').map((g) => [g.key, g.label])).toEqual([
      ['ana', 'Ana'],
      ['bia', 'Bia'],
      ['', null],
    ]);
  });

  it('no grouping is one group, or none when empty', () => {
    expect(groupQueue(items, 'none')).toHaveLength(1);
    expect(groupQueue([], 'none')).toEqual([]);
  });
});

describe('jellyseerrUrl', () => {
  it('joins the base URL, the type and the TMDB id', () => {
    expect(jellyseerrUrl('https://jelly.example/', 'movie', 12)).toBe('https://jelly.example/movie/12');
    expect(jellyseerrUrl('http://casa.local:5055/sub', 'tv', 3)).toBe('http://casa.local:5055/sub/tv/3');
  });

  it('is null without a usable base URL or a TMDB id', () => {
    expect(jellyseerrUrl(null, 'movie', 12)).toBeNull();
    expect(jellyseerrUrl('javascript:alert(1)', 'movie', 12)).toBeNull();
    expect(jellyseerrUrl('not a url', 'movie', 12)).toBeNull();
    expect(jellyseerrUrl('https://jelly.example', 'movie', null)).toBeNull();
  });
});

describe('reasons', () => {
  it('take a code from the short list and optional text', () => {
    expect(parseReason({ code: 'not_found' })).toEqual({ code: 'not_found' });
    expect(parseReason({ code: 'try_later', text: '  amanhã ' })).toEqual({ code: 'try_later', text: 'amanhã' });
    expect(parseReason({ code: 'other', text: 'sumiu' })).toEqual({ code: 'other', text: 'sumiu' });
  });

  it('refuse a missing code, the server failure, "outro" without text and long text', () => {
    expect(parseReason(undefined)).toBeNull();
    expect(parseReason({ code: 'server_failure' })).toBeNull();
    expect(parseReason({ code: 'other', text: '  ' })).toBeNull();
    expect(parseReason({ code: 'not_found', text: 5 })).toBeNull();
    expect(parseReason({ code: 'not_found', text: 'x'.repeat(201) })).toBeNull();
  });

  it('read as the requesters see them', () => {
    expect(reasonText({ code: 'not_found' })).toBe('não encontrei');
    expect(reasonText({ code: 'bad_quality', text: 'só câmera' })).toBe('qualidade ruim (só câmera)');
    expect(reasonText({ code: 'other', text: 'sumiu' })).toBe('sumiu');
  });

  it('the fulfillment note is optional and short', () => {
    expect(parseFulfillmentNote(undefined)).toBeNull();
    expect(parseFulfillmentNote('  ')).toBeNull();
    expect(parseFulfillmentNote(' legendado ')).toBe('legendado');
    expect(parseFulfillmentNote('x'.repeat(501))).toBeUndefined();
    expect(parseFulfillmentNote(1)).toBeUndefined();
  });
});
