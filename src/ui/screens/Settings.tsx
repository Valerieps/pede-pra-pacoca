import { useState, type FormEvent } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import type { ApiResult, PetiscoSettingsView } from '../../application/api-contract';
import { MAX_BONUS_PER_GRANT, MAX_CASHBACK_THRESHOLD, MAX_MONTHLY_PETISCOS, REASON_MAX_LENGTH } from '../../domain/petisco/settings';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { formatDate, formatDateKey } from '../format';
import { useQuery } from '../use-query';

const t = strings.settings;

/** A message per form, after each save. */
function useFeedback() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(call: () => Promise<ApiResult<unknown>>, ok: string, errors: Partial<Record<string, string>> = {}) {
    setBusy(true);
    const result = await call();
    setBusy(false);
    setMessage(result.ok ? ok : (errors[result.error] ?? (result.error === 'invalid' ? t.invalid : result.error === 'forbidden' ? strings.forbidden : strings.genericError)));
    return result.ok;
  }
  const view = message && (
    <p className="notice" role="status">
      {message}
    </p>
  );
  return { busy, run, view };
}

const toNumber = (text: string) => (text.trim() === '' ? null : Number(text));

/** Gerenciar petiscos, for attendants and admins: the rules, the bonuses and the manual cashback. */
export function ManagePetiscos() {
  return (
    <section className="stack">
      <Breadcrumbs items={[{ label: strings.nav.manage, to: '/gerenciar' }, { label: strings.nav.managePetiscos }]} />
      <h1 className="sr-only">{strings.nav.managePetiscos}</h1>
      <PetiscoSettings />
    </section>
  );
}

/** Ajustes do grupo, for admins: the data download. */
export function GroupSettings() {
  return (
    <section className="stack">
      <Breadcrumbs items={[{ label: strings.nav.manage, to: '/gerenciar' }, { label: strings.nav.groupSettings }]} />
      <h1 className="sr-only">{strings.nav.groupSettings}</h1>
      <ExportData />
    </section>
  );
}

/** My vacation, in Gerenciar pedidos; only who has the attendant role has one. */
export function VacationSettings() {
  const { backend } = useServices();
  const vacation = useQuery('vacation', {}, ['vacation']);
  const mine = vacation.data?.mine;
  const [until, setUntil] = useState('');
  const feedback = useFeedback();
  if (!mine) return null;

  function toggle() {
    const on = !mine!.onVacation;
    void feedback.run(() => backend.command('vacation.set', { onVacation: on, until: on && until ? until : null }), t.saved, {
      invalid: t.vacationInvalidDate,
    });
  }

  return (
    <div className="stack">
      <h2>{t.vacationTitle}</h2>
      {mine.onVacation ? (
        <p>{t.vacationOn(mine.until ? formatDateKey(mine.until) : null)}</p>
      ) : (
        <label>
          <span className="muted">{t.vacationUntil}</span>
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </label>
      )}
      <label className="choice">
        <input type="checkbox" checked={mine.onVacation} disabled={feedback.busy} onChange={toggle} />
        {t.vacationLabel}
      </label>
      {feedback.view}
    </div>
  );
}

function PetiscoSettings() {
  const settings = useQuery('petiscos.settings', {}, ['petiscos', 'members', 'feed']);
  if (settings.error && !settings.data) return <p className="notice">{strings.genericError}</p>;
  if (!settings.data) return null;
  return (
    <>
      <MonthlyNumber key={`m${settings.data.monthlyPetiscos}`} current={settings.data.monthlyPetiscos} />
      <PerMember settings={settings.data} />
      <Cashback key={JSON.stringify(settings.data.cashback)} settings={settings.data} />
      <Bonus settings={settings.data} />
      <ManualCashback settings={settings.data} />
    </>
  );
}

function MonthlyNumber({ current }: { current: number }) {
  const { backend } = useServices();
  const [value, setValue] = useState(String(current));
  const feedback = useFeedback();
  function submit(event: FormEvent) {
    event.preventDefault();
    void feedback.run(() => backend.command('petiscos.setMonthly', { petiscos: Number(value) }), t.saved);
  }
  return (
    <form className="stack" onSubmit={submit}>
      <label>
        <span className="muted">{t.monthlyLabel}</span>
        <input className="inline-number" type="number" min={0} max={MAX_MONTHLY_PETISCOS} required value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button type="submit" disabled={feedback.busy}>
        {t.save}
      </button>
      {feedback.view}
    </form>
  );
}

