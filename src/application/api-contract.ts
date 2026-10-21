// The contract between the app and the server: query and command names, inputs and outputs.
// Types only. The server imports it with `import type`, so nothing here runs on either side.
import type { PhotoChoice } from '../domain/group/profile';
import type { Role } from '../domain/group/roles';
import type { CashbackSettings } from '../domain/petisco/cashback';
import type { PetiscoKind, PetiscoOperation } from '../domain/petisco/ledger';

export interface MemberView {
  readonly id: string;
  readonly name: string;
  readonly photoUrl: string | null;
  readonly roles: readonly Role[];
}

/** A row of the members screen: the e-mail only reaches admins. */
export interface MemberListItem extends MemberView {
  readonly email?: string;
}

export interface PetiscoBalanceView {
  readonly total: number;
  readonly monthlyAvailable: number;
  readonly monthlyQuota: number;
  readonly renewsAt: string;
  readonly extras: readonly { readonly kind: 'bonus' | 'cashback'; readonly expiresAt: string }[];
}

export interface MeView extends MemberView {
  readonly email: string;
  readonly petiscos: PetiscoBalanceView;
  /** False until the first-access screen is confirmed. */
  readonly profileConfirmed: boolean;
  readonly photoChoice: PhotoChoice;
  /** The Google account's photo, offered on the profile screen even when the member chose none. */
  readonly googlePhotoUrl: string | null;
}

/** One line of "O que eu vejo": the statement of movements, newest first. */
export interface PetiscoMovementView {
  readonly id: string;
  readonly at: string;
  readonly kind: PetiscoKind;
  readonly operation: PetiscoOperation;
  readonly requestId: string | null;
  readonly requestTitle: string | null;
  /** Bonus and cashback credits only. */
  readonly expiresAt: string | null;
  readonly reason: string | null;
}

export interface PetiscoStatementView {
  readonly balance: PetiscoBalanceView;
  readonly movements: readonly PetiscoMovementView[];
}

/** The attendant's petisco settings. */
export interface PetiscoSettingsView {
  readonly monthlyPetiscos: number;
  readonly cashback: CashbackSettings;
  /** Everyone active, with their fixed number when the attendant set one. */
  readonly members: readonly (MemberView & { readonly monthlyPetiscos: number | null })[];
  /** Fulfilled requests that debited a petisco and got no cashback yet: manual cashback candidates. */
  readonly cashbackCandidates: readonly { readonly requestId: string; readonly title: string; readonly requester: MemberView; readonly fulfilledAt: string }[];
}

export interface VacationView {
  /** "A Paçoca está dormindo": every attendant is on vacation. */
  readonly sleeping: boolean;
  /** The earliest return date ("YYYY-MM-DD") while sleeping, if any attendant gave one. */
  readonly returnsOn: string | null;
  /** The actor's own vacation; null for who is not an attendant. */
  readonly mine: { readonly onVacation: boolean; readonly until: string | null } | null;
}

/** The admin's download of the group's data: every table, minus sessions and secrets. */
export interface GroupExport {
  readonly exportedAt: string;
  readonly schemaVersion: number;
  readonly tables: Readonly<Record<string, readonly Record<string, unknown>[]>>;
}

export type InviteState = 'pending' | 'accepted' | 'revoked';

export interface InviteView {
  readonly email: string;
  readonly state: InviteState;
  readonly invitedByName: string;
  readonly createdAt: string;
  readonly acceptedAt: string | null;
}

export type FeedEventType =
  | 'member_joined'
  | 'request_created'
  | 'co_request'
  | 'request_fulfilled'
  | 'watched'
  | 'thanked'
  | 'cashback';

export interface FeedEventView {
  readonly id: string;
  readonly type: FeedEventType;
  readonly actor: MemberView;
  readonly requestId: string | null;
  readonly at: string;
  readonly likeCount: number;
}

export interface Queries {
  me: { input: Record<string, never>; output: MeView };
  members: { input: Record<string, never>; output: MemberListItem[] };
  invites: { input: Record<string, never>; output: InviteView[] };
  feed: { input: { before?: string }; output: FeedEventView[] };
  'petiscos.statement': { input: Record<string, never>; output: PetiscoStatementView };
  'petiscos.settings': { input: Record<string, never>; output: PetiscoSettingsView };
  vacation: { input: Record<string, never>; output: VacationView };
  'group.export': { input: Record<string, never>; output: GroupExport };
}

export interface Commands {
  'invite.create': { input: { email: string }; output: InviteView };
  'invite.revoke': { input: { email: string }; output: null };
  'member.setRoles': { input: { memberId: string; roles: Role[] }; output: MemberView };
  'member.updateProfile': { input: { name: string; photo: PhotoChoice }; output: MeView };
  'petiscos.setMonthly': { input: { petiscos: number }; output: null };
  /** `petiscos: null` goes back to the group's number. */
  'petiscos.setMemberMonthly': { input: { memberId: string; petiscos: number | null }; output: null };
  'petiscos.setCashback': { input: CashbackSettings; output: null };
  'petiscos.giveBonus': { input: { memberId: string; amount: number; reason?: string }; output: null };
  'petiscos.giveCashback': { input: { requestId: string; reason?: string }; output: null };
  /** `until` is the return date, "YYYY-MM-DD", or null. */
  'vacation.set': { input: { onVacation: boolean; until: string | null }; output: VacationView };
}

export type QueryName = keyof Queries;
export type CommandName = keyof Commands;

/** What changed, pushed to every open app over the live connection so it refetches. */
export type Topic = 'me' | 'members' | 'invites' | 'feed' | 'petiscos' | 'vacation';

export interface LiveMessage {
  readonly type: 'changed';
  readonly topics: readonly Topic[];
}

export type ApiError =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'conflict'
  | 'last_admin'
  | 'unavailable';

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };
