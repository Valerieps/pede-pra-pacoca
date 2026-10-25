import { useState } from 'react';
import type { FeedEventView } from '../../application/api-contract';
import { FEED_FILTERS, FEED_PAGE_SIZE, type FeedFilter } from '../../domain/feed/feed';
import { strings } from '../../domain/strings';
import { Avatar } from '../components/Avatar';
import { Poster } from '../components/Poster';
import { Link } from '../router';
import { EmptyState } from '../components/EmptyState';
import { PawLike } from '../components/PawLike';
import { SkeletonCards } from '../components/Skeleton';
import { StatusChip } from '../components/StatusChip';
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
    case 'request_fulfilled':
      return (
        <>
          {strings.feed.found} {title}!
        </>
      );
    // Recorded, but the server never lists them.
    case 'co_request':
      return null;
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
  // Where each page visited so far starts; the first page has no cursor and follows new events live.
  const [pages, setPages] = useState<(Cursor | null)[]>([null]);
  const [page, setPage] = useState(0);

  function choose(next: FeedFilter) {
    setFilter(next);
    setPages([null]);
    setPage(0);
  }

  function go(index: number, next?: Cursor) {
    if (next) setPages([...pages.slice(0, index), next]);
    setPage(index);
    window.scrollTo({ top: 0 });
  }

  return (
    <section>
      <h1 className="sr-only">{strings.feed.title}</h1>
      <div className="chips" role="group" aria-label={strings.feed.title}>
        {FEED_FILTERS.map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={f === filter} onClick={() => choose(f)}>
            {strings.feed.filters[f]}
          </button>
        ))}
      </div>
      <FeedPage
        key={`${filter}:${pages[page]?.beforeId ?? 'top'}`}
        filter={filter}
        cursor={pages[page]}
        page={page}
        onPrevious={() => go(page - 1)}
        onNext={(next) => go(page + 1, next)}
      />
    </section>
  );
}

function FeedPage({
  filter,
  cursor,
  page,
  onPrevious,
  onNext,
}: {
  filter: FeedFilter;
  cursor: Cursor | null;
  page: number;
  onPrevious: () => void;
  onNext: (next: Cursor) => void;
}) {
  const feed = useQuery('feed', { filter, ...(cursor ?? {}) }, ['feed']);
  const events = feed.data;
  const last = events?.[events.length - 1];
  // A full page may have older events after it; a shorter one is the end of the feed.
  const hasNext = last !== undefined && events!.length >= FEED_PAGE_SIZE;

  return (
    <>
      {feed.error && !events && <p className="notice">{strings.genericError}</p>}
      {!events && !feed.error && <SkeletonCards />}
      {page === 0 && events?.length === 0 && <EmptyState text={filter === 'all' ? strings.feed.empty : strings.feed.emptyFiltered} />}
      <ul className="list feed-page">
        {events?.map((event) => <FeedItem key={event.id} event={event} onChanged={feed.reload} />)}
      </ul>
      {(page > 0 || hasNext) && (
        <nav className="feed-pagination" aria-label={strings.feed.pagination}>
          <button type="button" className="secondary" disabled={page === 0} aria-label={strings.feed.previousPage} onClick={onPrevious}>
            &lt;
          </button>
          <span aria-current="page" aria-label={strings.feed.page(page + 1)}>
            {page + 1}
          </span>
          <button
            type="button"
            className="secondary"
            disabled={!hasNext}
            aria-label={strings.feed.nextPage}
            onClick={() => last && onNext({ before: last.at, beforeId: last.id })}
          >
            &gt;
          </button>
        </nav>
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

  async function toggleJoin(requestId: string) {
    setBusy(true);
    const result = await backend.command(event.joinedByMe ? 'request.leave' : 'request.join', { id: requestId });
    setBusy(false);
    if (result.ok) onChanged();
  }

  return (
    <li className="card feed-item">
      {/* The poster with the actor's photo on its corner; events without a title show only the photo */}
      <div className="feed-media">
        {event.requestId ? (
          <Link to={`/pedido/${event.requestId}`} className="feed-poster" tabIndex={-1} aria-hidden="true">
            <Poster path={event.requestPosterPath} title={event.requestTitle ?? ''} />
          </Link>
        ) : null}
        <Avatar name={event.actor.name} photoUrl={event.actor.photoUrl} />
      </div>
      <div className="feed-body">
        {event.requestId ? (
          <Link to={`/pedido/${event.requestId}`} className="feed-text">
            {describe(event)}
          </Link>
        ) : (
          <p className="feed-text">{describe(event)}</p>
        )}
        {event.type === 'request_created' && event.requestStatus && (
          <span className="feed-status">
            <StatusChip status={event.requestStatus} />
          </span>
        )}
        {/* "Eu também quero" and the paw on the right, the paw last, level with the poster's bottom */}
        <div className="feed-actions">
          <span className="feed-buttons">
            {(event.canJoin || event.joinedByMe) && event.requestId && (
              <button
                type="button"
                className="join-plus-one"
                aria-pressed={event.joinedByMe === true}
                disabled={busy}
                title={strings.request.joinTooltip}
                aria-label={strings.request.joinTooltip}
                onClick={() => void toggleJoin(event.requestId!)}
              >
                +1
              </button>
            )}
            {event.likeCount > 0 && (
              <button type="button" className="link muted" aria-expanded={showLikers} onClick={() => setShowLikers(!showLikers)}>
                {strings.feed.likeCount(event.likeCount)}
              </button>
            )}
            <PawLike liked={event.likedByMe} disabled={busy} onToggle={() => void toggleLike()} />
          </span>
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
