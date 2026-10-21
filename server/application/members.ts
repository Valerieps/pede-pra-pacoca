// Members, sign-in and sessions (docs/spec/grupo-e-papeis.md, docs/spec/app-e-instalacao.md).
import type { MemberListItem, MemberView, MeView } from '../../src/application/api-contract';
import { normalizeEmail } from '../../src/domain/group/email';
import { isPhotoChoice, normalizeName, photoFor, type PhotoChoice } from '../../src/domain/group/profile';
import { isAdmin, keepsAnAdmin, normalizeRoles, type Role } from '../../src/domain/group/roles';
import { failure, nowIso, type CommandResult, type Context } from './context';
import { recordFeedEvent } from './feed';
import { petiscoBalanceOf } from './petiscos';

export const SESSION_DAYS = 180;

export interface MemberRow {
  id: string;
  google_sub: string | null;
  email: string;
  name: string;
  photo_url: string | null;
  roles: string;
  active: number;
  monthly_petiscos: number | null;
  profile_confirmed_at: string | null;
  photo_choice: string;
  google_photo_url: string | null;
}

export interface Member {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly photoUrl: string | null;
  readonly roles: readonly Role[];
  readonly active: boolean;
  readonly monthlyPetiscos: number | null;
  readonly profileConfirmed: boolean;
  readonly photoChoice: PhotoChoice;
  readonly googlePhotoUrl: string | null;
}

export interface GoogleProfile {
  readonly sub: string;
  readonly email: string;
  readonly name: string;
  readonly picture: string | null;
}

export function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    photoUrl: row.photo_url,
    roles: normalizeRoles(JSON.parse(row.roles) as string[]),
    active: row.active === 1,
    monthlyPetiscos: row.monthly_petiscos,
    profileConfirmed: row.profile_confirmed_at !== null,
    photoChoice: isPhotoChoice(row.photo_choice) ? row.photo_choice : 'google',
    googlePhotoUrl: row.google_photo_url,
  };
}

export function memberView(member: Member): MemberView {
  return { id: member.id, name: member.name, photoUrl: member.photoUrl, roles: member.roles };
}

export function findMember(ctx: Context, id: string): Member | null {
  const [row] = ctx.sql.all<MemberRow>('SELECT * FROM members WHERE id = ?', id);
  return row ? toMember(row) : null;
}

export function activeAdminIds(ctx: Context): string[] {
  return ctx.sql
    .all<MemberRow>('SELECT * FROM members WHERE active = 1')
    .map(toMember)
    .filter(isAdmin)
    .map((m) => m.id);
}

/** Keeps the Google photo current, and shows it only to whoever chose it (two bindings: the photo). */
const GOOGLE_PHOTO_UPDATE = "google_photo_url = ?, photo_url = CASE photo_choice WHEN 'google' THEN ? ELSE NULL END";

export type SignInResult = { ok: true; memberId: string } | { ok: false; error: 'no_invite' };

/**
 * Lets a Google account in when it is an active member or has a pending invite. With no admin
 * at all (a brand-new group), the e-mails in `bootstrapAdminEmails` enter as admins.
 * Nothing is created for anyone else.
 */
