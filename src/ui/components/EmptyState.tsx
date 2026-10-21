// An empty state with the Paçoca. The illustrations arrive later (docs/spec/identidade.md); until
// then a placeholder holds their place, so swapping it in touches this file only.
export function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <div className="pacoca-placeholder" aria-hidden="true">
        🐾
      </div>
      <p className="muted">{text}</p>
    </div>
  );
}
