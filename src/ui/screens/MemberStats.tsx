import { strings } from '../../domain/strings';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { useQuery } from '../use-query';

/** A month "2026-10" as "out/26". */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const name = new Date(Date.UTC(year, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  return `${name}/${String(year).slice(2)}`;
}

/** Bars scaled to the largest value, with the number beside each. */
export function Bars({ rows }: { rows: readonly { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="bars">
      {rows.map((row, i) => (
        <li key={i}>
          <span className="bar-label">{row.label}</span>
          <span className="bar-track" aria-hidden="true">
            <span className="bar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="bar-value">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span className="muted">{label}</span>
    </div>
  );
}

/** A member's profile numbers (docs/spec/estatisticas.md), visible to everyone. */
export function MemberStats({ memberId }: { memberId: string }) {
  const profile = useQuery('stats.profile', { memberId }, ['requests', 'feed', 'petiscos', 'members']);
  const t = strings.stats;
  const data = profile.data;

  return (
    <section className="stack">
      {profile.error && !data && <p className="notice">{profile.error === 'not_found' ? t.notFound : strings.genericError}</p>}
      {data && (
        <>
          <h1 className="row">
            <Avatar name={data.member.name} photoUrl={data.member.photoUrl} />
            {t.profileTitle(data.member.name)}
          </h1>
          {data.totalRequests === 0 && <EmptyState text={t.profileEmpty(data.member.name)} />}
          <div className="stat-grid">
            <Stat label={t.totalRequests} value={data.totalRequests} />
            <Stat label={t.fulfilled} value={data.fulfilled} />
            <Stat label={t.averageTime} value={data.averageMsToFulfilled === null ? t.none : t.duration(data.averageMsToFulfilled)} />
            <Stat label={t.cashbacks} value={data.cashbacks} />
            <Stat label={t.likesReceived} value={data.likesReceived} />
          </div>
          {data.topGenres.length > 0 && (
            <div>
              <h2>{t.topGenres}</h2>
              <Bars rows={data.topGenres.map((g) => ({ label: g.genre, value: g.count }))} />
            </div>
          )}
          {data.totalRequests > 0 && (
            <div>
              <h2>{t.perMonth}</h2>
              <Bars rows={data.perMonth.map((m) => ({ label: formatMonth(m.month), value: m.count }))} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
