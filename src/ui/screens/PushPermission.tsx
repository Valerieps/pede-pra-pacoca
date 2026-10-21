// Asks for push permission, after explaining it; on iPhone, first explains that push needs the
// app installed on the home screen (docs/spec/app-e-instalacao.md).
import { useEffect, useState } from 'react';
import type { PushState } from '../../application/ports';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { usePushDevice } from '../push-context';
import { navigate } from '../router';
import { useQuery } from '../use-query';

const t = strings.notifications.permission;

export function PushPermission() {
  const { backend } = useServices();
  const push = usePushDevice();
  const settings = useQuery('notifications.settings', {}, ['notifications']);
  const [state, setState] = useState<PushState>(push.state());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    void push.isSubscribed().then(setSubscribed);
  }, [push]);
  const active = state === 'granted' && subscribed;

  async function enable() {
    const key = settings.data?.pushPublicKey;
    if (!key) return setError(true);
    setBusy(true);
    const subscription = await push.subscribe(key);
    const saved = subscription ? await backend.command('push.subscribe', subscription) : null;
    setBusy(false);
    setState(push.state());
    setSubscribed(subscription !== null);
    setError(push.state() === 'granted' && !saved?.ok);
  }

  async function disable() {
    setBusy(true);
    const endpoint = await push.unsubscribe();
    if (endpoint) await backend.command('push.unsubscribe', { endpoint });
    setBusy(false);
    setSubscribed(false);
  }

  return (
    <section>
      <h1>{t.title}</h1>
      <p>{t.intro}</p>
      {push.isIos && (
        <div className="notice">
          <strong>{t.iphoneTitle}</strong>
          <p>{t.iphone}</p>
        </div>
      )}
      {state === 'unsupported' && <p className="notice">{t.unsupported}</p>}
      {state === 'denied' && <p className="notice">{t.denied}</p>}
      {active && <p className="notice">{t.granted}</p>}
      {error && (
        <p className="notice" role="alert">
          {t.failed}
        </p>
      )}
      <div className="row">
        {(state === 'prompt' || (state === 'granted' && !active)) && (
          <>
            <button type="button" disabled={busy || !settings.data} onClick={() => void enable()}>
              {t.ask}
            </button>
            <button type="button" className="secondary" onClick={() => navigate('/avisos')}>
              {t.later}
            </button>
          </>
        )}
        {active && (
          <button type="button" className="secondary" disabled={busy} onClick={() => void disable()}>
            {t.turnOff}
          </button>
        )}
      </div>
    </section>
  );
}
