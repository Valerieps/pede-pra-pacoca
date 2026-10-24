import { useState, type FormEvent } from 'react';
import type { AttendantAction, MeView, RequestView } from '../../application/api-contract';
import type { ReasonCode } from '../../domain/request/lifecycle';
import { groupQueue, jellyseerrUrl, QUEUES, sortQueue, type QueueGrouping, type QueueName, type QueueSort } from '../../domain/request/queue';
import { ATTENDANT_REASONS, MAX_FULFILLMENT_NOTE, MAX_REASON_TEXT, parseReason } from '../../domain/request/reason';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { EmptyState } from '../components/EmptyState';
import { SkeletonCards } from '../components/Skeleton';
import { Poster } from '../components/Poster';
import { formatDate, formatDateKey } from '../format';
import { Link } from '../router';
import { useQuery } from '../use-query';
import { VacationSettings } from './Settings';

const t = strings.queues;

type ActionType = AttendantAction['type'];

/** What each queue offers, besides "Eu pego esse" (docs/spec/atendente.md). */
const QUEUE_ACTIONS: Record<QueueName, readonly ActionType[]> = {
  awaiting: ['approve', 'reject'],
  toSend: ['mark_sent', 'mark_fulfilled', 'mark_unavailable'],
  inJellyseerr: ['mark_fulfilled', 'mark_unavailable'],
  manual: ['mark_fulfilled', 'mark_unavailable'],
};

const ACTION_LABELS: Record<Exclude<ActionType, 'assign'>, string> = {
  approve: t.approve,
  reject: t.reject,
  mark_sent: t.sent,
  mark_fulfilled: t.fulfilled,
  mark_unavailable: t.unavailable,
};

/** Actions that ask for a reason or a note before they run. */
type FormAction = 'reject' | 'mark_unavailable' | 'mark_fulfilled';
const needsForm = (type: ActionType): type is FormAction => type === 'reject' || type === 'mark_unavailable' || type === 'mark_fulfilled';

