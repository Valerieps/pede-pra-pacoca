// The navigation shell (docs/spec/app-e-instalacao.md, "Navegação"): the tabs, the links in
// Gerenciamento do App each person gets, and which requests the desktop's right column shows.
import type { RequestView } from '../application/api-contract';
import { canAttend, canManageGroup, type MemberRoles } from '../domain/group/roles';
import { isActive } from '../domain/request/lifecycle';
import { strings } from '../domain/strings';

export type TabIcon = 'feed' | 'queues' | 'stats' | 'ask' | 'requests' | 'profile';

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
    tab('/numeros', 'stats', n.stats, n.statsLong),
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

/** The tab a screen belongs to: a request belongs to Pedidos, a member's numbers and Petiscos to theirs. */
export function activeTab(path: string, tabs: readonly Tab[]): string | null {
  if (tabs.some((t) => t.path === path)) return path;
  if (path.startsWith('/pedido/')) return '/meus-pedidos';
  if (path.startsWith('/numeros/')) return '/numeros';
  if (path === '/petiscos') return '/perfil';
  return null;
}

/** The member a "/numeros/<id>" path opens Números do Grupo filtered by, if any. */
export function statsMemberOf(path: string): string | null {
  return /^\/numeros\/([\w-]+)$/.exec(path)?.[1] ?? null;
}

export const IN_PROGRESS_LIMIT = 5;

/** The right column's requests: the active ones, newest first, at most five. */
export function inProgress(requests: readonly RequestView[]): RequestView[] {
  return requests
    .filter((r) => isActive(r.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, IN_PROGRESS_LIMIT);
}
