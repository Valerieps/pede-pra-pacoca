import { useEffect, useRef, useState } from 'react';
import type { PetiscoBalanceView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { formatDate } from '../format';
import { cashbackArrived } from '../petisco-drop';
import { petiscoSlots } from '../petisco-row';
import { Link } from '../router';
import { PetiscoIcon } from './PetiscoIcon';

/** My petiscos in Pedir, as a pote; it opens the statement. On a cashback a petisco drops into it. */
export function PetiscoJar({ balance }: { balance: PetiscoBalanceView }) {
  const previous = useRef<PetiscoBalanceView>(undefined);
  const [drops, setDrops] = useState(0);
  useEffect(() => {
    if (cashbackArrived(previous.current, balance)) setDrops((n) => n + 1);
    previous.current = balance;
  }, [balance]);

  const t = strings.ask;
  const slots = petiscoSlots(balance);
  return (
    <Link to="/petiscos" className="petisco-jar">
      <span className="jar" aria-hidden="true">
        <span className="jar-lid" />
        {/* A new key restarts the drop animation for each cashback */}
        <span key={drops} className={drops > 0 ? 'jar-glass petisco-drop' : 'jar-glass'}>
          {slots ? slots.map((slot, i) => <PetiscoIcon key={i} slot={slot} />) : <PetiscoIcon large slot={balance.total > 0 ? 'full' : 'empty'} />}
        </span>
      </span>
      <span className="jar-text">
        <strong className="jar-count">
          {balance.total}
          {balance.extras.length === 0 && <small> {t.jarOf(balance.monthlyQuota)}</small>}
        </strong>
        <span>{t.jarLabel(balance.total)}</span>
        <span className="muted">{t.jarRenews(formatDate(balance.renewsAt))}</span>
        <span className="jar-link">{t.seeStatement}</span>
      </span>
    </Link>
  );
}
