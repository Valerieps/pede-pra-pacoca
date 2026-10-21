import { PacocaArt } from './PacocaArt';

// An empty state with the Paçoca: her art, then her line. The illustrations arrive later
// (docs/spec/identidade.md); until then PacocaArt holds their place.
export function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <PacocaArt />
      <p className="pacoca-line">{text}</p>
    </div>
  );
}
