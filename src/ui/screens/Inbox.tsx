import { useState } from 'react';
import type { InboxItemView } from '../../application/api-contract';
import type { NotificationType } from '../../domain/notification/types';
import { strings } from '../../domain/strings';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { SkeletonCards } from '../components/Skeleton';
import { useServices } from '../backend-context';
import { usePushDevice } from '../push-context';
import { Link, navigate } from '../router';
import { useQuery } from '../use-query';

const t = strings.notifications;

/** What the Paçoca brings with each kind of notice. */
const GLYPHS: Record<NotificationType, string> = {
  request_new: '🎬',
  request_pending: '⏳',
  request_approved: '🐶',
  request_closed: '🙈',
  request_partially_available: '🍿',
  request_fulfilled: '🍿',
  co_request: '🙋',
  likes: '🐾',
  petisco_received: '🦴',
  petisco_expiring: '⏰',
  monthly_renewed: '🦴',
  thanked: '💛',
  webhook_failed: '⚠️',
  inheritance_offer: '🎁',
  problem_reported: '🔧',
  problem_resolved: '✨',
  daily_digest: '📰',
};

// The inbox shows only unread notices (docs/spec/notificacoes.md): a seen one leaves at once,
// without waiting for the live connection to refetch.
export function Inbox() {
  const { backend } = useServices();
  const push = usePushDevice();
  const inbox = useQuery('notifications.inbox', {}, ['notifications']);
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const items = inbox.data?.items.filter((item) => !seen.has(item.id));

  async function markRead(ids?: string[]) {
    setSeen((before) => new Set([...before, ...(ids ?? items?.map((i) => i.id) ?? [])]));
    await backend.command('notifications.markRead', ids ? { ids } : {});
    inbox.reload();
  }

  async function open(item: InboxItemView) {
    await markRead([item.id]);
    navigate(item.url);
  }

  return (
    <section className="inbox">
      <h1 className="sr-only">{t.title}</h1>
      <div className="inbox-links">
        <Link to="/avisos/preferencias">{t.preferencesLink}</Link>
        {push.state() !== 'granted' && <Link to="/avisos/celular">{t.enableLink}</Link>}
      </div>
      {inbox.error && !inbox.data && <p className="notice">{strings.genericError}</p>}
      {!inbox.data && !inbox.error && <SkeletonCards poster={false} />}
      {items?.length === 0 && <EmptyState text={t.empty} />}
      {items && items.length > 0 && (
        <>
          <div className="inbox-head">
            <p className="pacoca-line">{t.heading(items.length)}</p>
            <button type="button" className="secondary" onClick={() => void markRead()}>
              {t.markAllRead}
            </button>
          </div>
          <ul className="list">
            {items.map((item) => (
              <li key={item.id} className="inbox-item">
                <button type="button" className="inbox-open" onClick={() => void open(item)}>
                  <span className="inbox-glyph" aria-hidden="true">
                    {GLYPHS[item.type]}
                  </span>
                  <span className="inbox-text">
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </span>
                </button>
                <button type="button" className="icon-button inbox-dismiss" aria-label={t.dismiss} title={t.dismiss} onClick={() => void markRead([item.id])}>
                  <Icon name="check" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
