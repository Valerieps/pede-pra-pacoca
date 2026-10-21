// The navigation shell (docs/spec/app-e-instalacao.md, "Navegação"): which tabs and which Perfil
// links each person gets, and which requests the desktop's right column shows.
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

export interface ProfileLink {
  readonly path: string;
  readonly label: string;
}

const tab = (path: string, icon: TabIcon, label: string, longLabel = label): Tab => ({ path, icon, label, longLabel });

/** Five tabs with Pedir in the center: Filas for an attendant, Números for everyone else. */
export function tabsFor(me: MemberRoles): Tab[] {
  const n = strings.nav;
  return [
    tab('/', 'feed', n.feed),
    canAttend(me) ? tab('/filas', 'queues', n.queues) : tab('/numeros', 'stats', n.stats),
    tab('/pedir', 'ask', n.ask),
    tab('/meus-pedidos', 'requests', n.myRequestsShort, n.myRequests),
    tab('/perfil', 'profile', n.profile),
  ];
}

/** What lives inside Perfil, each only for who can use it; "Sair" follows them. */
export function profileLinksFor(me: MemberRoles): ProfileLink[] {
  const n = strings.nav;
  const links: (ProfileLink | false)[] = [
    { path: '/membros', label: n.members },
    canAttend(me) && { path: '/numeros', label: n.stats },
    canManageGroup(me) && { path: '/convites', label: n.invites },
    { path: '/petiscos', label: n.petiscos },
    canAttend(me) && { path: '/ajustes', label: n.settings },
  ];
  return links.filter((l): l is ProfileLink => l !== false);
}

/** The tab a screen belongs to: a request belongs to Meus, the Perfil links to Perfil. */
export function activeTab(path: string, tabs: readonly Tab[]): string | null {
  if (tabs.some((t) => t.path === path)) return path;
  if (path.startsWith('/pedido/')) return '/meus-pedidos';
  if (['/membros', '/numeros', '/convites', '/petiscos', '/ajustes'].includes(path) || path.startsWith('/membro/')) return '/perfil';
  return null;
}

export const IN_PROGRESS_LIMIT = 5;

/** The right column's requests: the active ones, newest first, at most five. */
export function inProgress(requests: readonly RequestView[]): RequestView[] {
  return requests
    .filter((r) => isActive(r.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, IN_PROGRESS_LIMIT);
}
