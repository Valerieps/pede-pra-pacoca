import type { MeView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { manageLinksFor } from '../navigation';
import { Link } from '../router';

/** Gerenciamento do App (docs/spec/app-e-instalacao.md, "Navegação"): a button per thing I manage. */
export function ManageApp({ me }: { me: MeView }) {
  return (
    <section>
      <h1>{strings.nav.manage}</h1>
      <nav className="profile-links" aria-label={strings.nav.manage}>
        <ul className="list">
          {manageLinksFor(me).map((link) => (
            <li key={link.path}>
              <Link to={link.path} className="card">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
