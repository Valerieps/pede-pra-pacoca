import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import type { MeView } from '../application/api-contract';
import { canAttend, canManageGroup } from '../domain/group/roles';
import { askDraftVersion, submitAskDraft, subscribeAskDraft } from './ask-draft';
import { strings } from '../domain/strings';
import { useLiveStatus, useServices } from './backend-context';
import { Avatar } from './components/Avatar';
import { Icon } from './components/Icon';
import { InstallGuide } from './components/InstallGuide';
import { PetiscoIcon } from './components/PetiscoIcon';
import { StatusChip } from './components/StatusChip';
import { activeTab, inProgress, isInboxPath, isManagePath, manageLinksFor, tabsFor } from './navigation';
import { cameFrom, Link, navigate, usePath } from './router';
import { usePushDevice } from './push-context';
import { Ask } from './screens/Ask';
import { Catalog } from './screens/Catalog';
import { Feed } from './screens/Feed';
import { GroupStats } from './screens/GroupStats';
import { Inbox } from './screens/Inbox';
import { ManageApp } from './screens/ManageApp';
import { Invites } from './screens/Invites';
import { NotificationPreferences } from './screens/NotificationPreferences';
import { PushPermission } from './screens/PushPermission';
import { MyRequests } from './screens/MyRequests';
import { RequestDetail } from './screens/RequestDetail';
import { Members } from './screens/Members';
import { Petiscos } from './screens/Petiscos';
import { Queues } from './screens/Queues';
import { Profile } from './screens/Profile';
import { GroupSettings, ManagePetiscos } from './screens/Settings';
import { SignIn } from './screens/SignIn';
import { offersPushAtFirstAccess } from '../infrastructure/push-device';
import { ASK_PATH, browserShareEnvironment, pendingShare } from '../infrastructure/share-target';
import { formatDateKey } from './format';
import { useQuery } from './use-query';

export function App() {
  const { backend, live } = useServices();
  const me = useQuery('me', {}, ['me']);
  const signedIn = me.data !== undefined && me.error !== 'unauthenticated';
  const push = usePushDevice();
  // Right after the first-access profile, the app offers push once (docs/spec/app-e-instalacao.md).
  const [offerPush, setOfferPush] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    live.start();
    return () => live.stop();
  }, [live, signedIn]);

  usePushSync(signedIn);
  useSharedLinkRoute(signedIn && me.data?.profileConfirmed === true && !offerPush);

  if (me.loading && !me.data) return null;
  if (!me.data && me.error && me.error !== 'unauthenticated') {
    return (
      <main className="app">
        <p className="notice" role="alert">
          {strings.genericError}
        </p>
        <button type="button" onClick={me.reload}>
          {strings.retry}
        </button>
      </main>
    );
  }
  if (!signedIn) return <SignIn />;
  if (!me.data.profileConfirmed) {
    return (
      <main className="app">
        <Profile me={me.data} firstAccess onConfirmed={() => setOfferPush(offersPushAtFirstAccess(push.state()))} />
      </main>
    );
  }
  if (offerPush) {
    return (
      <main className="app">
        <PushPermission onDone={() => setOfferPush(false)} />
      </main>
    );
  }

  async function signOut() {
    await backend.signOut();
    navigate('/', { replace: true });
    me.reload();
  }

  return (
    <div className="shell">
      <header className="topbar">
        <strong className="grow">{strings.appName}</strong>
        <StatsLink />
        <InboxLink />
        <ManageLink me={me.data} />
      </header>
      <Navigation me={me.data} />
      <main className="content">
        <OfflineNotice />
        <SleepingNotice />
        <InstallGuide />
        <Screen me={me.data} onSignOut={() => void signOut()} />
      </main>
      <SideColumn me={me.data} />
    </div>
  );
}

/**
 * One nav, laid out by width (docs/spec/app-e-instalacao.md, "Navegação"): a bottom tab bar on a
 * phone, an icon rail on a tablet, a sidebar with names, "+ Pedir" and my profile on a computer.
 */
