// The contract between the app and the server: query and command names, inputs and outputs.
// Types only. The server imports it with `import type`, so nothing here runs on either side.
import type { FeedFilter } from '../domain/feed/feed';
import type { PhotoChoice } from '../domain/group/profile';
import type { Role } from '../domain/group/roles';

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
  readonly likedByMe: boolean;
}

export type { FeedFilter };

export interface LikeToggleView {
  readonly liked: boolean;
  readonly likeCount: number;
}

export interface Queries {
  me: { input: Record<string, never>; output: MeView };
  members: { input: Record<string, never>; output: MemberListItem[] };
  invites: { input: Record<string, never>; output: InviteView[] };
  feed: { input: { before?: string; beforeId?: string; filter?: FeedFilter }; output: FeedEventView[] };
  'feed.likes': { input: { eventId: string }; output: MemberView[] };
}

export interface Commands {
  'invite.create': { input: { email: string }; output: InviteView };
  'invite.revoke': { input: { email: string }; output: null };
  'member.setRoles': { input: { memberId: string; roles: Role[] }; output: MemberView };
  'member.updateProfile': { input: { name: string; photo: PhotoChoice }; output: MeView };
  'feed.toggleLike': { input: { eventId: string }; output: LikeToggleView };
}

export type QueryName = keyof Queries;
export type CommandName = keyof Commands;

/** What changed, pushed to every open app over the live connection so it refetches. */
export type Topic = 'me' | 'members' | 'invites' | 'feed';

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
