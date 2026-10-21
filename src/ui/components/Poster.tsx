// A TMDB poster (loaded directly from image.tmdb.org, ADR-008), or the Paçoca card for manual
// requests and media without a poster. The illustration arrives later (docs/spec/identidade.md).
const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

export function Poster({ path, title, small = false }: { path: string | null; title: string; small?: boolean }) {
  const className = small ? 'poster poster-small' : 'poster';
  if (!path) {
    return (
      <div className={`${className} poster-pacoca`} role="img" aria-label={title}>
        <span aria-hidden="true">🐾</span>
      </div>
    );
  }
  return <img className={className} src={`${POSTER_BASE}${path}`} alt={title} loading="lazy" referrerPolicy="no-referrer" />;
}
