import { useState, type FormEvent } from 'react';
import type { MeView } from '../../application/api-contract';
import { NAME_MAX_LENGTH, normalizeName, type PhotoChoice } from '../../domain/group/profile';
import { strings } from '../../domain/strings';
import { Avatar } from '../components/Avatar';
import { useServices } from '../backend-context';

/** Name and photo: the first-access screen, and later the Perfil screen. */
export function Profile({ me, firstAccess = false, onConfirmed }: { me: MeView; firstAccess?: boolean; onConfirmed?: () => void }) {
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
    </section>
  );
}
