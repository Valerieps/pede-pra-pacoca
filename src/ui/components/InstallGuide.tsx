import { useEffect, useState } from 'react';
import { strings } from '../../domain/strings';
import { currentInstallGuide, dismissInstallGuide, type InstallGuide as Guide } from '../../infrastructure/install-guide';

/** The install prompt Chrome fires on Android; offered as a button when it arrives. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** How to put the app on the home screen, shown in the browser until installed or dismissed. */
export function InstallGuide() {
  const [guide, setGuide] = useState<Guide>(currentInstallGuide);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setGuide(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!guide) return null;

  function dismiss() {
    dismissInstallGuide();
    setGuide(null);
  }

  return (
    <aside className="notice install-guide" aria-label={strings.install.title}>
      <strong>{strings.install.title}</strong>
      <p>{strings.install[guide]}</p>
      <div className="row">
        {prompt && (
          <button type="button" onClick={() => void prompt.prompt().then(() => setPrompt(null))}>
            {strings.install.installButton}
          </button>
        )}
        <button type="button" className="secondary" onClick={dismiss}>
          {strings.install.dismiss}
        </button>
      </div>
    </aside>
  );
}
