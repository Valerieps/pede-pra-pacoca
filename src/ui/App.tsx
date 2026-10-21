import { useEffect, useState } from 'react';
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
import { Queues } from './screens/Queues';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
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
        {canAttend(me.data) && <Link to="/filas">{strings.nav.queues}</Link>}
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
  if (path === '/filas' && canAttend(me)) return <Queues me={me} />;
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
