// Roles and what each allows (docs/spec/grupo-e-papeis.md).
export type Role = 'admin' | 'attendant';

export interface MemberRoles {
  readonly roles: readonly Role[];
}

/** An attendant in the queue sense: their requests skip petiscos and they get attendant notices. */
export function isAttendant(member: MemberRoles): boolean {
  return member.roles.includes('attendant');
}

export function isAdmin(member: MemberRoles): boolean {
  return member.roles.includes('admin');
}

/** Approve, change status, give petiscos, set petisco rules: attendants, and admins ("tudo do atendente"). */
export function canAttend(member: MemberRoles): boolean {
  return isAttendant(member) || isAdmin(member);
}

/** Invite and remove members, give and take roles, configure Jellyseerr. */
export function canManageGroup(member: MemberRoles): boolean {
  return isAdmin(member);
}

/**
 * Whether a change leaves the group with at least one admin.
 * `activeAdminIds` are the current admins; `losingAdminId` is the one losing the role or removed.
 */
export function keepsAnAdmin(activeAdminIds: readonly string[], losingAdminId: string): boolean {
  return activeAdminIds.some((id) => id !== losingAdminId);
}

export function normalizeRoles(roles: readonly string[]): Role[] {
  const valid: Role[] = ['admin', 'attendant'];
  return valid.filter((role) => roles.includes(role));
}
