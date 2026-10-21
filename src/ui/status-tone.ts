// How each request status looks as a chip (docs/spec/pedidos.md, "Ciclo de vida"): one tone per
// step, so waiting, moving, done, failed and canceled read apart at a glance.
import type { RequestStatus } from '../domain/request/lifecycle';

export type StatusTone = 'waiting' | 'approved' | 'sent' | 'done' | 'failed' | 'canceled';

const TONES: Record<RequestStatus, StatusTone> = {
  awaiting_approval: 'waiting',
  approved: 'approved',
  in_jellyseerr: 'sent',
  fulfilled: 'done',
  rejected: 'failed',
  unavailable: 'failed',
  canceled: 'canceled',
};

export function statusTone(status: RequestStatus): StatusTone {
  return TONES[status];
}
