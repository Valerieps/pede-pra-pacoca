import type { FeedEventView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { Link } from '../router';
import { EmptyState } from '../components/EmptyState';
import { useQuery } from '../use-query';

function describe(event: FeedEventView) {
  const title = <em>{event.requestTitle}</em>;
  switch (event.type) {
    case 'member_joined':
      return strings.feed.memberJoined(event.actor.name);
    case 'request_created':
      return (
        <>
          {strings.feed.requestCreated(event.actor.name)} {title}
        </>
      );
    case 'co_request':
      return (
        <>
          {strings.feed.coRequest(event.actor.name)} {title}
        </>
      );
    default:
      // The other events arrive with their features (docs/ROADMAP.md).
      return event.actor.name;
  }
}

export function Feed() {
  const feed = useQuery('feed', {}, ['feed']);

  return (
    <section>
      <h1>{strings.feed.title}</h1>
      {feed.error && !feed.data && <p className="notice">{strings.genericError}</p>}
      {feed.data?.length === 0 && <EmptyState text={strings.feed.empty} />}
      <ul className="list">
        {feed.data?.map((event) => (
          <li key={event.id} className="card">
            {event.requestId ? (
              <Link to={`/pedido/${event.requestId}`} className="grow">
                {describe(event)}
              </Link>
            ) : (
              <span className="grow">{describe(event)}</span>
            )}
            <time className="muted" dateTime={event.at}>
              {new Date(event.at).toLocaleDateString('pt-BR')}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
