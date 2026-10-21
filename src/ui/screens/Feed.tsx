import { useState } from 'react';
import type { FeedEventView } from '../../application/api-contract';
import { FEED_FILTERS, FEED_PAGE_SIZE, type FeedFilter } from '../../domain/feed/feed';
import { strings } from '../../domain/strings';
import { Avatar } from '../components/Avatar';
import { Poster } from '../components/Poster';
import { Link } from '../router';
import { EmptyState } from '../components/EmptyState';
import { PawLike } from '../components/PawLike';
import { useServices } from '../backend-context';
import { useQuery } from '../use-query';

function describe(event: FeedEventView) {
  const title = <em className="media-title">{event.requestTitle}</em>;
  switch (event.type) {
    case 'member_joined':
      return strings.feed.memberJoined(event.actor.name);
    case 'cashback':
      return strings.feed.cashback(event.actor.name);
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
    case 'request_fulfilled':
      return (
        <>
          {strings.feed.fulfilledBefore} {title} {strings.feed.fulfilledFor(event.fulfilledFor ?? [event.actor.name])}
        </>
      );
    case 'watched':
      return (
        <>
          {strings.feed.watched(event.actor.name)} {title}
          {event.rating ? <> {strings.feed.rated(event.rating)}</> : null}
        </>
      );
    case 'thanked':
      return strings.feed.thanked(event.actor.name);
  }
}

/** Where a page starts: right after the last event of the page before it. */
interface Cursor {
  readonly before: string;
  readonly beforeId: string;
}

export function Feed() {
  const [filter, setFilter] = useState<FeedFilter>('all');
  // One entry per loaded page; the first page has no cursor and follows new events live.
  const [pages, setPages] = useState<(Cursor | null)[]>([null]);

  function choose(next: FeedFilter) {
    setFilter(next);
    setPages([null]);
  }

  return (
    <section>
      <h1>{strings.feed.title}</h1>
      <div className="chips" role="group" aria-label={strings.feed.title}>
        {FEED_FILTERS.map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={f === filter} onClick={() => choose(f)}>
            {strings.feed.filters[f]}
          </button>
        ))}
      </div>
      {pages.map((cursor, index) => (
        <FeedPage
          key={`${filter}:${cursor?.beforeId ?? 'top'}`}
          filter={filter}
          cursor={cursor}
          isLast={index === pages.length - 1}
          onMore={(next) => setPages([...pages, next])}
        />
      ))}
    </section>
  );
}

function FeedPage({ filter, cursor, isLast, onMore }: { filter: FeedFilter; cursor: Cursor | null; isLast: boolean; onMore: (next: Cursor) => void }) {
  const feed = useQuery('feed', { filter, ...(cursor ?? {}) }, ['feed']);
  const events = feed.data;
  const last = events?.[events.length - 1];

  return (
    <>
      {feed.error && !events && <p className="notice">{strings.genericError}</p>}
      {cursor === null && events?.length === 0 && <EmptyState text={filter === 'all' ? strings.feed.empty : strings.feed.emptyFiltered} />}
      <ul className="list feed-page">
        {events?.map((event) => <FeedItem key={event.id} event={event} onChanged={feed.reload} />)}
      </ul>
      {isLast && last && events.length >= FEED_PAGE_SIZE && (
        <button type="button" className="secondary feed-more" onClick={() => onMore({ before: last.at, beforeId: last.id })}>
          {strings.feed.loadMore}
        </button>
      )}
    </>
  );
}

function FeedItem({ event, onChanged }: { event: FeedEventView; onChanged: () => void }) {
  const { backend } = useServices();
  const [showLikers, setShowLikers] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleLike() {
    setBusy(true);
    // Other open apps refresh through the "feed" topic; this one refreshes now, live or not.
    const result = await backend.command('feed.toggleLike', { eventId: event.id });
    setBusy(false);
    if (result.ok) onChanged();
  }

  return (
    <li className="card feed-item">
      {event.requestId && (
        <Link to={`/pedido/${event.requestId}`} className="feed-poster" tabIndex={-1} aria-hidden="true">
          <Poster path={event.requestPosterPath} title={event.requestTitle ?? ''} />
        </Link>
      )}
      <div className="feed-body">
        <div className="feed-line">
          <Avatar name={event.actor.name} photoUrl={event.actor.photoUrl} />
          {event.requestId ? (
            <Link to={`/pedido/${event.requestId}`} className="grow feed-text">
              {describe(event)}
            </Link>
          ) : (
            <span className="grow feed-text">{describe(event)}</span>
          )}
          <time className="muted" dateTime={event.at}>
            {new Date(event.at).toLocaleDateString('pt-BR')}
          </time>
        </div>
        <div className="feed-actions">
          <PawLike liked={event.likedByMe} disabled={busy} onToggle={() => void toggleLike()} />
          {event.likeCount > 0 && (
            <button type="button" className="link muted" aria-expanded={showLikers} onClick={() => setShowLikers(!showLikers)}>
              {strings.feed.likeCount(event.likeCount)}
            </button>
          )}
        </div>
        {showLikers && event.likeCount > 0 && <Likers eventId={event.id} />}
      </div>
    </li>
  );
}

function Likers({ eventId }: { eventId: string }) {
  const likers = useQuery('feed.likes', { eventId }, ['feed']);
  return (
    <ul className="likers" aria-label={strings.feed.likedBy}>
      {likers.data?.map((member) => (
        <li key={member.id} className="choice">
          <Avatar name={member.name} photoUrl={member.photoUrl} />
          <span>{member.name}</span>
        </li>
      ))}
    </ul>
  );
}
