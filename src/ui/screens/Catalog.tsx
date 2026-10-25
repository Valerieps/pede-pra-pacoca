import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CatalogItemView } from '../../application/api-contract';
import {
  activeFilterCount,
  arrangeCatalog,
  CATALOG_SORTS,
  CATALOG_TYPES,
  catalogGenres,
  DECADES,
  DEFAULT_FILTERS,
  isValidProblem,
  MAX_PROBLEM_LENGTH,
  problemReasonsFor,
  type CatalogFilters,
  type Decade,
  type ProblemReason,
} from '../../domain/catalog/catalog';
import { mediaKey } from '../../domain/media/media';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { Poster } from '../components/Poster';
import { Sheet } from '../components/Sheet';
import { SkeletonCards } from '../components/Skeleton';
import { Link } from '../router';
import { useQuery } from '../use-query';

const t = strings.catalog;

/** Genres shown before "+N" in the filter sheet. */
const GENRES_SHOWN = 8;

type View = 'list' | 'grid';

const keyOf = (item: CatalogItemView) => mediaKey(item.type, item.tmdbId);

function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** The Catálogo (docs/spec/catalogo.md): everything already in the library, as a list or a grid. */
export function Catalog() {
  const catalog = useQuery('catalog', {}, ['problems']);
  useScoreLookups(catalog.data, catalog.reload);
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<View>('list');
  const [showFilters, setShowFilters] = useState(false);
  // By key, so a live refetch shows the fresh item.
  const [opened, setOpened] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const items = catalog.data ?? [];
  const { count, groups } = arrangeCatalog(items, filters);
  const find = (key: string | null) => items.find((i) => keyOf(i) === key) ?? null;
  const openedItem = find(opened);
  const reportingItem = find(reporting);
  const set = (changes: Partial<CatalogFilters>) => setFilters({ ...filters, ...changes });

  function report(item: CatalogItemView) {
    setOpened(null);
    if (item.reportedByMe) return setMessage(t.alreadyReported);
    setMessage(null);
    setReporting(keyOf(item));
  }

  return (
    <section className="catalog">
      <h1 className="sr-only">{t.title}</h1>
      <label className="catalog-search">
        <Icon name="search" />
        <span className="sr-only">{t.search}</span>
        <input type="search" placeholder={t.search} autoComplete="off" maxLength={100} value={filters.query} onChange={(e) => set({ query: e.target.value })} />
      </label>
      <div className="chips catalog-chips" role="group" aria-label={t.title}>
        {CATALOG_TYPES.map((type) => (
          <button key={type} type="button" className="chip" aria-pressed={filters.type === type} onClick={() => set({ type })}>
            {t.types[type]}
          </button>
        ))}
      </div>
      <div className="chips catalog-chips">
        <button type="button" className="chip" aria-haspopup="dialog" onClick={() => setShowFilters(true)}>
          <Icon name="filters" /> {t.filtersCount(activeFilterCount(filters))}
        </button>
        <button type="button" className="chip" aria-haspopup="dialog" aria-label={`${t.sortBy}: ${t.sortChip(filters.sort, filters.newestFirst)}`} onClick={() => setShowFilters(true)}>
          {t.sortChip(filters.sort, filters.newestFirst)}
        </button>
      </div>
      <div className="catalog-bar">
        <span className="muted" role="status">
          {catalog.data && t.count(count)}
        </span>
        <span className="segmented" role="group" aria-label={t.view}>
          {(['list', 'grid'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} aria-label={t[v]} title={t[v]} onClick={() => setView(v)}>
              <Icon name={v} />
            </button>
          ))}
        </span>
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {catalog.error && !catalog.data && <p className="notice">{strings.genericError}</p>}
      {!catalog.data && !catalog.error && <SkeletonCards />}
      {catalog.data && count === 0 && <EmptyState text={items.length === 0 ? t.empty : t.emptyFiltered} />}

      {count > 0 &&
        groups.map((group) => (
          <section key={group.genre ?? ''} className="catalog-group">
            {filters.groupByGenre && (
              <h2 className="catalog-group-title">
                {group.genre ?? t.noGenre} <span className="muted">{group.items.length}</span>
              </h2>
            )}
            {view === 'list' ? (
              <ul className="list">
                {group.items.map((item) => (
                  <li key={keyOf(item)}>
                    <CatalogCard item={item} onReport={() => report(item)} />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="catalog-grid">
                {group.items.map((item) => (
                  <li key={keyOf(item)}>
                    <button type="button" className="catalog-tile" aria-label={item.title} aria-haspopup="dialog" onClick={() => setOpened(keyOf(item))}>
                      <Poster path={item.posterPath} title="" />
                      {item.imdbRating !== null && (
                        <span className="logo-imdb catalog-tile-score" aria-hidden="true">
                          {item.imdbRating.toFixed(1)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

      {showFilters && <FilterSheet filters={filters} genres={catalogGenres(items)} count={count} onChange={set} onClose={() => setShowFilters(false)} />}
      {openedItem && (
        <Sheet label={openedItem.title} onClose={() => setOpened(null)}>
          <CatalogCard item={openedItem} onReport={() => report(openedItem)} />
          <button type="button" className="secondary primary-action" onClick={() => setOpened(null)}>
            {t.close}
          </button>
        </Sheet>
      )}
      {reportingItem && (
        <ReportSheet
          item={reportingItem}
          onClose={() => setReporting(null)}
          onSent={() => {
            setReporting(null);
            setMessage(t.sent);
            catalog.reload();
          }}
        />
      )}
    </section>
  );
}

/**
 * The titles whose scores were never looked up, or long ago, are looked up one at a time through
 * the media page's query, which the server keeps for the Catálogo (ADR-019); then the list reloads.
 */
function useScoreLookups(items: readonly CatalogItemView[] | undefined, reload: () => void) {
  const { backend } = useServices();
  const asked = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const missing = (items ?? []).filter((i) => !i.scoresKnown && !asked.current.has(keyOf(i)));
    if (missing.length === 0) return;
    missing.forEach((i) => asked.current.add(keyOf(i)));
    void (async () => {
      // One at a time: each is a TMDB and an OMDb call, and the free OMDb key is small.
      for (const item of missing) {
        if (!mounted.current) return;
        await backend.query('media.imdb', { type: item.type, tmdbId: item.tmdbId });
      }
      if (mounted.current) reload();
    })();
  }, [items, backend, reload]);
}

/** Poster on the left and the title, as on the feed; the line of scores; the report triangle. Opens the title's page, as on the feed. */
function CatalogCard({ item, onReport }: { item: CatalogItemView; onReport: () => void }) {
  const line = [strings.mediaType[item.type], item.year, item.type === 'tv' && item.seasons ? t.seasons(item.seasons) : null].filter(Boolean).join(' · ');
  const body = (
    <>
      <strong className="media-title">{item.title}</strong>
      <span className="muted">{line}</span>
      <Scores item={item} />
    </>
  );
  return (
    <article className="card catalog-card">
      {item.requestId ? (
        <>
          <Link to={`/pedido/${item.requestId}`} className="catalog-poster" tabIndex={-1} aria-hidden="true">
            <Poster path={item.posterPath} title={item.title} />
          </Link>
          <Link to={`/pedido/${item.requestId}`} className="catalog-body">
            {body}
          </Link>
        </>
      ) : (
        <>
          <Poster path={item.posterPath} title={item.title} />
          <div className="catalog-body">{body}</div>
        </>
      )}
      <button
        type="button"
        className={item.reportedByMe ? 'icon-button catalog-report reported' : 'icon-button catalog-report'}
        aria-label={item.reportedByMe ? t.reported(item.title) : t.report(item.title)}
        title={item.reportedByMe ? t.reported(item.title) : t.reportTitle}
        onClick={onReport}
      >
        <Icon name="alert" />
      </button>
    </article>
  );
}

function Scores({ item }: { item: CatalogItemView }) {
  if (item.imdbRating === null && item.tmdbRating === null && item.criticsScore === null) return null;
  return (
    <ul className="scores">
      {item.imdbRating !== null && (
        <li aria-label={`${strings.request.imdbScore} ${item.imdbRating.toFixed(1)}`}>
          <span className="logo-imdb" aria-hidden="true">
            IMDb
          </span>{' '}
          <span aria-hidden="true">{item.imdbRating.toFixed(1)}</span>
        </li>
      )}
      {item.tmdbRating !== null && (
        <li aria-label={`${strings.request.tmdbScore} ${item.tmdbRating.toFixed(1)}`}>
          <span className="logo-tmdb" aria-hidden="true">
            TMDB
          </span>{' '}
          <span aria-hidden="true">{item.tmdbRating.toFixed(1)}</span>
        </li>
      )}
      {item.criticsScore !== null && (
        <li aria-label={`${strings.request.criticsScore} ${item.criticsScore}%`}>
          <span aria-hidden="true">🍅 {item.criticsScore}%</span>
        </li>
      )}
    </ul>
  );
}

function FilterSheet({
  filters,
  genres,
  count,
  onChange,
  onClose,
}: {
  filters: CatalogFilters;
  genres: readonly string[];
  count: number;
  onChange: (changes: Partial<CatalogFilters>) => void;
  onClose: () => void;
}) {
  const [allGenres, setAllGenres] = useState(false);
  // Chosen genres always show, even past the first ones.
  const shown = allGenres ? genres : genres.filter((g, i) => i < GENRES_SHOWN || filters.genres.includes(g));
  const chip = (label: string, pressed: boolean, onClick: () => void) => (
    <button key={label} type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <Sheet label={t.filters} onClose={onClose}>
      <div className="sheet-header">
        <h2>{t.filters}</h2>
        <button
          type="button"
          className="link"
          onClick={() => onChange({ genres: [], decades: [], sort: DEFAULT_FILTERS.sort, newestFirst: DEFAULT_FILTERS.newestFirst, groupByGenre: false })}
        >
          {t.clear}
        </button>
      </div>
      <fieldset>
        <legend className="muted">{t.sortBy}</legend>
        <div className="chips">{CATALOG_SORTS.map((sort) => chip(t.sorts[sort], filters.sort === sort, () => onChange({ sort })))}</div>
        {filters.sort === 'release' && (
          <div className="chips">
            {chip(t.newest, filters.newestFirst, () => onChange({ newestFirst: true }))}
            {chip(t.oldest, !filters.newestFirst, () => onChange({ newestFirst: false }))}
          </div>
        )}
      </fieldset>
      {genres.length > 0 && (
        <fieldset>
          <legend className="muted">{t.genre}</legend>
          <div className="chips">
            {shown.map((genre) => chip(genre, filters.genres.includes(genre), () => onChange({ genres: toggled(filters.genres, genre) })))}
            {shown.length < genres.length && (
              <button type="button" className="chip" onClick={() => setAllGenres(true)}>
                {t.moreGenres(genres.length - shown.length)}
              </button>
            )}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend className="muted">{t.decade}</legend>
        <div className="chips">
          {DECADES.map((decade: Decade) => chip(t.decades[decade], filters.decades.includes(decade), () => onChange({ decades: toggled(filters.decades, decade) })))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="muted">{t.group}</legend>
        <div className="chips">
          {chip(t.no, !filters.groupByGenre, () => onChange({ groupByGenre: false }))}
          {chip(t.yes, filters.groupByGenre, () => onChange({ groupByGenre: true }))}
        </div>
      </fieldset>
      <button type="button" className="primary-action" onClick={onClose}>
        {t.show(count)}
      </button>
    </Sheet>
  );
}

/** One reason chip, as in the draft; the text is optional, except for "Outro". */
function ReportSheet({ item, onClose, onSent }: { item: CatalogItemView; onClose: () => void; onSent: () => void }) {
  const { backend } = useServices();
  const [reason, setReason] = useState<ProblemReason | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const other = reason === 'other';

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!reason) return;
    setBusy(true);
    const result = await backend.command('problem.report', { type: item.type, tmdbId: item.tmdbId, reason, description });
    setBusy(false);
    if (result.ok) return onSent();
    setError(result.error === 'conflict' ? t.alreadyReported : strings.genericError);
  }

  return (
    <Sheet label={t.reportTitle} onClose={onClose}>
      <form className="stack" onSubmit={(e) => void send(e)}>
        <h2>
          {t.reportQuestion} <span className="media-title">{item.title}</span>?
        </h2>
        <fieldset>
          <legend className="sr-only">{t.reportTitle}</legend>
          <div className="chips">
            {problemReasonsFor(item.type).map((r) => (
              <button key={r} type="button" className="chip" aria-pressed={reason === r} onClick={() => setReason(r)}>
                {t.reasons[r]}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          <span className="sr-only">{other ? t.reportMoreRequired : t.reportMore}</span>
          <textarea
            rows={3}
            required={other}
            maxLength={MAX_PROBLEM_LENGTH}
            placeholder={other ? t.reportMoreRequired : t.reportMore}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="row actions">
          <button type="submit" disabled={busy || !isValidProblem(item.type, reason, description.trim())}>
            {t.send}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
