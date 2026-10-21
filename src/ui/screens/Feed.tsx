import type { FeedEventView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { useQuery } from '../use-query';

function describe(event: FeedEventView): string {
  switch (event.type) {
    case 'member_joined':
      return strings.feed.memberJoined(event.actor.name);
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
      {feed.data?.length === 0 && <p className="muted">{strings.feed.empty}</p>}
      <ul className="list">
        {feed.data?.map((event) => (
          <li key={event.id} className="card">
            <span>{describe(event)}</span>
            <time className="muted" dateTime={event.at}>
              {new Date(event.at).toLocaleDateString('pt-BR')}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
