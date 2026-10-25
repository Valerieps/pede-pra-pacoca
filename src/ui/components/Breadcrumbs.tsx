import { strings } from '../../domain/strings';
import { Link } from '../router';

export interface Crumb {
  readonly label: string;
  /** Absent on the last one: the screen I am on. */
  readonly to?: string;
}

/** Where a screen sits under its menu item; the last crumb is the screen itself. */
export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav className="breadcrumbs" aria-label={strings.nav.breadcrumb}>
      <ol>
        {items.map((item) => (
          <li key={item.label} aria-current={item.to ? undefined : 'page'}>
            {item.to ? <Link to={item.to}>{item.label}</Link> : item.label}
          </li>
        ))}
      </ol>
    </nav>
  );
}
