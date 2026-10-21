// The contract between the app and the server: query and command names, inputs and outputs.
// Types only. The server imports it with `import type`, so nothing here runs on either side.
import type { Role } from '../domain/group/roles';
import type { NotificationPrefs } from '../domain/notification/preferences';
import type { NotificationType } from '../domain/notification/types';

export interface MemberView {
  readonly id: string;
  readonly name: string;
  readonly photoUrl: string | null;
  readonly roles: readonly Role[];
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

export interface InboxItemView {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  /** A path in the app to open. */
  readonly url: string;
  readonly read: boolean;
  readonly at: string;
}

export interface InboxView {
  readonly items: readonly InboxItemView[];
  readonly unread: number;
}

export interface NotificationSettingsView {
  readonly prefs: NotificationPrefs;
  /** The VAPID public key the browser subscribes with; null while push is not configured. */
  readonly pushPublicKey: string | null;
  /** Whether the attendant-only types apply to me. */
  readonly attendant: boolean;
}

/** A browser's push subscription, keys in base64url (PushSubscription.getKey). */
export interface PushSubscriptionInput {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

export interface Queries {
  me: { input: Record<string, never>; output: MeView };
  members: { input: Record<string, never>; output: MemberView[] };
  invites: { input: Record<string, never>; output: InviteView[] };
  feed: { input: { before?: string }; output: FeedEventView[] };
  'notifications.inbox': { input: Record<string, never>; output: InboxView };
  'notifications.settings': { input: Record<string, never>; output: NotificationSettingsView };
}

export interface Commands {
  'invite.create': { input: { email: string }; output: InviteView };
  'invite.revoke': { input: { email: string }; output: null };
  'member.setRoles': { input: { memberId: string; roles: Role[] }; output: MemberView };
  'push.subscribe': { input: PushSubscriptionInput; output: null };
  'push.unsubscribe': { input: { endpoint: string }; output: null };
  /** No ids: mark everything read. */
  'notifications.markRead': { input: { ids?: string[] }; output: null };
  'notifications.setPrefs': { input: Partial<NotificationPrefs>; output: NotificationPrefs };
}

export type QueryName = keyof Queries;
export type CommandName = keyof Commands;

/** What changed, pushed to every open app over the live connection so it refetches. */
export type Topic = 'me' | 'members' | 'invites' | 'feed' | 'notifications';

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
