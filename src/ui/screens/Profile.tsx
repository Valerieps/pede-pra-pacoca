import { useState, type FormEvent } from 'react';
import type { MeView } from '../../application/api-contract';
import { NAME_MAX_LENGTH, normalizeName, type PhotoChoice } from '../../domain/group/profile';
import { strings } from '../../domain/strings';
import { Avatar } from '../components/Avatar';
import { useServices } from '../backend-context';
import { profileLinksFor } from '../navigation';
import { Link } from '../router';

/**
 * Name and photo: the first-access screen, and later the Perfil screen, which also holds the
 * screens that are not tabs and "Sair" (docs/spec/app-e-instalacao.md, "Navegação").
 */
export function Profile({
  me,
  firstAccess = false,
  onConfirmed,
  onSignOut,
}: {
  me: MeView;
  firstAccess?: boolean;
  onConfirmed?: () => void;
  onSignOut?: () => void;
}) {
  const { backend } = useServices();
  const [name, setName] = useState(me.name);
  const [photo, setPhoto] = useState<PhotoChoice>(me.googlePhotoUrl ? me.photoChoice : 'none');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!normalizeName(name)) {
      setMessage(strings.profile.invalidName);
      return;
    }
    setBusy(true);
    const result = await backend.command('member.updateProfile', { name, photo });
    setBusy(false);
    // On first access, the "me" refetch that follows moves the app on to the feed.
    if (result.ok) {
      setMessage(firstAccess ? null : strings.profile.saved);
      onConfirmed?.();
    } else setMessage(result.error === 'invalid' ? strings.profile.invalidName : strings.genericError);
  }

  return (
    <section>
      <h1>{firstAccess ? strings.profile.firstAccessTitle : strings.profile.title}</h1>
      {firstAccess && <p>{strings.profile.firstAccessIntro}</p>}
      {!firstAccess && (
        <p>
          <Link to={`/membro/${me.id}`}>{strings.stats.myNumbers}</Link>
        </p>
      )}
      <form className="stack" onSubmit={submit}>
        <label>
          <span className="muted">{strings.profile.nameLabel}</span>
          <input value={name} maxLength={NAME_MAX_LENGTH} required autoComplete="name" onChange={(e) => setName(e.target.value)} />
        </label>
        <fieldset>
          <legend className="muted">{strings.profile.photoLabel}</legend>
          {me.googlePhotoUrl ? (
            <label className="choice">
              <input type="radio" name="photo" checked={photo === 'google'} onChange={() => setPhoto('google')} />
              <Avatar name={name} photoUrl={me.googlePhotoUrl} />
              {strings.profile.googlePhoto}
            </label>
          ) : (
            <p className="muted">{strings.profile.noGooglePhoto}</p>
          )}
          <label className="choice">
            <input type="radio" name="photo" checked={photo === 'none'} onChange={() => setPhoto('none')} />
            <Avatar name={name || '?'} photoUrl={null} />
            {strings.profile.noPhoto}
          </label>
        </fieldset>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {firstAccess ? strings.profile.confirm : strings.profile.save}
        </button>
      </form>
      {!firstAccess && (
        <nav className="profile-links" aria-label={strings.profile.title}>
          <ul className="list">
            {profileLinksFor(me).map((link) => (
              <li key={link.path}>
                <Link to={link.path} className="card">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          {onSignOut && (
            <button type="button" className="secondary sign-out" onClick={onSignOut}>
              {strings.nav.signOut}
            </button>
          )}
        </nav>
      )}
    </section>
  );
}
