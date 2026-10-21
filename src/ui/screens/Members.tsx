import { useState } from 'react';
import type { ApiError, MeView, MemberListItem } from '../../application/api-contract';
import { canManageGroup, type Role } from '../../domain/group/roles';
import { strings } from '../../domain/strings';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { useServices } from '../backend-context';
import { Link } from '../router';
import { useQuery } from '../use-query';

function errorText(error: ApiError): string {
  if (error === 'last_admin') return strings.members.lastAdmin;
  if (error === 'forbidden') return strings.forbidden;
  return strings.genericError;
}

function rolesLabel(roles: readonly Role[]): string {
  const labels: string[] = [];
  if (roles.includes('admin')) labels.push(strings.members.admin);
  if (roles.includes('attendant')) labels.push(strings.members.attendant);
  return labels.length > 0 ? labels.join(' · ') : strings.members.requester;
}

export function Members({ me }: { me: MeView }) {
  const { backend } = useServices();
  const members = useQuery('members', {}, ['members']);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const isAdmin = canManageGroup(me);

  async function toggle(member: MemberListItem, role: Role) {
    const roles = member.roles.includes(role) ? member.roles.filter((r) => r !== role) : [...member.roles, role];
    setBusy(member.id);
    const result = await backend.command('member.setRoles', { memberId: member.id, roles });
    setBusy(null);
    setError(result.ok ? null : errorText(result.error));
  }

  async function remove(member: MemberListItem) {
    if (!window.confirm(strings.members.removeConfirm(member.name))) return;
    setBusy(member.id);
    const result = await backend.command('member.remove', { memberId: member.id });
    setBusy(null);
    setError(result.ok ? null : errorText(result.error));
  }

  return (
    <section>
      <h1>{strings.members.title}</h1>
      {members.error && !members.data && <p className="notice">{strings.genericError}</p>}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {members.data?.length === 1 && <EmptyState text={strings.members.empty} />}
      <ul className="list">
        {members.data?.map((member) => (
          <li key={member.id} className="card">
            <Avatar name={member.name} photoUrl={member.photoUrl} />
            <span className="grow">
              <Link to={`/membro/${member.id}`}>{member.name}</Link> {member.id === me.id && <span className="muted">{strings.members.you}</span>}
              <br />
              <span className="muted">{rolesLabel(member.roles)}</span>
              {member.email && (
                <>
                  <br />
                  <span className="muted">{member.email}</span>
                </>
              )}
            </span>
            {isAdmin && (
              <span className="toggles" role="group" aria-label={strings.members.rolesOf(member.name)}>
                {(['attendant', 'admin'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    className="toggle"
                    aria-pressed={member.roles.includes(role)}
                    disabled={busy === member.id}
                    onClick={() => void toggle(member, role)}
                  >
                    {role === 'admin' ? strings.members.admin : strings.members.attendant}
                  </button>
                ))}
                {member.id !== me.id && (
                  <button
                    type="button"
                    className="toggle danger"
                    aria-label={strings.members.removeOf(member.name)}
                    disabled={busy === member.id}
                    onClick={() => void remove(member)}
                  >
                    {strings.members.remove}
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
