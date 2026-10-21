// Pedir (docs/spec/pedidos.md): paste a link, or search, then confirm; or a manual request.
import { useState, type FormEvent } from 'react';
import type { ApiError, MediaCardView, MeView, PreviewInput, SearchType } from '../../application/api-contract';
import { isAttendant } from '../../domain/group/roles';
import { isUnreleased, type MediaType } from '../../domain/media/media';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Poster } from '../components/Poster';
import { Link, navigate } from '../router';
import { useQuery } from '../use-query';

type Step = { kind: 'search' } | { kind: 'confirm'; input: PreviewInput } | { kind: 'manual'; title: string };

const FILTERS: { value: SearchType; label: string }[] = [
  { value: 'all', label: strings.ask.filterAll },
  { value: 'movie', label: strings.mediaType.movie },
  { value: 'tv', label: strings.mediaType.tv },
];

function errorText(error: ApiError): string {
  if (error === 'unrecognized_link') return strings.ask.unrecognizedLink;
  if (error === 'not_found') return strings.ask.notFound;
  if (error === 'forbidden') return strings.forbidden;
  return strings.genericError;
}

export function Ask({ me }: { me: MeView }) {
  const [step, setStep] = useState<Step>({ kind: 'search' });
  const back = () => setStep({ kind: 'search' });

  if (step.kind === 'confirm') return <Confirm me={me} input={step.input} onBack={back} />;
  if (step.kind === 'manual') return <ManualForm me={me} initialTitle={step.title} onBack={back} />;
  return <Search onPick={(input) => setStep({ kind: 'confirm', input })} onManual={(title) => setStep({ kind: 'manual', title })} />;
}