export function signIn(ctx: Context, profile: GoogleProfile, sessionHash: string, bootstrapAdminEmails: readonly string[]): SignInResult {
  const email = normalizeEmail(profile.email);
  const at = nowIso(ctx);
  return ctx.sql.transaction(() => {
    const [row] = ctx.sql.all<MemberRow>(
      'SELECT * FROM members WHERE google_sub = ? OR email = ? ORDER BY google_sub = ? DESC LIMIT 1',
      profile.sub,
      email,
      profile.sub,
    );
    let memberId: string;

    if (row && row.active === 1) {
      memberId = row.id;
      ctx.sql.run(`UPDATE members SET google_sub = ?, ${GOOGLE_PHOTO_UPDATE} WHERE id = ?`, profile.sub, profile.picture, profile.picture, memberId);
    } else {
      const [invite] = ctx.sql.all<{ email: string }>("SELECT email FROM invites WHERE email = ? AND state = 'pending'", email);
      const bootstrap = activeAdminIds(ctx).length === 0 && bootstrapAdminEmails.map(normalizeEmail).includes(email);
      if (!invite && !bootstrap) return { ok: false, error: 'no_invite' } as const;
      const roles: Role[] = bootstrap ? ['admin'] : [];

      if (row) {
        // Back by a new invite: same member, same history and petiscos (docs/spec/grupo-e-papeis.md).
        memberId = row.id;
        ctx.sql.run(
          `UPDATE members SET active = 1, removed_at = NULL, google_sub = ?, ${GOOGLE_PHOTO_UPDATE}, roles = ? WHERE id = ?`,
          profile.sub,
          profile.picture,
          profile.picture,
          JSON.stringify(roles),
          memberId,
        );
      } else {
        memberId = ctx.ids.next();
        ctx.sql.run(
          'INSERT INTO members (id, google_sub, email, name, photo_url, google_photo_url, roles, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          memberId,
          profile.sub,
          email,
          normalizeName(profile.name) ?? email,
          profile.picture,
          profile.picture,
          JSON.stringify(roles),
          at,
        );
      }
      if (invite) ctx.sql.run("UPDATE invites SET state = 'accepted', accepted_at = ? WHERE email = ?", at, email);
      recordFeedEvent(ctx, { type: 'member_joined', actorId: memberId, requestId: null });
    }

    const expires = new Date(ctx.clock.now().getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    ctx.sql.run('INSERT INTO sessions (token_hash, member_id, created_at, expires_at) VALUES (?, ?, ?, ?)', sessionHash, memberId, at, expires);
    return { ok: true, memberId } as const;
  });
}

/** The active member behind a session, or null: removed members lose access at once. */
export function memberForSession(ctx: Context, sessionHash: string): Member | null {
  const [row] = ctx.sql.all<MemberRow>(
    `SELECT members.* FROM sessions JOIN members ON members.id = sessions.member_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND members.active = 1`,
    sessionHash,
    nowIso(ctx),
  );
  return row ? toMember(row) : null;
}

export function signOut(ctx: Context, sessionHash: string): void {
  ctx.sql.run('DELETE FROM sessions WHERE token_hash = ?', sessionHash);
}

export function me(ctx: Context, member: Member): MeView {
  return {
    ...memberView(member),
    email: member.email,
    petiscos: petiscoBalanceOf(ctx, member),
    profileConfirmed: member.profileConfirmed,
    photoChoice: member.photoChoice,
    googlePhotoUrl: member.googlePhotoUrl,
  };
}

/** Everyone sees name, photo and roles; only admins also see the e-mail. */
export function listMembers(ctx: Context, actor: Member): MemberListItem[] {
  return ctx.sql
    .all<MemberRow>('SELECT * FROM members WHERE active = 1 ORDER BY name COLLATE NOCASE')
    .map(toMember)
    .map((m) => (isAdmin(actor) ? { ...memberView(m), email: m.email } : memberView(m)));
}

/** First access and later: the member confirms their own name and photo. */
export function updateProfile(ctx: Context, actor: Member, input: { name?: unknown; photo?: unknown }): CommandResult<MeView> {
  if (typeof input.name !== 'string' || !isPhotoChoice(input.photo)) return failure('invalid');
  const name = normalizeName(input.name);
  if (!name) return failure('invalid');
  const photoUrl = photoFor(input.photo, actor.googlePhotoUrl);
  ctx.sql.run(
    'UPDATE members SET name = ?, photo_choice = ?, photo_url = ?, profile_confirmed_at = COALESCE(profile_confirmed_at, ?) WHERE id = ?',
    name,
    input.photo,
    photoUrl,
    nowIso(ctx),
    actor.id,
  );
  const updated: Member = { ...actor, name, photoChoice: input.photo, photoUrl, profileConfirmed: true };
  return { ok: true, value: me(ctx, updated), changed: ['me', 'members', 'feed'] };
}

/** Only admins give and take roles, and the last admin keeps theirs. */
export function setRoles(ctx: Context, actor: Member, input: { memberId?: unknown; roles?: unknown }): CommandResult<MemberView> {
  if (!isAdmin(actor)) return failure('forbidden');
  if (typeof input.memberId !== 'string' || !Array.isArray(input.roles)) return failure('invalid');
  const target = findMember(ctx, input.memberId);
  if (!target || !target.active) return failure('not_found');
  const roles = normalizeRoles(input.roles.filter((r): r is string => typeof r === 'string'));
  if (isAdmin(target) && !roles.includes('admin') && !keepsAnAdmin(activeAdminIds(ctx), target.id)) {
    return failure('last_admin');
  }
  ctx.sql.run('UPDATE members SET roles = ? WHERE id = ?', JSON.stringify(roles), target.id);
  return { ok: true, value: memberView({ ...target, roles }), changed: ['members', 'me'] };
}