/** The attendant's queues: sort, group, select, and change the status of one request or many. */
export function Queues({ me }: { me: MeView }) {
  const { backend } = useServices();
  const queues = useQuery('queues', {}, ['requests']);
  const [queue, setQueue] = useState<QueueName>('awaiting');
  const [sort, setSort] = useState<QueueSort>('date');
  const [grouping, setGrouping] = useState<QueueGrouping>('none');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [form, setForm] = useState<{ action: FormAction; ids: string[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!queues.data) {
    return queues.error ? <p className="notice">{strings.genericError}</p> : <SkeletonCards />;
  }
  const items = queues.data[queue];
  // A request that left the queue (live update) drops out of the selection.
  const selection = items.filter((r) => selected.has(r.id)).map((r) => r.id);

  function switchQueue(next: QueueName) {
    setQueue(next);
    setSelected(new Set());
    setForm(null);
    setMessage(null);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function run(ids: string[], action: AttendantAction) {
    setBusy(true);
    const result = await backend.command('request.act', { ids, action });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error === 'invalid' ? t.invalid : result.error === 'forbidden' ? strings.forbidden : strings.genericError);
      return;
    }
    const { applied, skipped } = result.value;
    setMessage([applied.length > 0 && t.done(applied.length), skipped.length > 0 && t.skipped(skipped.length)].filter(Boolean).join(' '));
    setForm(null);
    setSelected(new Set());
  }

  function start(ids: string[], type: ActionType) {
    setMessage(null);
    if (needsForm(type)) return setForm({ action: type, ids });
    if (type === 'assign') {
      const takenBy = queues.data![queue].find((r) => ids.includes(r.id) && r.assignee && r.assignee.id !== me.id)?.assignee;
      if (takenBy && !window.confirm(t.takeOverConfirm(takenBy.name))) return;
    }
    void run(ids, { type } as AttendantAction);
  }

  const groups = groupQueue(sortQueue(items, sort), grouping);

  return (
    <section>
      <h1>{strings.nav.manageRequests}</h1>
      <div className="chips" role="tablist">
        {QUEUES.map((name) => (
          <button key={name} type="button" role="tab" aria-selected={name === queue} className={name === queue ? '' : 'chip'} onClick={() => switchQueue(name)}>
            {t.tabs[name]} ({queues.data![name].length})
          </button>
        ))}
      </div>

      <div className="row queue-controls">
        <label className="choice">
          {t.sortLabel}
          <select value={sort} onChange={(e) => setSort(e.target.value as QueueSort)}>
            {(Object.keys(t.sort) as QueueSort[]).map((key) => (
              <option key={key} value={key}>
                {t.sort[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="choice">
          {t.groupLabel}
          <select value={grouping} onChange={(e) => setGrouping(e.target.value as QueueGrouping)}>
            {(Object.keys(t.group) as QueueGrouping[]).map((key) => (
              <option key={key} value={key}>
                {t.group[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      {form ? (
        <ActionForm key={form.action} action={form.action} count={form.ids.length} busy={busy} onCancel={() => setForm(null)} onSubmit={(action) => void run(form.ids, action)} />
      ) : (
        selection.length > 0 && (
          <div className="card stack batch-bar">
            <strong>{t.selected(selection.length)}</strong>
            <div className="row actions">
              {(['assign', ...QUEUE_ACTIONS[queue]] as ActionType[]).map((type) => (
                <button key={type} type="button" className={type === 'reject' || type === 'mark_unavailable' ? 'secondary' : ''} disabled={busy} onClick={() => start(selection, type)}>
                  {type === 'assign' ? t.take : ACTION_LABELS[type]}
                </button>
              ))}
              <button type="button" className="link" onClick={() => setSelected(new Set())}>
                {t.clearSelection}
              </button>
            </div>
          </div>
        )
      )}

      {items.length === 0 && <EmptyState text={strings.queueEmpty} />}
      {groups.map((group) => (
        <div key={group.key}>
          {grouping !== 'none' && <h2>{groupTitle(grouping, group.label)}</h2>}
          <ul className="list">
            {group.items.map((request) => (
              <QueueEntry
                key={request.id}
                request={request}
                meId={me.id}
                actions={QUEUE_ACTIONS[queue]}
                jellyseerr={queue === 'toSend' ? jellyseerrUrl(queues.data!.jellyseerrBaseUrl, request.mediaType, request.tmdbId) : null}
                selected={selected.has(request.id)}
                busy={busy || form !== null}
                onToggle={() => toggle(request.id)}
                onAction={(type) => start([request.id], type)}
              />
            ))}
          </ul>
        </div>
      ))}
      <VacationSettings />
    </section>
  );
}

function groupTitle(grouping: QueueGrouping, label: string | null): string {
  if (grouping === 'type' && label) return strings.mediaType[label as keyof typeof strings.mediaType];
  return label ?? t.nobodyTook;
}

function QueueEntry(props: {
  request: RequestView;
  meId: string;
  actions: readonly ActionType[];
  jellyseerr: string | null;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onAction: (type: ActionType) => void;
}) {
  const { request, meId } = props;
  const mine = request.assignee?.id === meId;
  return (
    <li className="card stack queue-item">
      <div className="row">
        <input type="checkbox" className="queue-check" checked={props.selected} onChange={props.onToggle} aria-label={t.select(request.title)} />
        <Poster path={request.posterPath} title={request.title} small />
        <span className="grow">
          <Link to={`/pedido/${request.id}`}>
            <strong>{request.title}</strong>
          </Link>
          {request.year && <span className="muted"> ({request.year})</span>}
          <br />
          <span className="muted">
            {strings.mediaType[request.mediaType]} · {strings.request.requestedBy(request.requester.name)} · {formatDate(request.createdAt)}
          </span>
          {request.releaseDate && (
            <>
              <br />
              <span className="muted">{t.release(formatDateKey(request.releaseDate))}</span>
            </>
          )}
        </span>
      </div>
      {request.note && (
        <p>
          <span className="muted">{strings.request.noteLabel}: </span>
          {request.note}
        </p>
      )}
      {request.coRequesters.length > 0 && <p>{strings.request.alsoWant(request.coRequesters.map((m) => m.name).join(', '))}</p>}
      <p className="muted">{request.assignee ? t.takenBy(request.assignee.name) : t.nobodyTook}</p>
      <div className="row actions">
        {!mine && (
          <button type="button" className="secondary" disabled={props.busy} onClick={() => props.onAction('assign')}>
            {request.assignee ? t.takeOver(request.assignee.name) : t.take}
          </button>
        )}
        {request.link && (
          <a className="button secondary" href={request.link} target="_blank" rel="noopener noreferrer">
            {strings.request.openLink}
          </a>
        )}
        {props.jellyseerr && (
          <a className="button secondary" href={props.jellyseerr} target="_blank" rel="noopener noreferrer">
            {t.openJellyseerr}
          </a>
        )}
        {props.actions.map((type) => (
          <button
            key={type}
            type="button"
            className={type === 'reject' || type === 'mark_unavailable' ? 'secondary' : ''}
            disabled={props.busy}
            onClick={() => props.onAction(type)}
          >
            {ACTION_LABELS[type as Exclude<ActionType, 'assign'>]}
          </button>
        ))}
      </div>
    </li>
  );
}

/** The reason for Recusar and "Não foi possível", or the optional note for Cãopleto. */
function ActionForm(props: { action: FormAction; count: number; busy: boolean; onCancel: () => void; onSubmit: (action: AttendantAction) => void }) {
  const [code, setCode] = useState<ReasonCode>('not_found');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const withReason = props.action !== 'mark_fulfilled';
  const reason = withReason ? parseReason({ code, text }) : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (props.action === 'mark_fulfilled') return props.onSubmit({ type: 'mark_fulfilled', ...(note.trim() ? { note } : {}) });
    if (reason) props.onSubmit({ type: props.action, reason });
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <strong>
        {ACTION_LABELS[props.action]}
        {props.count > 1 && <> · {t.selected(props.count)}</>}
      </strong>
      {withReason ? (
        <>
          <fieldset>
            <legend className="muted">{t.reasonLabel}</legend>
            {ATTENDANT_REASONS.map((option) => (
              <label key={option} className="choice">
                <input type="radio" name="reason" value={option} checked={code === option} onChange={() => setCode(option)} />
                {strings.reasons[option]}
              </label>
            ))}
          </fieldset>
          <label>
            <span className="muted">{code === 'other' ? t.reasonTextOther : t.reasonText}</span>
            <input value={text} maxLength={MAX_REASON_TEXT} required={code === 'other'} onChange={(e) => setText(e.target.value)} />
          </label>
        </>
      ) : (
        <label>
          <span className="muted">{t.noteLabel}</span>
          <textarea rows={3} maxLength={MAX_FULFILLMENT_NOTE} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      )}
      <div className="row">
        <button type="submit" disabled={props.busy || (withReason && !reason)}>
          {t.confirm}
        </button>
        <button type="button" className="secondary" onClick={props.onCancel}>
          {t.back}
        </button>
      </div>
    </form>
  );
}
