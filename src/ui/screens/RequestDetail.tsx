import { useEffect, useState } from 'react';
import type { CommandName, Commands, RequestDetailView } from '../../application/api-contract';
import { isUnreleased, letterboxdUrl } from '../../domain/media/media';
import { reasonText } from '../../domain/request/reason';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { browserCelebrationStore, celebratesFulfilled, firstCelebration } from '../../infrastructure/celebrations';
import { PacocaCelebration } from '../components/PacocaCelebration';
import { Poster } from '../components/Poster';
import { SkeletonCards } from '../components/Skeleton';
import { StatusChip } from '../components/StatusChip';
import { useQuery } from '../use-query';

const date = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export function RequestDetail({ id }: { id: string }) {
  const detail = useQuery('request.detail', { id }, ['requests']);

  if (!detail.data) {
    if (!detail.error) return <SkeletonCards count={1} />;
    return <p className="notice">{detail.error === 'not_found' ? strings.request.notFound : strings.genericError}</p>;
  }
  return <Detail request={detail.data} />;
}

function Detail({ request }: { request: RequestDetailView }) {
  const { backend } = useServices();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const { viewer } = request;

  // The Paçoca celebrates my Cãopleto once per phone, also when it arrives while I look.
  const celebrates = celebratesFulfilled(request);
  useEffect(() => {
    if (celebrates && firstCelebration(browserCelebrationStore(), request.id)) setCelebrate(true);
  }, [celebrates, request.id]);

  async function run<N extends CommandName>(name: N, input: Commands[N]['input']): Promise<boolean> {
    setBusy(true);
    const result = await backend.command(name, input);
    setBusy(false);
    setError(result.ok ? null : result.error === 'forbidden' ? strings.forbidden : strings.genericError);
    return result.ok;
  }

  function cancel() {
    const question = request.coRequesters.length > 0 ? strings.request.cancelConfirmShared : strings.request.cancelConfirm;
    if (window.confirm(question)) void run('request.cancel', { id: request.id });
  }

  async function saveNote() {
    if (editing !== null && (await run('request.editNote', { id: request.id, note: editing }))) setEditing(null);
  }

  return (
    <section>
      {celebrate && <PacocaCelebration text={strings.fulfilled(request.title)} onClose={() => setCelebrate(false)} />}
      <div className="media-header">
        <Poster path={request.posterPath} title={request.title} />
        <div className="media-info">
          <h1>{request.title}</h1>
          {request.tmdbId !== null ? <MediaFacts request={request} tmdbId={request.tmdbId} /> : <p className="muted">{[request.year, strings.mediaType[request.mediaType]].filter(Boolean).join(' · ')}</p>}
          <div className="media-status">
            {isUnreleased(request.releaseDate, new Date()) && <span className="badge">{strings.confirm.unreleased}</span>}
            <StatusChip status={request.status} />
          </div>
        </div>
      </div>

      {request.reason && <p className="notice">{strings.request.reason(reasonText(request.reason))}</p>}
      {request.fulfillmentNote && <p className="notice">{strings.request.fulfillmentNote(request.fulfillmentNote)}</p>}

      <p>
        {strings.request.requestedBy(request.requester.name)}
        {request.assignee && <> · {strings.request.assignee(request.assignee.name)}</>}
        <br />
        <span className="muted">{strings.request.createdAt(date(request.createdAt))}</span>
      </p>
      {request.coRequesters.length > 0 && <p>{strings.request.alsoWant(request.coRequesters.map((m) => m.name).join(', '))}</p>}

      {request.link && (
        <p>
          <a href={request.link} target="_blank" rel="noopener noreferrer">
            {strings.request.openLink}
          </a>
        </p>
      )}

      {editing === null ? (
        <>
          {request.note && (
            <p>
              <span className="muted">{strings.request.noteLabel}: </span>
              {request.note}
            </p>
          )}
          {viewer.canEditNote && (
            <button type="button" className="link" onClick={() => setEditing(request.note ?? '')}>
              {strings.request.editNote}
            </button>
          )}
        </>
      ) : (
        <div className="stack">
          <label>
            <span className="muted">{strings.request.noteLabel}</span>
            <textarea maxLength={500} rows={3} value={editing} onChange={(e) => setEditing(e.target.value)} />
          </label>
          <div className="row">
            <button type="button" disabled={busy} onClick={() => void saveNote()}>
              {strings.request.save}
            </button>
            <button type="button" className="secondary" onClick={() => setEditing(null)}>
              {strings.request.cancelEdit}
            </button>
          </div>
        </div>
      )}

      {request.offer &&
        (viewer.hasOffer ? (
          <div className="notice">
            <p>{strings.request.offerForYou(request.requester.name)}</p>
            <div className="row">
              <button type="button" disabled={busy} onClick={() => void run('request.answerOffer', { id: request.id, accept: true })}>
                {strings.request.accept}
              </button>
              <button type="button" className="secondary" disabled={busy} onClick={() => void run('request.answerOffer', { id: request.id, accept: false })}>
                {strings.request.decline}
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">{strings.request.offerPending(request.offer.member.name, date(request.offer.expiresAt))}</p>
        ))}

      <div className="row actions">
        {viewer.canJoin && (
          <button type="button" disabled={busy} onClick={() => void run('request.join', { id: request.id })}>
            {strings.request.join}
          </button>
        )}
        {viewer.canLeave && !viewer.hasOffer && (
          <button type="button" className="secondary" disabled={busy} onClick={() => void run('request.leave', { id: request.id })}>
            {strings.request.leave}
          </button>
        )}
        {viewer.canCancel && (
          <button type="button" className="danger" disabled={busy} onClick={cancel}>
            {strings.request.cancel}
          </button>
        )}
      </div>

      {viewer.canGiveFeedback && <Feedback request={request} busy={busy} run={run} />}
      {request.status === 'fulfilled' && request.tmdbId !== null && <Letterboxd url={letterboxdUrl(request.mediaType, request.tmdbId)} />}

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      <h2>{strings.request.history}</h2>
      <ol className="history">
        {request.transitions.map((t, i) => (
          <li key={i}>
            <time className="muted" dateTime={t.at}>
              {date(t.at)}
            </time>{' '}
            {(t.event && strings.request.events[t.event]) || strings.requestStatus[t.to]}
            {t.actor && <span className="muted"> · {t.actor.name}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The line under the title (year, type, runtime or episodes, up to two genres) and the line of
 * scores. They are looked up apart from the request, so while the lookup runs or fails only the
 * year and the type show, and a missing score leaves no gap.
 */
function MediaFacts({ request, tmdbId }: { request: RequestDetailView; tmdbId: number }) {
  const extra = useQuery('media.imdb', { type: request.mediaType, tmdbId }, []).data;
  const length = extra && (request.mediaType === 'movie' ? extra.runtime && strings.request.runtime(extra.runtime) : extra.episodes && strings.request.episodes(extra.episodes));
  const line = [request.year, strings.mediaType[request.mediaType], length, ...(extra?.genres ?? [])].filter(Boolean).join(' · ');
  return (
    <>
      <p className="muted media-line">{line}</p>
      {extra && (
        <ul className="scores">
          {extra.imdbId && (
            <li>
              <a href={`https://www.imdb.com/title/${extra.imdbId}/`} target="_blank" rel="noopener noreferrer" aria-label={strings.request.openImdb}>
                <span className="logo-imdb" aria-hidden="true">
                  IMDb
                </span>
                {extra.rating !== null && <span aria-label={strings.request.imdbScore}> {extra.rating.toFixed(1)}</span>}
              </a>
            </li>
          )}
          {extra.criticsScore !== null && (
            <li aria-label={strings.request.criticsScore}>
              <span aria-hidden="true">🍅</span> {extra.criticsScore}%
            </li>
          )}
          {extra.audienceScore !== null && (
            <li aria-label={strings.request.audienceScore}>
              <span aria-hidden="true">🍿</span> {extra.audienceScore}%
            </li>
          )}
          {extra.tmdbRating !== null && (
            <li aria-label={strings.request.tmdbScore}>
              <span className="logo-tmdb" aria-hidden="true">
                TMDB
              </span>{' '}
              {extra.tmdbRating.toFixed(1)}
            </li>
          )}
        </ul>
      )}
    </>
  );
}

/** On an Cãopleto movie, for every member: rating it happens on Letterboxd, not in the app. */
function Letterboxd({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <p>
      {strings.request.watched}{' '}
      <a href={url} target="_blank" rel="noopener noreferrer">
        {strings.request.openLetterboxd}
      </a>
    </p>
  );
}

type Run =<N extends CommandName>(name: N, input: Commands[N]['input']) => Promise<boolean>;

/** "Dar retorno" on an Cãopleto request: "Obrigada, Paçoca". */
function Feedback({ request, busy, run }: { request: RequestDetailView; busy: boolean; run: Run }) {
  const { feedback } = request.viewer;
  return (
    <div className="stack">
      <h2>{strings.request.feedbackTitle}</h2>
      {feedback.thanked ? (
        <p className="muted">{strings.request.thanked}</p>
      ) : (
        <button type="button" disabled={busy} onClick={() => void run('request.thank', { id: request.id })}>
          {strings.request.thank}
        </button>
      )}
    </div>
  );
}
