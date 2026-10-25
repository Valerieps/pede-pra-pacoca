import { useState, type FormEvent } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import type { NotificationPrefs } from '../../domain/notification/preferences';
import { ATTENDANT_TYPES, CONFIGURABLE_TYPES } from '../../domain/notification/types';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { useQuery } from '../use-query';

const t = strings.notifications.preferences;

export function NotificationPreferences() {
  const settings = useQuery('notifications.settings', {}, ['notifications']);
  if (!settings.data) return settings.error ? <p className="notice">{strings.genericError}</p> : null;
  // Keyed by the saved value, so a change from another phone resets the form.
  return <PreferencesForm key={JSON.stringify(settings.data.prefs)} saved={settings.data.prefs} attendant={settings.data.attendant} />;
}

function PreferencesForm({ saved, attendant }: { saved: NotificationPrefs; attendant: boolean }) {
  const { backend } = useServices();
  const [prefs, setPrefs] = useState(saved);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const types = CONFIGURABLE_TYPES.filter((type) => attendant || !ATTENDANT_TYPES.includes(type));
  const quiet = prefs.quietHours;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await backend.command('notifications.setPrefs', prefs);
    setBusy(false);
    setMessage(result.ok ? t.saved : result.error === 'invalid' ? t.invalid : strings.genericError);
  }

  return (
    <section>
      <Breadcrumbs items={[{ label: strings.notifications.title, to: '/avisos' }, { label: t.title }]} />
      <h1 className="sr-only">{t.title}</h1>
      <form onSubmit={submit} className="stack">
        <fieldset>
          <legend>{t.types}</legend>
          {types.map((type) => (
            <label key={type} className="choice">
              <input
                type="checkbox"
                checked={prefs.enabled[type]}
                onChange={(e) => setPrefs({ ...prefs, enabled: { ...prefs.enabled, [type]: e.target.checked } })}
              />
              <span>{t.labels[type]}</span>
            </label>
          ))}
        </fieldset>

        {attendant && (
          <fieldset>
            <legend>{t.newRequests}</legend>
            <label className="choice">
              <input type="radio" name="newRequests" checked={prefs.newRequests === 'immediate'} onChange={() => setPrefs({ ...prefs, newRequests: 'immediate' })} />
              <span>{t.immediate}</span>
            </label>
            <label className="choice">
              <input type="radio" name="newRequests" checked={prefs.newRequests === 'digest'} onChange={() => setPrefs({ ...prefs, newRequests: 'digest' })} />
              <span>{t.digest}</span>
            </label>
            {prefs.newRequests === 'digest' && (
              <label>
                <span className="muted">{t.digestTime}</span>
                <input type="time" required value={prefs.digestTime} onChange={(e) => setPrefs({ ...prefs, digestTime: e.target.value })} />
              </label>
            )}
          </fieldset>
        )}

        <fieldset>
          <legend>{t.quietHours}</legend>
          <label className="choice">
            <input
              type="checkbox"
              checked={quiet !== null}
              onChange={(e) => setPrefs({ ...prefs, quietHours: e.target.checked ? (saved.quietHours ?? { start: '23:00', end: '08:00' }) : null })}
            />
            <span>{t.quietHours}</span>
          </label>
          {quiet && (
            <div className="row">
              <label className="grow">
                <span className="muted">{t.quietStart}</span>
                <input type="time" required value={quiet.start} onChange={(e) => setPrefs({ ...prefs, quietHours: { ...quiet, start: e.target.value } })} />
              </label>
              <label className="grow">
                <span className="muted">{t.quietEnd}</span>
                <input type="time" required value={quiet.end} onChange={(e) => setPrefs({ ...prefs, quietHours: { ...quiet, end: e.target.value } })} />
              </label>
            </div>
          )}
          <p className="muted">{t.quietHoursHint}</p>
        </fieldset>

        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {t.save}
        </button>
      </form>
    </section>
  );
}