function Navigation({ me }: { me: MeView }) {
  const path = usePath();
  const tabs = tabsFor();
  const current = activeTab(path, tabs, cameFrom());
  return (
    <nav className="tabs" aria-label={strings.nav.main}>
      <strong className="sidebar-name">{strings.appName}</strong>
      {tabs.map((t) => (
        <Link
          key={t.path}
          to={t.path}
          className={`tab tab-${t.icon}`}
          aria-current={current === t.path ? 'page' : undefined}
          aria-label={t.longLabel}
          title={t.longLabel}
        >
          <Icon name={t.icon} />
          <span className="tab-label" aria-hidden="true">
            {t.label}
          </span>
          <span className="tab-long-label" aria-hidden="true">
            {t.longLabel}
          </span>
        </Link>
      ))}
      <StatsLink sidebar />
      <InboxLink sidebar />
      <ManageLink me={me} sidebar />
      <Link to={ASK_PATH} className="button sidebar-ask">
        {strings.nav.askButton}
      </Link>
      <Link to="/perfil" className="sidebar-profile" aria-current={current === '/perfil' ? 'page' : undefined}>
        <Avatar name={me.name} photoUrl={me.photoUrl} />
        <span className="grow">{me.name}</span>
      </Link>
    </nav>
  );
}

