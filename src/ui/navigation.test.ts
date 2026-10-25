import { describe, expect, it } from 'vitest';
import type { RequestView } from '../application/api-contract';
import type { RequestStatus } from '../domain/request/lifecycle';
import { askDraftVersion, draftFor, submitAskDraft, takeAskDraft } from './ask-draft';
import { activeTab, inProgress, isInboxPath, isManagePath, manageLinksFor, tabsFor } from './navigation';

const member = { roles: [] } as const;
const attendant = { roles: ['attendant'] } as const;
const admin = { roles: ['admin'] } as const;

describe('tabsFor', () => {
  it('gives everyone the same tabs, with Pedir in the center', () => {
    const tabs = tabsFor();
    expect(tabs.map((t) => t.path)).toEqual(['/', '/numeros', '/pedir', '/meus-pedidos', '/perfil']);
    expect(tabs[2].icon).toBe('ask');
  });

  it('names Meus pedidos Pedidos in the tab bar only', () => {
    const mine = tabsFor()[3];
    expect(mine.label).toBe('Pedidos');
    expect(mine.longLabel).toBe('Meus pedidos');
  });
});

describe('manageLinksFor', () => {
  const paths = (roles: { roles: readonly ('admin' | 'attendant')[] }) => manageLinksFor(roles).map((l) => l.path);

  it('gives a member nothing to manage', () => {
    expect(paths(member)).toEqual([]);
  });

  it('gives an attendant the requests and the petiscos', () => {
    expect(paths(attendant)).toEqual(['/filas', '/gerenciar/petiscos']);
  });

  it('adds members, invites and the group settings for an admin, who also attends', () => {
    expect(paths(admin)).toEqual(['/filas', '/membros', '/convites', '/gerenciar/petiscos', '/ajustes']);
  });
});

describe('activeTab', () => {
  const tabs = tabsFor();

  it('marks the tab of its own screen', () => {
    expect(activeTab('/numeros', tabs)).toBe('/numeros');
  });

  it('marks Pedidos on a request, Perfil on Petiscos', () => {
    expect(activeTab('/pedido/abc', tabs)).toBe('/meus-pedidos');
    expect(activeTab('/petiscos', tabs)).toBe('/perfil');
  });

  it('marks nothing on Avisos or the management screens', () => {
    expect(activeTab('/avisos', tabs)).toBeNull();
    expect(activeTab('/filas', tabs)).toBeNull();
  });
});

describe('inProgress', () => {
  const request = (id: string, status: RequestStatus, createdAt: string) => ({ id, status, createdAt }) as RequestView;

  it('keeps the active requests, newest first', () => {
    const list = [
      request('a', 'approved', '2026-10-01T00:00:00Z'),
      request('b', 'fulfilled', '2026-10-05T00:00:00Z'),
      request('c', 'in_jellyseerr', '2026-10-03T00:00:00Z'),
      request('d', 'awaiting_approval', '2026-10-02T00:00:00Z'),
      request('e', 'canceled', '2026-10-04T00:00:00Z'),
    ];
    expect(inProgress(list).map((r) => r.id)).toEqual(['c', 'd', 'a']);
  });

  it('stops at five', () => {
    const list = Array.from({ length: 7 }, (_, i) => request(`r${i}`, 'approved', `2026-10-0${i + 1}T00:00:00Z`));
    expect(inProgress(list).map((r) => r.id)).toEqual(['r6', 'r5', 'r4', 'r3', 'r2']);
  });
});

describe('ask draft', () => {
  it('sends a known link to the confirmation and anything else to the search', () => {
    expect(draftFor('https://www.imdb.com/title/tt15239678/')).toEqual({ kind: 'link', text: 'https://www.imdb.com/title/tt15239678/' });
    expect(draftFor('  duna ')).toEqual({ kind: 'search', query: 'duna' });
    expect(draftFor('   ')).toBeNull();
  });

  it('is taken once, and each submit changes the version', () => {
    const before = askDraftVersion();
    expect(submitAskDraft('')).toBe(false);
    expect(submitAskDraft('duna')).toBe(true);
    expect(askDraftVersion()).toBe(before + 1);
    expect(takeAskDraft()).toEqual({ kind: 'search', query: 'duna' });
    expect(takeAskDraft()).toBeNull();
  });
});

describe('isManagePath / isInboxPath', () => {
  it('keep the gear and the bell highlighted on their sub-screens', () => {
    expect(isManagePath('/gerenciar')).toBe(true);
    expect(isManagePath('/gerenciar/petiscos')).toBe(true);
    expect(isManagePath('/membros')).toBe(true);
    expect(isManagePath('/perfil')).toBe(false);
    expect(isInboxPath('/avisos/preferencias')).toBe(true);
    expect(isInboxPath('/')).toBe(false);
  });
});
