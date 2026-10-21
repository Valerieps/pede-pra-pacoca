// The contract between the app and the server: query and command names, inputs and outputs.
// Types only. The server imports it with `import type`, so nothing here runs on either side.
import type { FeedFilter } from '../domain/feed/feed';
import type { PhotoChoice } from '../domain/group/profile';
import type { Role } from '../domain/group/roles';
import type { CashbackSettings } from '../domain/petisco/cashback';
import type { PetiscoKind, PetiscoOperation } from '../domain/petisco/ledger';
import type { NotificationPrefs } from '../domain/notification/preferences';
import type { NotificationType } from '../domain/notification/types';
import type { MediaType } from '../domain/media/media';
import type { RequestOrigin, RequestStatus } from '../domain/request/lifecycle';
import type { StatsFilter, StatsGroupBy, StatsSort } from '../domain/stats/stats';

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
  /** The request's title, for "Ana pediu *Duna*". */
  readonly requestTitle: string | null;
  readonly at: string;
  readonly likeCount: number;
  readonly likedByMe: boolean;
}

export type { FeedFilter };

export interface LikeToggleView {
  readonly liked: boolean;
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
/** A movie or series as TMDB describes it. Posters are paths on image.tmdb.org. */
export interface MediaView {
  readonly type: MediaType;
  readonly tmdbId: number;
  readonly title: string;
  readonly year: number | null;
  readonly posterPath: string | null;
  /** "YYYY-MM-DD"; the first air date for series. */
  readonly releaseDate: string | null;
  readonly genres: readonly string[];
}

/** The duplicate check (docs/spec/pedidos.md): what already exists for this media or link. */
export type Availability =
  | { readonly kind: 'new' }
  | { readonly kind: 'active'; readonly requestId: string; readonly mine: boolean; readonly joined: boolean }
  | { readonly kind: 'fulfilled'; readonly requestId: string }
  | { readonly kind: 'known' };

export interface MediaCardView extends MediaView {
  readonly availability: Availability;
}

export type SearchType = MediaType | 'all';

/** What to preview: a pasted or shared text with a link, or a pick from the search. */
export type PreviewInput = { readonly text: string } | { readonly type: MediaType; readonly tmdbId: number };

export interface RequestView {
  readonly id: string;
  readonly origin: RequestOrigin;
  readonly mediaType: MediaType;
  readonly tmdbId: number | null;
  readonly title: string;
  readonly year: number | null;
  readonly posterPath: string | null;
  readonly releaseDate: string | null;
  readonly genres: readonly string[];
  /** Only on manual requests: any http(s) URL. */
  readonly link: string | null;
  readonly note: string | null;
  readonly status: RequestStatus;
  readonly requester: MemberView;
  readonly assignee: MemberView | null;
  readonly coRequesters: readonly MemberView[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RequestTransitionView {
  readonly from: RequestStatus | null;
  readonly to: RequestStatus;
  /** Null when the Jellyseerr did it. */
  readonly actor: MemberView | null;
  readonly event: string | null;
  readonly at: string;
}

export interface InheritanceOfferView {
  readonly member: MemberView;
  readonly expiresAt: string;
}

export interface RequestDetailView extends RequestView {
  readonly transitions: readonly RequestTransitionView[];
  /** The co-requester currently offered the request its requester cancelled. */
  readonly offer: InheritanceOfferView | null;
  readonly viewer: {
    readonly isRequester: boolean;
    readonly isCoRequester: boolean;
    readonly canCancel: boolean;
    readonly canEditNote: boolean;
    readonly canJoin: boolean;
    readonly canLeave: boolean;
    readonly hasOffer: boolean;
  };
}

export type CreateRequestInput =
  | {
      readonly origin: 'tmdb';
      readonly type: MediaType;
      readonly tmdbId: number;
      readonly note?: string;
      /** "Pedir de novo" a media already fulfilled or known. */
      readonly again?: boolean;
    }
  | {
      readonly origin: 'manual';
      readonly type: MediaType;
      readonly title: string;
      readonly note?: string;
      readonly link?: string;
      readonly again?: boolean;
    };

export type { StatsFilter, StatsGroupBy, StatsSort };

/** A member's profile numbers (docs/spec/estatisticas.md). Canceled requests do not count. */
export interface ProfileStatsView {
  readonly member: MemberView;
  readonly totalRequests: number;
  readonly fulfilled: number;
  /** From the request to the first Atendido, in milliseconds; null with nothing fulfilled. */
  readonly averageMsToFulfilled: number | null;
  readonly topGenres: readonly { readonly genre: string; readonly count: number }[];
  /** The last 12 months, oldest first, "YYYY-MM" in the group's calendar, zeros included. */
  readonly perMonth: readonly { readonly month: string; readonly count: number }[];
  readonly cashbacks: number;
  /** Likes on the member's feed events, other people's only. */
  readonly likesReceived: number;
}

export interface HistoryRequestView {
  readonly id: string;
  readonly title: string;
  readonly mediaType: MediaType;
  readonly origin: RequestOrigin;
  readonly status: RequestStatus;
  readonly genres: readonly string[];
  readonly posterPath: string | null;
  readonly requester: MemberView;
  readonly assignee: MemberView | null;
  readonly createdAt: string;
  readonly likes: number;
}

/** One group of the history. `key` is a member id, "YYYY-MM", a type, genre, status or origin; "" for none. */
export interface HistoryGroupView {
  readonly key: string;
  /** For person and attendant groups. */
  readonly member: MemberView | null;
  /** Every request of the group, even those past the history limit. */
  readonly count: number;
  readonly requests: readonly HistoryRequestView[];
}

export interface GroupStatsInput {
  readonly filter?: StatsFilter;
  readonly sort?: StatsSort;
  readonly groupBy?: StatsGroupBy;
}

export interface GroupStatsView {
  readonly total: number;
  /** True when the history shows only the first requests (HISTORY_LIMIT). */
  readonly truncated: boolean;
  readonly groups: readonly HistoryGroupView[];
  readonly metrics: {
    readonly perPerson: readonly { readonly member: MemberView; readonly count: number }[];
    readonly perAttendant: readonly { readonly member: MemberView; readonly count: number }[];
    readonly averageMsToFulfilled: number | null;
    /** Não foi possível among Atendido + Não foi possível; null when none closed. */
    readonly unavailableRate: number | null;
    /** Petiscos debited by these requests. */
    readonly petiscosConsumed: number;
    /** Cashbacks given for these requests. */
    readonly petiscosReturned: number;
    readonly mostLiked: readonly { readonly requestId: string; readonly title: string; readonly likes: number }[];
  };
  /** Every genre and attendant ever seen, for the filter pickers. */
  readonly options: { readonly genres: readonly string[]; readonly attendants: readonly MemberView[] };
}

export interface Queries {
  me: { input: Record<string, never>; output: MeView };
  members: { input: Record<string, never>; output: MemberListItem[] };
  invites: { input: Record<string, never>; output: InviteView[] };
  feed: { input: { before?: string; beforeId?: string; filter?: FeedFilter }; output: FeedEventView[] };
  'feed.likes': { input: { eventId: string }; output: MemberView[] };
  'notifications.inbox': { input: Record<string, never>; output: InboxView };
  'notifications.settings': { input: Record<string, never>; output: NotificationSettingsView };
  'media.search': { input: { query: string; type: SearchType }; output: MediaCardView[] };
  'media.preview': { input: PreviewInput; output: MediaCardView };
  'manual.availability': { input: { link: string }; output: Availability };
  'requests.mine': { input: Record<string, never>; output: RequestView[] };
  'request.detail': { input: { id: string }; output: RequestDetailView };
  'petiscos.statement': { input: Record<string, never>; output: PetiscoStatementView };
  'petiscos.settings': { input: Record<string, never>; output: PetiscoSettingsView };
  vacation: { input: Record<string, never>; output: VacationView };
  'group.export': { input: Record<string, never>; output: GroupExport };
  'stats.profile': { input: { memberId: string }; output: ProfileStatsView };
  'stats.group': { input: GroupStatsInput; output: GroupStatsView };
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
  'request.create': { input: CreateRequestInput; output: RequestView };
  'request.join': { input: { id: string }; output: null };
  'request.leave': { input: { id: string }; output: null };
  'request.cancel': { input: { id: string }; output: null };
  'request.editNote': { input: { id: string; note: string }; output: null };
  'request.answerOffer': { input: { id: string; accept: boolean }; output: null };
  'member.updateProfile': { input: { name: string; photo: PhotoChoice }; output: MeView };
  'petiscos.setMonthly': { input: { petiscos: number }; output: null };
  /** `petiscos: null` goes back to the group's number. */
  'petiscos.setMemberMonthly': { input: { memberId: string; petiscos: number | null }; output: null };
  'petiscos.setCashback': { input: CashbackSettings; output: null };
  'petiscos.giveBonus': { input: { memberId: string; amount: number; reason?: string }; output: null };
  'petiscos.giveCashback': { input: { requestId: string; reason?: string }; output: null };
  /** `until` is the return date, "YYYY-MM-DD", or null. */
  'vacation.set': { input: { onVacation: boolean; until: string | null }; output: VacationView };
  'feed.toggleLike': { input: { eventId: string }; output: LikeToggleView };
}

export type QueryName = keyof Queries;
export type CommandName = keyof Commands;

/** What changed, pushed to every open app over the live connection so it refetches. */
export type Topic = 'me' | 'members' | 'invites' | 'feed' | 'requests' | 'notifications' | 'petiscos' | 'vacation';

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
  | 'unavailable'
  /** A shared link the app does not recognize. */
  | 'unrecognized_link';

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };
