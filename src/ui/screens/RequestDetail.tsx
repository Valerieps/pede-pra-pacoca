import { useState } from 'react';
import type { CommandName, Commands, RequestDetailView } from '../../application/api-contract';
import { isUnreleased } from '../../domain/media/media';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Poster } from '../components/Poster';
import { useQuery } from '../use-query';

const date = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export function RequestDetail({ id }: { id: string }) {
  const detail = useQuery('request.detail', { id }, ['requests']);

  if (!detail.data) {
    if (!detail.error) return null;
    return <p className="notice">{detail.error === 'not_found' ? strings.request.notFound : strings.genericError}</p>;
  }
  return <Detail request={detail.data} />;
}

function Detail({ request }: { request: RequestDetailView }) {
  const { backend } = useServices();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const { viewer } = request;

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
      <div className="media-header">
        <Poster path={request.posterPath} title={request.title} />
        <div>
          <h1>{request.title}</h1>
          <p className="muted">{[request.year, strings.mediaType[request.mediaType]].filter(Boolean).join(' · ')}</p>
          {isUnreleased(request.releaseDate, new Date()) && <span className="badge">{strings.confirm.unreleased}</span>}
          <p className="status">{strings.requestStatus[request.status]}</p>
        </div>
      </div>

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
