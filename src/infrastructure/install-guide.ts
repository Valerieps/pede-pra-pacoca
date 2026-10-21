// Whether to explain how to install the app (docs/spec/app-e-instalacao.md, "Instalar").
// Reads the browser's display mode and remembers, on this device only, that the tip was dismissed.

/** Which explanation to show, or null when the app is installed or the tip was dismissed. */
export type InstallGuide = 'ios' | 'android' | 'other' | null;

export interface InstallEnvironment {
  /** Opened from the home screen: display-mode standalone, or navigator.standalone on iPhone. */
  readonly standalone: boolean;
  readonly userAgent: string;
  readonly dismissed: boolean;
}

export function installGuideFor(env: InstallEnvironment): InstallGuide {
  if (env.standalone || env.dismissed) return null;
  // iPadOS reports itself as a Mac; the touch check is done by the caller through maxTouchPoints.
  if (/iPhone|iPad|iPod/i.test(env.userAgent)) return 'ios';
  if (/Android/i.test(env.userAgent)) return 'android';
  return 'other';
}

const DISMISSED_KEY = 'install-guide-dismissed';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function currentInstallGuide(): InstallGuide {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const standalone = iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
  const iPadAsMac = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return installGuideFor({
    standalone,
    userAgent: iPadAsMac ? 'iPad' : navigator.userAgent,
    dismissed: readDismissed(),
  });
}

export function dismissInstallGuide(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Private mode or blocked storage: the tip just comes back on the next visit.
  }
}
