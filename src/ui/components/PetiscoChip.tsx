import { useEffect, useRef, useState } from 'react';
import type { PetiscoBalanceView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { cashbackArrived } from '../petisco-drop';
import { Link } from '../router';
import { PetiscoIcon } from './PetiscoIcon';

/** My petisco counter, in Pedir; it opens the statement. On a cashback a petisco drops into it. */
export function PetiscoChip({ balance }: { balance: PetiscoBalanceView }) {
  const previous = useRef<PetiscoBalanceView>(undefined);
  const [drops, setDrops] = useState(0);
  useEffect(() => {
    if (cashbackArrived(previous.current, balance)) setDrops((n) => n + 1);
    previous.current = balance;
  }, [balance]);

  return (
    <Link to="/petiscos" className="petisco-chip" aria-label={strings.petiscos.balance(balance.total)}>
      {/* A new key restarts the drop animation for each cashback */}
      <span key={drops} className={drops > 0 ? 'petisco-drop' : 'petisco-slot'}>
        <PetiscoIcon />
      </span>
      <span aria-hidden="true">{balance.total}</span>
    </Link>
  );
}
