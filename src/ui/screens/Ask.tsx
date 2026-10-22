// Pedir (docs/spec/pedidos.md): paste a link, or search, then confirm; or a manual request.
import { useEffect, useState, type FormEvent } from 'react';
import type { ApiError, MediaCardView, MeView, PreviewInput, RequestView, SearchType } from '../../application/api-contract';
import { isAttendant } from '../../domain/group/roles';
import { findUrl, isUnreleased, parseSharedLink, type MediaType } from '../../domain/media/media';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { browserShareEnvironment, clearPendingShare, pendingShare } from '../../infrastructure/share-target';
import { PacocaCelebration } from '../components/PacocaCelebration';
import { PetiscoChip } from '../components/PetiscoChip';
import { Poster } from '../components/Poster';
import { StatusChip } from '../components/StatusChip';
import { takeAskDraft } from '../ask-draft';
import { Link, navigate } from '../router';
import { useQuery } from '../use-query';

type Step =
  | { kind: 'search'; unrecognized?: string; query?: string }
  | { kind: 'confirm'; input: PreviewInput }
  | { kind: 'manual'; title: string; link?: string };

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

/** Where a link shared to the app on Android lands (docs/spec/app-e-instalacao.md). */
function stepForShare(text: string | null): Step {
  if (text === null) return { kind: 'search' };
  return parseSharedLink(text) ? { kind: 'confirm', input: { text } } : { kind: 'search', unrecognized: text };
}

/** A link or search typed in the computer's right column, else a link shared to the app. */
function firstStep(): Step {
  const draft = takeAskDraft();
  if (draft?.kind === 'link') return { kind: 'confirm', input: { text: draft.text } };
  if (draft?.kind === 'search') return { kind: 'search', query: draft.query };
  return stepForShare(pendingShare(browserShareEnvironment()));
}

export function Ask({ me }: { me: MeView }) {
  const [step, setStep] = useState<Step>(firstStep);
  const back = () => setStep({ kind: 'search' });
  const manual = (title: string, text?: string) => setStep({ kind: 'manual', title, link: (text && findUrl(text)) || undefined });

  // The shared text is taken once: going back or opening Pedir again starts empty.
  useEffect(() => clearPendingShare(browserShareEnvironment()), []);

  return (
    <>
      <p className="ask-balance">
        <PetiscoChip balance={me.petiscos} />
      </p>
      {step.kind === 'confirm' ? (
        <Confirm me={me} input={step.input} onBack={back} onManual={() => manual('', 'text' in step.input ? step.input.text : undefined)} />
      ) : step.kind === 'manual' ? (
        <ManualForm me={me} initialTitle={step.title} initialLink={step.link} onBack={back} />
      ) : (
        <Search
          unrecognized={step.unrecognized}
          initialQuery={step.query}
          onPick={(input) => setStep({ kind: 'confirm', input })}
          onManual={(title) => manual(title, step.unrecognized)}
        />
      )}
    </>
  );
}

/** A link the app does not know: the friendly message, with the search and the manual request. */
function UnrecognizedLink({ onSearch, onManual }: { onSearch: () => void; onManual: () => void }) {
  return (
    <div className="notice" role="alert">
      <p>{strings.ask.unrecognizedLink}</p>
      <div className="row">
        <button type="button" onClick={onSearch}>
          {strings.ask.searchInstead}
        </button>
        <button type="button" className="secondary" onClick={onManual}>
          {strings.ask.manualOffer}
        </button>
      </div>
    </div>
  );
}

function Search({
  unrecognized,
  initialQuery = '',
  onPick,
  onManual,
}: {
  unrecognized?: string;
  initialQuery?: string;
  onPick: (input: PreviewInput) => void;
  onManual: (title: string) => void;
}) {
  const { backend } = useServices();
  const [link, setLink] = useState('');
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<SearchType>('all');
  const [results, setResults] = useState<MediaCardView[] | null>(null);
  const [searched, setSearched] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showUnrecognized, setShowUnrecognized] = useState(unrecognized !== undefined);

  function openLink(event: FormEvent) {
    event.preventDefault();
    if (link.trim()) onPick({ text: link });
  }

  // A search typed in the right column runs as soon as Pedir opens.
  useEffect(() => {
    if (initialQuery) void search(null, 'all', initialQuery);
  }, []);

  function focusSearch() {
    setShowUnrecognized(false);
    document.getElementById('ask-search')?.focus();
  }

  async function search(event: FormEvent | null, filter: SearchType = type, text = query.trim()) {
    event?.preventDefault();
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
      {showUnrecognized && <UnrecognizedLink onSearch={focusSearch} onManual={() => onManual('')} />}
      <form className="row field-row" onSubmit={openLink}>
        <label className="grow">
          <span className="muted">{strings.ask.linkLabel}</span>
          <input type="url" inputMode="url" autoComplete="off" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        <button type="submit">{strings.ask.linkButton}</button>
      </form>

      <form className="row field-row" onSubmit={(e) => void search(e)}>
        <label className="grow">
          <span className="muted">{strings.ask.searchLabel}</span>
          <input id="ask-search" type="search" autoComplete="off" maxLength={100} value={query} onChange={(e) => setQuery(e.target.value)} />
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

/** After confirming: the Paçoca, the request I just made and where to go next. */
function Done({ request, onBack }: { request: RequestView; onBack: () => void }) {
  return (
    <section className="done">
      <PacocaCelebration text={strings.requestConfirmed}>
        <Link to={`/pedido/${request.id}`} className="card request-item done-request">
          <Poster path={request.posterPath} title={request.title} small />
          <span className="grow">
            <strong className="media-title">{request.title}</strong>
            <br />
            <StatusChip status={request.status} />
          </span>
        </Link>
        <div className="done-actions">
          <button type="button" autoFocus onClick={() => navigate('/meus-pedidos')}>
            {strings.confirm.seeMyRequests}
          </button>
          <button type="button" className="ghost" onClick={onBack}>
            {strings.ask.another}
          </button>
        </div>
      </PacocaCelebration>
    </section>
  );
}

function Confirm({ me, input, onBack, onManual }: { me: MeView; input: PreviewInput; onBack: () => void; onManual: () => void }) {
  const { backend } = useServices();
  const preview = useQuery('media.preview', input, ['requests']);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<RequestView | null>(null);

  if (done) return <Done request={done} onBack={onBack} />;

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
        {preview.error === 'unrecognized_link' && <UnrecognizedLink onSearch={onBack} onManual={onManual} />}
        {preview.error && preview.error !== 'unrecognized_link' && (
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
    if (result.ok) setDone(result.value);
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

function ManualForm({ me, initialTitle, initialLink = '', onBack }: { me: MeView; initialTitle: string; initialLink?: string; onBack: () => void }) {
  const { backend } = useServices();
  const [title, setTitle] = useState(initialTitle);
  const [type, setType] = useState<MediaType>('movie');
  const [note, setNote] = useState('');
  const [link, setLink] = useState(initialLink);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<RequestView | null>(null);
  // Set when the link matches another manual request (docs/spec/pedidos.md).
  const [duplicate, setDuplicate] = useState<{ requestId: string | null; active: boolean } | null>(null);

  if (done) return <Done request={done} onBack={onBack} />;

  async function submit(event: FormEvent | null, again = false) {
    event?.preventDefault();
    setBusy(true);
    const result = await backend.command('request.create', { origin: 'manual', type, title, note, link: link.trim() || undefined, again });
    if (result.ok) {
      setBusy(false);
      setDone(result.value);
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
