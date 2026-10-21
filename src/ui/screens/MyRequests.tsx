import type { RequestView } from '../../application/api-contract';
import { isActive } from '../../domain/request/lifecycle';
import { strings } from '../../domain/strings';
import { Poster } from '../components/Poster';
import { SkeletonCards } from '../components/Skeleton';
import { StatusChip } from '../components/StatusChip';
import { Link } from '../router';
import { useQuery } from '../use-query';

export function MyRequests({ meId }: { meId: string }) {
  const mine = useQuery('requests.mine', {}, ['requests']);
  const active = mine.data?.filter((r) => isActive(r.status)) ?? [];
  const past = mine.data?.filter((r) => !isActive(r.status)) ?? [];

  return (
    <section>
      <h1>{strings.myRequests.title}</h1>
      {mine.error && !mine.data && <p className="notice">{strings.genericError}</p>}
      {!mine.data && !mine.error && <SkeletonCards />}
      {mine.data?.length === 0 && <p className="muted">{strings.myRequests.empty}</p>}
      {active.length > 0 && <RequestList title={strings.myRequests.active} requests={active} meId={meId} />}
      {past.length > 0 && <RequestList title={strings.myRequests.past} requests={past} meId={meId} />}
    </section>
  );
}

function RequestList({ title, requests, meId }: { title: string; requests: RequestView[]; meId: string }) {
  return (
    <>
      <h2>{title}</h2>
      <ul className="list">
        {requests.map((r) => (
          <li key={r.id}>
            <Link to={`/pedido/${r.id}`} className="card request-item">
              <Poster path={r.posterPath} title={r.title} small />
              <span className="grow">
                <strong>{r.title}</strong>
                <br />
                <StatusChip status={r.status} />
                {r.assignee && <span className="muted"> · {strings.request.assignee(r.assignee.name)}</span>}
                {r.requester.id !== meId && <span className="muted"> · {strings.myRequests.coRequested}</span>}
                <br />
                <time className="muted" dateTime={r.createdAt}>
                  {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                </time>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