function Search({ onPick, onManual }: { onPick: (input: PreviewInput) => void; onManual: (title: string) => void }) {
  const { backend } = useServices();
  const [link, setLink] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<SearchType>('all');
  const [results, setResults] = useState<MediaCardView[] | null>(null);
  const [searched, setSearched] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openLink(event: FormEvent) {
    event.preventDefault();
    if (link.trim()) onPick({ text: link });
  }

  async function search(event: FormEvent, filter: SearchType = type) {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    setBusy(true);
    const result = await backend.query('media.search', { query: text, type: filter });
    setBusy(false);
    if (result.ok) {
      setResults(result.value);
      setSearched(text);
      setError(null);
    } else {
      setError(errorText(result.error));
    }
  }

  return (
    <section>
      <h1>{strings.ask.title}</h1>
      <form className="row" onSubmit={openLink}>
        <label className="grow">
          <span className="muted">{strings.ask.linkLabel}</span>
          <input type="url" inputMode="url" autoComplete="off" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        <button type="submit">{strings.ask.linkButton}</button>
      </form>

      <form className="row" onSubmit={(e) => void search(e)}>
        <label className="grow">
          <span className="muted">{strings.ask.searchLabel}</span>
          <input type="search" autoComplete="off" maxLength={100} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>
          {strings.ask.searchButton}
        </button>
      </form>
      <div className="chips" role="group" aria-label={strings.ask.searchLabel}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={f.value === type ? 'chip chip-on' : 'chip'}
            aria-pressed={f.value === type}
            onClick={(e) => {
              setType(f.value);
              if (results) void search(e, f.value);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      {results && results.length === 0 && (
        <div className="notice">
          <p>{strings.ask.noResults}</p>
          <button type="button" onClick={() => onManual(searched)}>
            {strings.ask.manualOffer}
          </button>
        </div>
      )}

      {results && results.length > 0 && (
        <ul className="carousel">
          {results.map((media) => (
            <li key={`${media.type}:${media.tmdbId}`}>
              <button type="button" className="media-card" onClick={() => onPick({ type: media.type, tmdbId: media.tmdbId })}>
                <Poster path={media.posterPath} title={media.title} />
                <strong>{media.title}</strong>
                <span className="muted">
                  {[media.year, strings.mediaType[media.type]].filter(Boolean).join(' · ')}
                </span>
                <AvailabilityBadge media={media} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p>
        <button type="button" className="link" onClick={() => onManual(query.trim())}>
          {strings.ask.manualShortcut}
        </button>
      </p>
    </section>
  );
}

function AvailabilityBadge({ media }: { media: MediaCardView }) {
  const kind = media.availability.kind;
  if (kind === 'new') return null;
  const text = kind === 'active' ? strings.ask.requested : kind === 'fulfilled' ? strings.requestStatus.fulfilled : strings.ask.onServer;
  return <span className="badge">{text}</span>;
}

function PetiscoNotice({ me }: { me: MeView }) {
  if (isAttendant(me)) return <p className="muted">{strings.confirm.attendantFree}</p>;
  if (me.petiscos.total === 0) return <p className="notice">{strings.noPetiscos}</p>;
  return <p className="muted">{strings.confirm.balance(me.petiscos.total)}</p>;
}

function Done({ requestId, onBack }: { requestId: string; onBack: () => void }) {
  return (
    <section className="done">
      <p className="done-pacoca" aria-hidden="true">
        🐶
      </p>
      <h1>{strings.requestConfirmed}</h1>
      <div className="row">
        <button type="button" onClick={() => navigate(`/pedido/${requestId}`)}>
          {strings.confirm.seeRequest}
        </button>
        <button type="button" className="secondary" onClick={onBack}>
          {strings.ask.another}
        </button>
      </div>
    </section>
  );
}

function Confirm({ me, input, onBack }: { me: MeView; input: PreviewInput; onBack: () => void }) {
  const { backend } = useServices();
  const preview = useQuery('media.preview', input, ['requests']);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (done) return <Done requestId={done} onBack={onBack} />;

  const media = preview.data;
  const backButton = (
    <button type="button" className="link" onClick={onBack}>
      {strings.ask.back}
    </button>
  );
  if (!media) {
    return (
      <section>
        {backButton}
        {preview.error && (
          <p className="notice" role="alert">
            {errorText(preview.error)}
          </p>
        )}
      </section>
    );
  }

  async function create(again: boolean) {
    if (!media) return;
    setBusy(true);
    const result = await backend.command('request.create', { origin: 'tmdb', type: media.type, tmdbId: media.tmdbId, note, again });
    setBusy(false);
    if (result.ok) setDone(result.value.id);
    else setError(result.error === 'conflict' ? strings.genericError : errorText(result.error));
  }

  async function join(requestId: string) {
    setBusy(true);
    const result = await backend.command('request.join', { id: requestId });
    setBusy(false);
    if (result.ok) navigate(`/pedido/${requestId}`);
    else setError(errorText(result.error));
  }

  const availability = media.availability;
  const noteField = (
    <label>
      <span className="muted">{strings.confirm.noteLabel}</span>
      <textarea maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
    </label>
  );

  return (
    <section>
      {backButton}
      <div className="media-header">
        <Poster path={media.posterPath} title={media.title} />
        <div>
          <h1>{media.title}</h1>
          <p className="muted">{[media.year, strings.mediaType[media.type]].filter(Boolean).join(' · ')}</p>
          {isUnreleased(media.releaseDate, new Date()) && <span className="badge">{strings.confirm.unreleased}</span>}
        </div>
      </div>

      {availability.kind === 'new' && (
        <>
          <PetiscoNotice me={me} />
          {noteField}
          <button type="button" className="primary-action" disabled={busy} onClick={() => void create(false)}>
            {strings.confirm.submit}
          </button>
        </>
      )}

      {availability.kind === 'active' && (
        <div className="notice">
          <p>{availability.mine ? strings.confirm.alreadyMine : availability.joined ? strings.confirm.alreadyJoined : strings.confirm.activeExists}</p>
          <div className="row">
            {!availability.mine && !availability.joined && (
              <button type="button" disabled={busy} onClick={() => void join(availability.requestId)}>
                {strings.request.join}
              </button>
            )}
            <Link to={`/pedido/${availability.requestId}`}>{strings.confirm.seeRequest}</Link>
          </div>
        </div>
      )}

      {(availability.kind === 'fulfilled' || availability.kind === 'known') && (
        <>
          <p className="notice">{strings.alreadyOnServer}</p>
          {availability.kind === 'fulfilled' && (
            <p>
              <Link to={`/pedido/${availability.requestId}`}>{strings.confirm.seeRequest}</Link>
            </p>
          )}
          <PetiscoNotice me={me} />
          {noteField}
          <button type="button" className="secondary" disabled={busy} onClick={() => void create(true)}>
            {strings.confirm.askAgain}
          </button>
        </>
      )}

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function ManualForm({ me, initialTitle, onBack }: { me: MeView; initialTitle: string; onBack: () => void }) {
  const { backend } = useServices();
  const [title, setTitle] = useState(initialTitle);
  const [type, setType] = useState<MediaType>('movie');
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // Set when the link matches another manual request (docs/spec/pedidos.md).
  const [duplicate, setDuplicate] = useState<{ requestId: string | null; active: boolean } | null>(null);

  if (done) return <Done requestId={done} onBack={onBack} />;

  async function submit(event: FormEvent | null, again = false) {
    event?.preventDefault();
    setBusy(true);
    const result = await backend.command('request.create', { origin: 'manual', type, title, note, link: link.trim() || undefined, again });
    if (result.ok) {
      setBusy(false);
      setDone(result.value.id);
      return;
    }
    if (result.error === 'conflict' && link.trim()) {
      const found = await backend.query('manual.availability', { link });
      setBusy(false);
      if (found.ok && found.value.kind !== 'new') {
        setDuplicate({ requestId: 'requestId' in found.value ? found.value.requestId : null, active: found.value.kind === 'active' });
        return;
      }
    }
    setBusy(false);
    setError(result.error === 'invalid' ? strings.manual.invalid : errorText(result.error));
  }

  async function join(requestId: string) {
    const result = await backend.command('request.join', { id: requestId });
    if (result.ok) navigate(`/pedido/${requestId}`);
    else setError(errorText(result.error));
  }

  return (
    <section>
      <button type="button" className="link" onClick={onBack}>
        {strings.ask.back}
      </button>
      <h1>{strings.manual.title}</h1>
      <form className="stack" onSubmit={(e) => void submit(e)}>
        <label>
          <span className="muted">{strings.manual.titleLabel}</span>
          <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <fieldset className="chips">
          <legend className="muted">{strings.manual.typeLabel}</legend>
          {(['movie', 'tv'] as const).map((t) => (
            <button key={t} type="button" className={t === type ? 'chip chip-on' : 'chip'} aria-pressed={t === type} onClick={() => setType(t)}>
              {strings.mediaType[t]}
            </button>
          ))}
        </fieldset>
        <label>
          <span className="muted">{strings.confirm.noteLabel}</span>
          <textarea maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label>
          <span className="muted">{strings.manual.linkLabel}</span>
          <input
            type="url"
            inputMode="url"
            maxLength={500}
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setDuplicate(null);
            }}
          />
        </label>
        <PetiscoNotice me={me} />
        {!duplicate && (
          <button type="submit" className="primary-action" disabled={busy}>
            {strings.confirm.submit}
          </button>
        )}
      </form>

      {duplicate?.active && duplicate.requestId && (
        <div className="notice">
          <p>{strings.confirm.activeExists}</p>
          <div className="row">
            <button type="button" onClick={() => void join(duplicate.requestId!)}>
              {strings.request.join}
            </button>
            <Link to={`/pedido/${duplicate.requestId}`}>{strings.confirm.seeRequest}</Link>
          </div>
        </div>
      )}
      {duplicate && !duplicate.active && (
        <div className="notice">
          <p>{strings.alreadyOnServer}</p>
          <button type="button" className="secondary" disabled={busy} onClick={() => void submit(null, true)}>
            {strings.confirm.askAgain}
          </button>
        </div>
      )}

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
