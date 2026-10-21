import type { PetiscoMovementView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../format';
import { useQuery } from '../use-query';

function describe(movement: PetiscoMovementView): string {
  const t = strings.petiscos;
  return `${t.operation[movement.operation]} · ${t.kind[movement.kind]}`;
}

/** "O que eu vejo" (docs/spec/petiscos.md): the month's petiscos, bonus and cashback, the statement. */
export function Petiscos() {
  const statement = useQuery('petiscos.statement', {}, ['petiscos', 'me']);
  const t = strings.petiscos;
  const data = statement.data;

  return (
    <section className="stack">
      <h1>{t.title}</h1>
      {statement.error && !data && <p className="notice">{strings.genericError}</p>}
      {data && (
        <>
          <div className="notice">
            <strong>{t.monthly(data.balance.monthlyAvailable, data.balance.monthlyQuota)}</strong>
            <br />
            <span className="muted">{t.renewsOn(formatDate(data.balance.renewsAt))}</span>
          </div>

          <div>
            <h2>{t.extrasTitle}</h2>
            {data.balance.extras.length === 0 ? (
              <p className="muted">{t.noExtras}</p>
            ) : (
              <ul className="list">
                {data.balance.extras.map((extra, i) => (
                  <li key={i} className="card">
                    <span>{t.kind[extra.kind]}</span>
                    <span className="muted">{t.expiresOn(formatDate(extra.expiresAt))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2>{t.statementTitle}</h2>
            {data.movements.length === 0 && <EmptyState text={t.noMovements} />}
            <ul className="list">
              {data.movements.map((m) => (
                <li key={m.id} className="card">
                  <span className="grow">
                    {describe(m)}
                    {m.requestTitle && (
                      <>
                        <br />
                        <span className="muted">{m.requestTitle}</span>
                      </>
                    )}
                    {m.reason && (
                      <>
                        <br />
                        <span className="muted">{m.reason}</span>
                      </>
                    )}
                    {m.expiresAt && m.operation === 'credit' && (
                      <>
                        <br />
                        <span className="muted">{t.expiresOn(formatDate(m.expiresAt))}</span>
                      </>
                    )}
                  </span>
                  <time className="muted" dateTime={m.at}>
                    {formatDate(m.at)}
                  </time>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