/** The computer's right column: my petiscos, a quick way into Pedir and my requests in progress. */
function SideColumn({ me }: { me: MeView }) {
  const mine = useQuery('requests.mine', {}, ['requests']);
  const [text, setText] = useState('');
  const requests = inProgress(mine.data ?? []);

  function ask(event: FormEvent) {
    event.preventDefault();
    if (!submitAskDraft(text)) return;
    setText('');
    navigate(ASK_PATH);
  }

  return (
    <aside className="side-column">
      <Link to="/petiscos" className="card petisco-card">
        <PetiscoIcon large />
        <span className="grow">
          <strong>{strings.petiscos.balance(me.petiscos.total)}</strong>
          <br />
          <span className="muted">{strings.petiscos.monthly(me.petiscos.monthlyAvailable, me.petiscos.monthlyQuota)}</span>
        </span>
      </Link>
      <form className="stack" onSubmit={ask}>
        <label>
          <span className="muted">{strings.nav.quickAskLabel}</span>
          <input type="search" autoComplete="off" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <button type="submit">{strings.nav.quickAskButton}</button>
      </form>
      <section>
        <h2>{strings.nav.inProgress}</h2>
        {mine.data && requests.length === 0 && <p className="muted">{strings.nav.noneInProgress}</p>}
        {requests.length > 0 && (
          <ul className="list">
            {requests.map((r) => (
              <li key={r.id}>
                <Link to={`/pedido/${r.id}`} className="card request-item">
                  <span className="grow">
                    <strong>{r.title}</strong>
                    <br />
                    <StatusChip status={r.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link to="/meus-pedidos">{strings.nav.seeAll}</Link>
        </p>
      </section>
    </aside>
  );
}

function Screen({ me, onSignOut }: { me: MeView; onSignOut: () => void }) {
  const path = usePath();
  const askVersion = useSyncExternalStore(subscribeAskDraft, askDraftVersion);
  if (path === '/pedir') return <Ask key={askVersion} me={me} />;
  if (path === '/meus-pedidos') return <MyRequests meId={me.id} />;
  const request = /^\/pedido\/([\w-]+)$/.exec(path);
  if (request) return <RequestDetail key={request[1]} id={request[1]} />;
  if (path === '/catalogo') return <Catalog />;
  if (path === '/numeros') return <GroupStats />;
  if (path === '/perfil') return <Profile key={me.id} me={me} onSignOut={onSignOut} />;
  if (path === '/petiscos') return <Petiscos />;
  if (path === '/gerenciar' && manageLinksFor(me).length > 0) return <ManageApp me={me} />;
  if (path === '/filas' && canAttend(me)) return <Queues me={me} />;
  if (path === '/gerenciar/petiscos' && canAttend(me)) return <ManagePetiscos />;
  if (path === '/membros' && canManageGroup(me)) return <Members me={me} />;
  if (path === '/convites' && canManageGroup(me)) return <Invites />;
  if (path === '/ajustes' && canManageGroup(me)) return <GroupSettings />;
  if (path === '/avisos') return <Inbox />;
  if (path === '/avisos/celular') return <PushPermission />;
  if (path === '/avisos/preferencias') return <NotificationPreferences />;
  return <Feed />;
}

/** "A Paçoca está dormindo": every attendant is on vacation (docs/spec/atendente.md). */
function SleepingNotice() {
  const vacation = useQuery('vacation', {}, ['vacation']);
  if (!vacation.data?.sleeping) return null;
  return (
    <p className="notice" role="status">
      {strings.vacation}
      {vacation.data.returnsOn && <> {strings.vacationReturns(formatDateKey(vacation.data.returnsOn))}</>}
    </p>
  );
}

function OfflineNotice() {
  const status = useLiveStatus();
  if (status !== 'offline') return null;
  return (
    <p className="notice" role="status">
      {strings.status.offline}
    </p>
  );
}

/** Números do Grupo: a chart in the header, a named link in the computer's sidebar. */
function StatsLink({ sidebar = false }: { sidebar?: boolean }) {
  const label = strings.nav.statsLong;
  return (
    <Link
      to="/numeros"
      className={sidebar ? 'tab sidebar-stats' : 'bell'}
      aria-label={label}
      title={label}
      aria-current={usePath() === '/numeros' ? 'page' : undefined}
    >
      <Icon name="stats" />
      {sidebar && (
        <span className="tab-long-label" aria-hidden="true">
          {label}
        </span>
      )}
    </Link>
  );
}

/** Avisos: a bell in the header, and a named link in the computer's sidebar; cherry when unread. */
function InboxLink({ sidebar = false }: { sidebar?: boolean }) {
  const inbox = useQuery('notifications.inbox', {}, ['notifications']);
  const unread = inbox.data?.unread ?? 0;
  const label = unread > 0 ? strings.notifications.navUnread(unread) : strings.notifications.nav;
  const here = isInboxPath(usePath());
  return (
    <Link
      to="/avisos"
      className={sidebar ? 'tab sidebar-inbox' : 'bell'}
      aria-label={label}
      title={label}
      aria-current={here ? 'page' : undefined}
    >
      <Icon name="bell" />
      {sidebar && (
        <span className="tab-long-label" aria-hidden="true">
          {strings.notifications.nav}
        </span>
      )}
      {unread > 0 && (
        <span className="unread-count" aria-hidden="true">
          {unread}
        </span>
      )}
    </Link>
  );
}

/** Gerenciamento do App: a gear in the header, a named link in the sidebar; only for who manages something. */
function ManageLink({ me, sidebar = false }: { me: MeView; sidebar?: boolean }) {
  const path = usePath();
  if (manageLinksFor(me).length === 0) return null;
  const label = strings.nav.manage;
  return (
    <Link
      to="/gerenciar"
      className={sidebar ? 'tab sidebar-manage' : 'bell'}
      aria-label={label}
      title={label}
      aria-current={isManagePath(path) ? 'page' : undefined}
    >
      <Icon name="gear" />
      {sidebar && (
        <span className="tab-long-label" aria-hidden="true">
          {label}
        </span>
      )}
    </Link>
  );
}

/**
 * A link shared while signed out waits through the sign-in (and the first access), which come
 * back to the home screen; once the app is ready, it opens Pedir, where the link is taken.
 */
function useSharedLinkRoute(ready: boolean) {
  useEffect(() => {
    if (ready && pendingShare(browserShareEnvironment()) !== null && window.location.pathname !== ASK_PATH) {
      navigate(ASK_PATH, { replace: true });
    }
  }, [ready]);
}

/**
 * Once signed in: sends this phone's push subscription to the server on every start (it may have
 * changed or been dropped as gone), and follows the screen a tapped notification asks for.
 */
function usePushSync(signedIn: boolean) {
  const { backend } = useServices();
  const push = usePushDevice();

  useEffect(() => push.onNavigate((path) => navigate(path)), [push]);

  useEffect(() => {
    if (!signedIn || push.state() !== 'granted') return;
    void (async () => {
      const settings = await backend.query('notifications.settings', {});
      if (!settings.ok || !settings.value.pushPublicKey) return;
      const subscription = await push.current(settings.value.pushPublicKey);
      if (subscription) await backend.command('push.subscribe', subscription);
    })();
  }, [backend, push, signedIn]);
}