function PerMember({ settings }: { settings: PetiscoSettingsView }) {
  const { backend } = useServices();
  const feedback = useFeedback();
  function save(memberId: string, text: string) {
    void feedback.run(() => backend.command('petiscos.setMemberMonthly', { memberId, petiscos: toNumber(text) }), t.saved);
  }
  return (
    <div className="stack">
      <h2>{t.perMemberTitle}</h2>
      <p className="muted">{t.perMemberHint}</p>
      <ul className="list">
        {settings.members.map((m) => (
          <li key={`${m.id}:${m.monthlyPetiscos}`} className="card">
            <span className="grow">{m.name}</span>
            <input
              className="inline-number"
              type="number"
              min={0}
              max={MAX_MONTHLY_PETISCOS}
              aria-label={t.perMemberLabel(m.name)}
              placeholder={String(settings.monthlyPetiscos)}
              defaultValue={m.monthlyPetiscos ?? ''}
              disabled={feedback.busy}
              onBlur={(e) => {
                if (toNumber(e.target.value) !== m.monthlyPetiscos) save(m.id, e.target.value);
              }}
            />
          </li>
        ))}
      </ul>
      {feedback.view}
    </div>
  );
}

function Cashback({ settings }: { settings: PetiscoSettingsView }) {
  const { backend } = useServices();
  const [enabled, setEnabled] = useState(settings.cashback.coRequesters.enabled);
  const [threshold, setThreshold] = useState(String(settings.cashback.coRequesters.threshold));
  const feedback = useFeedback();
  function submit(event: FormEvent) {
    event.preventDefault();
    void feedback.run(() => backend.command('petiscos.setCashback', { coRequesters: { enabled, threshold: Number(threshold) } }), t.saved);
  }
  return (
    <form className="stack" onSubmit={submit}>
      <h2>{t.cashbackTitle}</h2>
      <label className="choice">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {t.coRequestersLabel}
      </label>
      <label>
        <span className="muted">{t.thresholdLabel}</span>
        <input
          className="inline-number"
          type="number"
          min={1}
          max={MAX_CASHBACK_THRESHOLD}
          required
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
      </label>
      <button type="submit" disabled={feedback.busy}>
        {t.save}
      </button>
      {feedback.view}
    </form>
  );
}

function Bonus({ settings }: { settings: PetiscoSettingsView }) {
  const { backend } = useServices();
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState('');
  const feedback = useFeedback();
  async function submit(event: FormEvent) {
    event.preventDefault();
    const given = await feedback.run(() => backend.command('petiscos.giveBonus', { memberId, amount: Number(amount), reason }), t.bonusGiven);
    if (given) setReason('');
  }
  return (
    <form className="stack" onSubmit={(e) => void submit(e)}>
      <h2>{t.bonusTitle}</h2>
      <label>
        <span className="muted">{t.bonusMember}</span>
        <select required value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="" disabled />
          {settings.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="muted">{t.bonusAmount}</span>
        <input className="inline-number" type="number" min={1} max={MAX_BONUS_PER_GRANT} required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label>
        <span className="muted">{t.reasonLabel}</span>
        <input maxLength={REASON_MAX_LENGTH} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <button type="submit" disabled={feedback.busy}>
        {t.giveBonus}
      </button>
      {feedback.view}
    </form>
  );
}

function ManualCashback({ settings }: { settings: PetiscoSettingsView }) {
  const { backend } = useServices();
  const [reason, setReason] = useState('');
  const feedback = useFeedback();
  async function give(requestId: string) {
    const given = await feedback.run(() => backend.command('petiscos.giveCashback', { requestId, reason }), t.cashbackGiven, {
      conflict: t.cashbackConflict,
    });
    if (given) setReason('');
  }
  return (
    <div className="stack">
      <h2>{t.manualCashbackTitle}</h2>
      {settings.cashbackCandidates.length === 0 ? (
        <p className="muted">{t.manualCashbackEmpty}</p>
      ) : (
        <>
          <label>
            <span className="muted">{t.reasonLabel}</span>
            <input maxLength={REASON_MAX_LENGTH} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <ul className="list">
            {settings.cashbackCandidates.map((c) => (
              <li key={c.requestId} className="card">
                <span className="grow">
                  {c.title}
                  <br />
                  <span className="muted">
                    {c.requester.name} · {formatDate(c.fulfilledAt)}
                  </span>
                </span>
                <button type="button" className="secondary" disabled={feedback.busy} onClick={() => void give(c.requestId)}>
                  {t.giveCashback}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {feedback.view}
    </div>
  );
}

/** The whole group as a JSON file, built in the browser: nothing about it goes in a URL. */
function ExportData() {
  const { backend } = useServices();
  const feedback = useFeedback();
  async function download() {
    await feedback.run(async () => {
      const result = await backend.query('group.export', {});
      if (result.ok) {
        const blob = new Blob([JSON.stringify(result.value, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pede-pra-pacoca-${result.value.exportedAt.slice(0, 10)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      return result;
    }, t.exportDone);
  }
  return (
    <div className="stack">
      <h2>{t.exportTitle}</h2>
      <p className="muted">{t.exportHint}</p>
      <button type="button" disabled={feedback.busy} onClick={() => void download()}>
        {t.exportButton}
      </button>
      {feedback.view}
    </div>
  );
}
