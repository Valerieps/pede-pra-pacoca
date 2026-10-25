// The navigation shell (docs/spec/app-e-instalacao.md, "Navegação"): the tabs, the links in
// Gerenciamento do App each person gets, and which requests the desktop's right column shows.
import type { RequestView } from '../application/api-contract';
import { canAttend, canManageGroup, type MemberRoles } from '../domain/group/roles';
import { isActive } from '../domain/request/lifecycle';
import { strings } from '../domain/strings';

export type TabIcon = 'feed' | 'queues' | 'catalog' | 'ask' | 'requests' | 'profile';

export interface Tab {
  readonly path: string;
  readonly icon: TabIcon;
  /** The name in the phone's tab bar. */
  readonly label: string;
  /** The name in the desktop sidebar and for screen readers. */
  readonly longLabel: string;
}

export interface ManageLink {
  readonly path: string;
  readonly label: string;
}

const tab = (path: string, icon: TabIcon, label: string, longLabel = label): Tab => ({ path, icon, label, longLabel });

/** The same five tabs for everyone, with Pedir in the center. */
export function tabsFor(): Tab[] {
  const n = strings.nav;
  return [
    tab('/', 'feed', n.feed),
    tab('/catalogo', 'catalog', n.catalog),
    tab('/pedir', 'ask', n.ask),
    tab('/meus-pedidos', 'requests', n.myRequestsShort, n.myRequests),
    tab('/perfil', 'profile', n.profile),
  ];
}

/** Gerenciamento do App: what I can manage, each only for who can use it. */
export function manageLinksFor(me: MemberRoles): ManageLink[] {
  const n = strings.nav;
  const links: (ManageLink | false)[] = [
    canAttend(me) && { path: '/filas', label: n.manageRequests },
    canManageGroup(me) && { path: '/membros', label: n.manageMembers },
    canManageGroup(me) && { path: '/convites', label: n.manageInvites },
    canAttend(me) && { path: '/gerenciar/petiscos', label: n.managePetiscos },
    canManageGroup(me) && { path: '/ajustes', label: n.groupSettings },
  ];
  return links.filter((l): l is ManageLink => l !== false);
}

/** The tab a screen belongs to: a request belongs to Pedidos, Petiscos to Perfil. */
export function activeTab(path: string, tabs: readonly Tab[], from: string | null = null): string | null {
  if (tabs.some((t) => t.path === path)) return path;
  if (path.startsWith('/pedido/')) {
    const origin = tabs.find((t) => t.path === from && t.path !== '/pedir' && t.path !== '/perfil');
    return origin ? origin.path : '/meus-pedidos';
  }
  if (path === '/petiscos') return '/perfil';
  return null;
}

/** Gerenciamento do App and every screen under it keep the gear highlighted. */
export function isManagePath(path: string): boolean {
  return ['/gerenciar', '/filas', '/membros', '/convites', '/ajustes'].some((p) => path === p || path.startsWith(`${p}/`));
}

/** Avisos and its sub-screens keep the bell highlighted. */
export function isInboxPath(path: string): boolean {
  return path === '/avisos' || path.startsWith('/avisos/');
}

export const IN_PROGRESS_LIMIT = 5;

/** The right column's requests: the active ones, newest first, at most five. */
export function inProgress(requests: readonly RequestView[]): RequestView[] {
  return requests
    .filter((r) => isActive(r.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, IN_PROGRESS_LIMIT);
}
