import { useEffect, useState } from 'react';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { navigate } from '../router';

const ERRORS: Record<string, string> = {
  'sem-convite': strings.signIn.noInvite,
  login: strings.signIn.failed,
};

export function SignIn() {
  const { backend } = useServices();
  const [error] = useState(() => ERRORS[new URLSearchParams(window.location.search).get('erro') ?? ''] ?? null);

  // The error code came from the sign-in redirect; drop it from the address bar.
  useEffect(() => {
    if (window.location.search) navigate(window.location.pathname, { replace: true });
  }, []);

  return (
    <main className="app sign-in">
      <h1>{strings.signIn.title}</h1>
      <p>{strings.signIn.tagline}</p>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <a className="button" href={backend.signInUrl}>
        {strings.signIn.button}
      </a>
    </main>
  );
}
