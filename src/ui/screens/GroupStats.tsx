import { useState } from 'react';
import type { HistoryGroupView, MemberView, StatsFilter } from '../../application/api-contract';
import type { MediaType } from '../../domain/media/media';
import type { RequestOrigin, RequestStatus } from '../../domain/request/lifecycle';
import { HISTORY_LIMIT, STATS_GROUPS, STATS_SORTS, type StatsGroupBy, type StatsSort } from '../../domain/stats/stats';
import { strings } from '../../domain/strings';
import { EmptyState } from '../components/EmptyState';
import { Poster } from '../components/Poster';
import { StatusChip } from '../components/StatusChip';
import { formatDate } from '../format';
import { Link } from '../router';
import { useQuery } from '../use-query';
import { Bars, formatMonth, Stat } from './MemberStats';

const t = strings.stats;
const STATUSES = Object.keys(strings.requestStatus) as RequestStatus[];

/** A picker whose empty option means "no filter". */
function Pick<T extends string>({
  label,
  any,
  value,
  options,
  onChange,
}: {
  label: string;
  any: string;
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (value: T | undefined) => void;
}) {
  return (
    <label>
      <span className="muted">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}>
        <option value="">{any}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function groupTitle(group: HistoryGroupView, groupBy: StatsGroupBy): string {
  switch (groupBy) {
    case 'person':
      return group.member?.name ?? group.key;
    case 'attendant':
      return group.member?.name ?? t.noAttendant;
    case 'month':
      return formatMonth(group.key);
    case 'type':
      return strings.mediaType[group.key as MediaType];
    case 'genre':
      return group.key || t.noGenre;
    case 'status':
      return strings.requestStatus[group.key as RequestStatus];
    case 'origin':
      return t.origins[group.key as RequestOrigin];
    case 'none':
      return t.history;
  }
}

const people = (members: readonly MemberView[]) => members.map((m) => ({ value: m.id, label: m.name }));

/** The group's history and numbers (docs/spec/estatisticas.md). */
export function GroupStats() {
  const [filter, setFilter] = useState<StatsFilter>({});
  const [sort, setSort] = useState<StatsSort>('newest');
  const [groupBy, setGroupBy] = useState<StatsGroupBy>('none');
  const stats = useQuery('stats.group', { filter, sort, groupBy }, ['requests', 'feed', 'petiscos', 'members']);
  const members = useQuery('members', {}, ['members']);
  const data = stats.data;
  const set = <K extends keyof StatsFilter>(key: K, value: StatsFilter[K]) => setFilter((f) => ({ ...f, [key]: value }));

  return (
    <section className="stack">
      <h1>{t.groupTitle}</h1>

      <details>
        <summary>{t.filters}</summary>
        <div className="stack">
          <Pick label={t.person} any={t.anyone} value={filter.memberId} options={people(members.data ?? [])} onChange={(v) => set('memberId', v)} />
          <div className="row">
            <label>
              <span className="muted">{t.from}</span>
              <input type="date" value={filter.from ?? ''} onChange={(e) => set('from', e.target.value || undefined)} />
            </label>
            <label>
              <span className="muted">{t.to}</span>
              <input type="date" value={filter.to ?? ''} onChange={(e) => set('to', e.target.value || undefined)} />
            </label>
          </div>
          <Pick
            label={t.type}
            any={t.anyType}
            value={filter.type}
            options={(['movie', 'tv'] as const).map((v) => ({ value: v, label: strings.mediaType[v] }))}
            onChange={(v) => set('type', v)}
          />
          <Pick label={t.genre} any={t.anyGenre} value={filter.genre} options={(data?.options.genres ?? []).map((g) => ({ value: g, label: g }))} onChange={(v) => set('genre', v)} />
          <Pick label={t.status} any={t.anyStatus} value={filter.status} options={STATUSES.map((s) => ({ value: s, label: strings.requestStatus[s] }))} onChange={(v) => set('status', v)} />
          <Pick
            label={t.origin}
            any={t.anyOrigin}
            value={filter.origin}
            options={(['tmdb', 'manual'] as const).map((o) => ({ value: o, label: t.origins[o] }))}
            onChange={(v) => set('origin', v)}
          />
          <Pick label={t.attendant} any={t.anyAttendant} value={filter.attendantId} options={people(data?.options.attendants ?? [])} onChange={(v) => set('attendantId', v)} />
          <button type="button" onClick={() => setFilter({})}>
            {t.clear}
          </button>
        </div>
      </details>

      <div className="row">
        <label>
          <span className="muted">{t.sort}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as StatsSort)}>
            {STATS_SORTS.map((s) => (
              <option key={s} value={s}>
                {t.sorts[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted">{t.groupBy}</span>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as StatsGroupBy)}>
            {STATS_GROUPS.map((g) => (
              <option key={g} value={g}>
                {t.groups[g]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {stats.error && !data && <p className="notice">{strings.genericError}</p>}
      {data?.total === 0 && <EmptyState text={t.empty} />}
      {data && data.total > 0 && (
        <>
          <h2>{t.metrics}</h2>
          <div className="stat-grid">
            <Stat label={t.totalRequests} value={data.total} />
            <Stat label={t.averageTime} value={data.metrics.averageMsToFulfilled === null ? t.none : t.duration(data.metrics.averageMsToFulfilled)} />
            <Stat label={t.unavailableRate} value={data.metrics.unavailableRate === null ? t.none : t.percent(data.metrics.unavailableRate)} />
            <Stat label={t.petiscosConsumed} value={data.metrics.petiscosConsumed} />
            <Stat label={t.petiscosReturned} value={data.metrics.petiscosReturned} />
          </div>
          <div>
            <h3>{t.perPerson}</h3>
            <Bars rows={data.metrics.perPerson.map((p) => ({ label: p.member.name, value: p.count }))} />
          </div>
          {data.metrics.perAttendant.length > 0 && (
            <div>
              <h3>{t.perAttendant}</h3>
              <Bars rows={data.metrics.perAttendant.map((p) => ({ label: p.member.name, value: p.count }))} />
            </div>
          )}
          {data.metrics.mostLiked.length > 0 && (
            <div>
              <h3>{t.mostLiked}</h3>
              <ol>
                {data.metrics.mostLiked.map((r) => (
                  <li key={r.requestId}>
                    <Link to={`/pedido/${r.requestId}`}>{r.title}</Link> <span className="muted">· {strings.feed.likeCount(r.likes)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <h2>{t.history}</h2>
          {data.truncated && <p className="muted">{t.truncated(HISTORY_LIMIT)}</p>}
          {data.groups.map((group) => (
            <div key={group.key}>
              {groupBy !== 'none' && (
                <h3>
                  {groupTitle(group, groupBy)} <span className="muted">· {t.total(group.count)}</span>
                </h3>
              )}
              <ul className="list">
                {group.requests.map((r) => (
                  <li key={r.id}>
                    <Link to={`/pedido/${r.id}`} className="card request-item">
                      <Poster path={r.posterPath} title={r.title} small />
                      <span className="grow">
                        <strong>{r.title}</strong>
                        <br />
                        <StatusChip status={r.status} />
                        <span className="muted">
                          {' '}
                          · {strings.mediaType[r.mediaType]} · {r.requester.name}
                          {r.assignee && ` · ${strings.request.assignee(r.assignee.name)}`}
                        </span>
                        <br />
                        <time className="muted" dateTime={r.createdAt}>
                          {formatDate(r.createdAt)}
                        </time>
                        {r.likes > 0 && <span className="muted"> · {strings.feed.likeCount(r.likes)}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
