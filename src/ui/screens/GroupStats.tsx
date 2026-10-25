import { useState, type ReactNode } from 'react';
import type { RankedMemberView, WantedMediaView } from '../../application/api-contract';
import { STATS_PERIODS, type StatsPeriod } from '../../domain/stats/stats';
import { strings } from '../../domain/strings';
import { Avatar } from '../components/Avatar';
import { PawGlyph } from '../components/PawLike';
import { PetiscoIcon } from '../components/PetiscoIcon';
import { Poster } from '../components/Poster';
import { Link } from '../router';
import { useQuery } from '../use-query';

const t = strings.stats;

function Heart() {
  return (
    <svg className="stat-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 20.5s-8-4.9-8-11a4.3 4.3 0 0 1 8-2.3 4.3 4.3 0 0 1 8 2.3c0 6.1-8 11-8 11z" />
    </svg>
  );
}

/**
 * The places in rank order, so a screen reader reads 1º first; the CSS puts the 2º on the left
 * and the 1º in the middle, taller.
 */
function Podium({ title, ranked, label }: { title: string; ranked: readonly RankedMemberView[]; label: (n: number) => string }) {
  return (
    <section className="card stats-card">
      <h2>{title}</h2>
      {ranked.length === 0 ? (
        <p className="muted">{t.nobody}</p>
      ) : (
        <ol className="podium">
          {ranked.map((r, i) => (
            <li key={r.member.id} className={`podium-place podium-${i + 1}`}>
              <Avatar name={r.member.name} photoUrl={r.member.photoUrl} />
              <span className="podium-name">{r.member.name}</span>
              <span className="podium-step" aria-label={label(r.count)}>
                {i + 1}º
                <strong aria-hidden="true">{r.count}</strong>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Trophy({ icon, title, ranked, label }: { icon: ReactNode; title: string; ranked: readonly RankedMemberView[]; label: (n: number) => string }) {
  const [first, second, third] = ranked;
  return (
    <section className="card stats-card trophy">
      {icon}
      <h2>{title}</h2>
      {first ? (
        <>
          <Avatar name={first.member.name} photoUrl={first.member.photoUrl} />
          <strong>{first.member.name}</strong>
          <span className="muted">{label(first.count)}</span>
          {second && <span className="muted trophy-runners-up">{t.runnersUp(second.member.name, third?.member.name ?? null)}</span>}
        </>
      ) : (
        <p className="muted">{t.nobody}</p>
      )}
    </section>
  );
}

function PosterPodium({ wanted, genres }: { wanted: readonly WantedMediaView[]; genres: readonly string[] }) {
  return (
    <section className="card stats-card">
      <h2>{t.mostWanted}</h2>
      {wanted.length === 0 ? (
        <p className="muted">{t.nobody}</p>
      ) : (
        <ol className="podium podium-posters">
          {wanted.map((m, i) => (
            <li key={m.requestId} className={`podium-place podium-${i + 1}`}>
              <Link to={`/pedido/${m.requestId}`} className="podium-poster">
                <Poster path={m.posterPath} title={m.title} />
                <span className="podium-name">
                  {i + 1}º {m.title}
                </span>
              </Link>
              <span className="muted">{t.wanted(m.count)}</span>
            </li>
          ))}
        </ol>
      )}
      {genres.length > 0 && <p className="muted">{t.trendingGenres(genres)}</p>}
    </section>
  );
}

function Metric({ icon, value, label, wide = false }: { icon: ReactNode; value: string | number; label: string; wide?: boolean }) {
  return (
    <div className={wide ? 'card stats-card metric metric-wide' : 'card stats-card metric'}>
      {icon}
      <strong>{value}</strong>
      <span className="muted">{label}</span>
    </div>
  );
}

/** Números do Grupo (docs/spec/estatisticas.md): the same for everyone, by period. */
export function GroupStats() {
  const [period, setPeriod] = useState<StatsPeriod>('last30');
  const numbers = useQuery('stats.numbers', { period }, ['requests', 'feed', 'petiscos', 'members']);
  const data = numbers.data;

  return (
    <section className="stack">
      <h1 className="sr-only">{t.groupTitle}</h1>
      <div className="period-switch" role="group" aria-label={t.period}>
        {STATS_PERIODS.map((p) => (
          <button key={p} type="button" aria-pressed={p === period} onClick={() => setPeriod(p)}>
            {t.periods[p]}
          </button>
        ))}
      </div>

      {numbers.error && !data && <p className="notice">{strings.genericError}</p>}
      {data && (
        <>
          <Podium title={t.topRequesters} ranked={data.topRequesters} label={t.requests} />
          <div className="stats-pair">
            <Trophy icon={<PetiscoIcon large />} title={t.boscov} ranked={data.topCashback} label={t.petiscos} />
            <Trophy icon={<Heart />} title={t.bestie} ranked={data.topThanks} label={t.thanks} />
          </div>
          <PosterPodium wanted={data.mostWanted} genres={data.trendingGenres} />
          <h2>{t.pacocaMetrics}</h2>
          <div className="stats-pair">
            <Metric icon={<PetiscoIcon large />} value={data.petiscosConsumed} label={t.petiscosConsumed} />
            <Metric icon={<Heart />} value={data.thanksReceived} label={t.thanksReceived} />
            <Metric icon={<PawGlyph className="stat-icon" />} value={t.duration(data.farejandoMs)} label={t.farejando} wide />
          </div>
        </>
      )}
    </section>
  );
}
