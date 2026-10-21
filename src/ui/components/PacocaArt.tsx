// The slot for the Paçoca's art: a caramel-light circle with the placeholder inside. Cesar's files
// replace the placeholder here (docs/rascunhos/brief-artes-pacoca.md, ADR-013).
export function PacocaArt({ large = false, glyph = '🐾' }: { large?: boolean; glyph?: string }) {
  return (
    <div className={large ? 'pacoca-art pacoca-art-large' : 'pacoca-art'} aria-hidden="true">
      <span className="pacoca-art-placeholder">{glyph}</span>
    </div>
  );
}
