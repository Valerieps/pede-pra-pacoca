import { useEffect } from 'react';
import type { MeView } from '../application/api-contract';
import { canAttend, canManageGroup } from '../domain/group/roles';
import { strings } from '../domain/strings';
import { useLiveStatus, useServices } from './backend-context';
import { InstallGuide } from './components/InstallGuide';
import { Link, navigate, usePath } from './router';
import { usePushDevice } from './push-context';
import { Ask } from './screens/Ask';
import { Feed } from './screens/Feed';
import { GroupStats } from './screens/GroupStats';
import { MemberStats } from './screens/MemberStats';
import { Inbox } from './screens/Inbox';
import { Invites } from './screens/Invites';
import { NotificationPreferences } from './screens/NotificationPreferences';
import { PushPermission } from './screens/PushPermission';
import { MyRequests } from './screens/MyRequests';
import { RequestDetail } from './screens/RequestDetail';
import { Members } from './screens/Members';
import { Petiscos } from './screens/Petiscos';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import { SignIn } from './screens/SignIn';
import { formatDateKey } from './format';
import { useQuery } from './use-query';

export function App() {
  const { backend, live } = useServices();
  const me = useQuery('me', {}, ['me']);
  const signedIn = me.data !== undefined && me.error !== 'unauthenticated';

  useEffect(() => {
    if (!signedIn) return;
    live.start();
    return () => live.stop();
  }, [live, signedIn]);

  usePushSync(signedIn);

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
        <Profile me={me.data} firstAccess />
      </main>
    );
  }

  async function signOut() {
    await backend.signOut();
    navigate('/', { replace: true });
    me.reload();
  }

  return (
    <div className="app">
      <header className="row">
        <strong className="grow">{strings.appName}</strong>
        <Link to="/petiscos" className="muted">
          {strings.petiscos.balance(me.data.petiscos.total)}
        </Link>
      </header>
      <OfflineNotice />
      <SleepingNotice />
      <InstallGuide />
      <nav className="row">
        <Link to="/">{strings.nav.feed}</Link>
        <InboxLink />
        <Link to="/pedir">{strings.nav.ask}</Link>
        <Link to="/meus-pedidos">{strings.nav.myRequests}</Link>
        <Link to="/membros">{strings.nav.members}</Link>
        <Link to="/numeros">{strings.nav.stats}</Link>
        {canManageGroup(me.data) && <Link to="/convites">{strings.nav.invites}</Link>}
        <Link to="/petiscos">{strings.nav.petiscos}</Link>
        {canAttend(me.data) && <Link to="/ajustes">{strings.nav.settings}</Link>}
        <Link to="/perfil">{strings.nav.profile}</Link>
        <button type="button" className="link" onClick={() => void signOut()}>
          {strings.nav.signOut}
        </button>
      </nav>
      <main>
        <Screen me={me.data} />
      </main>
    </div>
  );
}

function Screen({ me }: { me: MeView }) {
  const path = usePath();
  if (path === '/convites' && canManageGroup(me)) return <Invites />;
  if (path === '/pedir') return <Ask me={me} />;
  if (path === '/meus-pedidos') return <MyRequests meId={me.id} />;
  const request = /^\/pedido\/([\w-]+)$/.exec(path);
  if (request) return <RequestDetail key={request[1]} id={request[1]} />;
  if (path === '/membros') return <Members me={me} />;
  const member = /^\/membro\/([\w-]+)$/.exec(path);
  if (member) return <MemberStats key={member[1]} memberId={member[1]} />;
  if (path === '/numeros') return <GroupStats />;
  if (path === '/perfil') return <Profile key={me.id} me={me} />;
  if (path === '/petiscos') return <Petiscos />;
  if (path === '/ajustes' && canAttend(me)) return <Settings me={me} />;
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

function InboxLink() {
  const inbox = useQuery('notifications.inbox', {}, ['notifications']);
  const unread = inbox.data?.unread ?? 0;
  return <Link to="/avisos">{unread > 0 ? strings.notifications.navUnread(unread) : strings.notifications.nav}</Link>;
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
