import type { InboxItemView } from '../../application/api-contract';
import { GROUP_TIME_ZONE } from '../../domain/time';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { usePushDevice } from '../push-context';
import { Link, navigate } from '../router';
import { useQuery } from '../use-query';

const t = strings.notifications;
const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: GROUP_TIME_ZONE });

export function Inbox() {
  const { backend } = useServices();
  const push = usePushDevice();
  const inbox = useQuery('notifications.inbox', {}, ['notifications']);

  async function open(item: InboxItemView) {
    if (!item.read) await backend.command('notifications.markRead', { ids: [item.id] });
    navigate(item.url);
  }

  return (
    <section>
      <h1>{t.title}</h1>
      <div className="row">
        <Link to="/avisos/preferencias">{t.preferencesLink}</Link>
        {push.state() !== 'granted' && <Link to="/avisos/celular">{t.enableLink}</Link>}
        <span className="grow" />
        {(inbox.data?.unread ?? 0) > 0 && (
          <button type="button" className="secondary" onClick={() => void backend.command('notifications.markRead', {})}>
            {t.markAllRead}
          </button>
        )}
      </div>
      {inbox.error && !inbox.data && <p className="notice">{strings.genericError}</p>}
      {inbox.data?.items.length === 0 && <p className="muted">{t.empty}</p>}
      <ul className="list">
        {inbox.data?.items.map((item) => (
          <li key={item.id}>
            <button type="button" className={`card inbox-item${item.read ? '' : ' unread'}`} onClick={() => void open(item)}>
              <span className="grow">
                <strong>{item.title}</strong>
                {!item.read && <span className="badge">{t.unread}</span>}
                <br />
                {item.body}
              </span>
              <time className="muted" dateTime={item.at}>
                {when.format(new Date(item.at))}
              </time>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
