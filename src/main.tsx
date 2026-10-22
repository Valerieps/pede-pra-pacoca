import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { httpBackend } from './infrastructure/http-backend';
import { liveSocket } from './infrastructure/live-socket';
import { browserPushDevice } from './infrastructure/push-device';
import { browserShareEnvironment, captureShare } from './infrastructure/share-target';
import { startTheme } from './infrastructure/theme';
import { App } from './ui/App';
import { ServicesProvider } from './ui/backend-context';
import { PushProvider } from './ui/push-context';
import './ui/theme/tokens.css';
import './ui/theme/global.css';
import './ui/theme/shell.css';

// Before anything reads the address: a link shared from Android becomes a pending share on /pedir.
captureShare(browserShareEnvironment());

// Before the first paint of the app, so a chosen theme does not flash the other one.
startTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider backend={httpBackend()} live={liveSocket()}>
      <PushProvider device={browserPushDevice()}>
        <App />
      </PushProvider>
    </ServicesProvider>
  </StrictMode>,
);
