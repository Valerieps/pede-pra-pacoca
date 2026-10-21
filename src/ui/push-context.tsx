import { createContext, useContext, type ReactNode } from 'react';
import type { PushDevice } from '../application/ports';

const PushContext = createContext<PushDevice | null>(null);

export function PushProvider({ device, children }: { device: PushDevice; children: ReactNode }) {
  return <PushContext.Provider value={device}>{children}</PushContext.Provider>;
}

export function usePushDevice(): PushDevice {
  const device = useContext(PushContext);
  if (!device) throw new Error('PushProvider is missing');
  return device;
}
