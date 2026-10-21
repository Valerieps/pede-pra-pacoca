// The petisco (docs/spec/identidade.md): a small caramel square, rounded, with a few crumbs.
export function PetiscoIcon({ large = false }: { large?: boolean }) {
  return (
    <svg className={large ? 'petisco-icon petisco-icon-large' : 'petisco-icon'} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect className="petisco-body" x="1.5" y="1.5" width="13" height="13" rx="4" />
      <circle className="petisco-crumb" cx="5.5" cy="6" r="1" />
      <circle className="petisco-crumb" cx="10" cy="5" r="0.8" />
      <circle className="petisco-crumb" cx="8.5" cy="10" r="1" />
      <circle className="petisco-crumb" cx="11.5" cy="10.5" r="0.7" />
    </svg>
  );
}
