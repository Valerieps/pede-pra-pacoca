// The Paçoca animation when I confirm a request and when I get an Atendido
// (docs/spec/identidade.md). The real animation arrives later; until then a placeholder hops, so
// swapping it in touches this file and its styles only. With reduced motion it stands still.
export function PacocaCelebration({ text }: { text: string }) {
  return (
    <div className="celebration" role="status">
      <div className="pacoca-placeholder celebration-pacoca" aria-hidden="true">
        🐶
      </div>
      <p className="celebration-text">{text}</p>
    </div>
  );
}
