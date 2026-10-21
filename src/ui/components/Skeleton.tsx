// While a list loads: cards in the surface color shaped like the content, with a slow brand-tinted
// shimmer (no spinner). Reduced motion stops the shimmer. Hidden from screen readers, which hear
// the content once it arrives.
export function SkeletonCards({ count = 3, poster = true }: { count?: number; poster?: boolean }) {
  return (
    <ul className="list skeleton-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="card skeleton-card">
          {poster && <span className="skeleton skeleton-poster" />}
          <span className="skeleton-lines">
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line skeleton-line-short" />
          </span>
        </li>
      ))}
    </ul>
  );
}
