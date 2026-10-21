import { useEffect } from 'react';
import { canManageGroup } from '../domain/group/roles';
import { strings } from '../domain/strings';
import { useLiveStatus, useServices } from './backend-context';
import { Link, navigate, usePath } from './router';
import { usePushDevice } from './push-context';
import { Feed } from './screens/Feed';
import { Inbox } from './screens/Inbox';
import { Invites } from './screens/Invites';
import { NotificationPreferences } from './screens/NotificationPreferences';
import { PushPermission } from './screens/PushPermission';
import { SignIn } from './screens/SignIn';
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

  async function signOut() {
    await backend.signOut();
    navigate('/', { replace: true });
    me.reload();
  }

  return (
    <div className="app">
      <header className="row">
        <strong className="grow">{strings.appName}</strong>
        <span className="muted">{strings.petiscos.balance(me.data.petiscos.total)}</span>
      </header>
      <OfflineNotice />
      <nav className="row">
        <Link to="/">{strings.nav.feed}</Link>
        <InboxLink />
        {canManageGroup(me.data) && <Link to="/convites">{strings.nav.invites}</Link>}
        <button type="button" className="link" onClick={() => void signOut()}>
          {strings.nav.signOut}
        </button>
      </nav>
      <main>
        <Screen isAdmin={canManageGroup(me.data)} />
      </main>
    </div>
  );
}

function Screen({ isAdmin }: { isAdmin: boolean }) {
  const path = usePath();
  if (path === '/convites' && isAdmin) return <Invites />;
  if (path === '/avisos') return <Inbox />;
  if (path === '/avisos/celular') return <PushPermission />;
  if (path === '/avisos/preferencias') return <NotificationPreferences />;
  return <Feed />;
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
