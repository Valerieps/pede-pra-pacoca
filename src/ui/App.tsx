import { useEffect } from 'react';
import { canManageGroup } from '../domain/group/roles';
import { strings } from '../domain/strings';
import { useLiveStatus, useServices } from './backend-context';
import type { MeView } from '../application/api-contract';
import { Link, navigate, usePath } from './router';
import { Ask } from './screens/Ask';
import { Feed } from './screens/Feed';
import { Invites } from './screens/Invites';
import { MyRequests } from './screens/MyRequests';
import { RequestDetail } from './screens/RequestDetail';
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
        <Link to="/pedir">{strings.nav.ask}</Link>
        <Link to="/meus-pedidos">{strings.nav.myRequests}</Link>
        {canManageGroup(me.data) && <Link to="/convites">{strings.nav.invites}</Link>}
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
