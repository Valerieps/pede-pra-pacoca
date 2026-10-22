// The pieces the numbers screens draw with: a stat tile, bars and a short month name.

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
