// A request's status as a chip: a dot and the status name, colored by its tone.
import type { RequestStatus } from '../../domain/request/lifecycle';
import { strings } from '../../domain/strings';
import { statusTone } from '../status-tone';

export function StatusChip({ status }: { status: RequestStatus }) {
  return <span className={`status-chip status-${statusTone(status)}`}>{strings.requestStatus[status]}</span>;
}
