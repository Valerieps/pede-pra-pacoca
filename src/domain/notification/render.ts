// Turns a stored notification into the text and the screen it opens. Used for the push payload
// and for the inbox, so both always say the same thing.
import { strings } from '../strings';
import type { NotificationData, NotificationType } from './types';

export interface RenderedNotification {
  readonly title: string;
  readonly body: string;
  /** A path in the app, never a full URL: the service worker opens it on the app's own origin. */
  readonly url: string;
}

const t = strings.notifications.push;
const requestUrl = (id: string) => `/pedido/${encodeURIComponent(id)}`;

type Renderers = { [T in NotificationType]: (data: NotificationData[T]) => RenderedNotification };

const RENDER: Renderers = {
  request_new: (d) => ({ title: t.requestNewTitle, body: t.requestNew(d.requesterName, d.title), url: requestUrl(d.requestId) }),
  request_pending: (d) => ({ title: t.requestPendingTitle, body: t.requestPending(d.requesterName, d.title), url: requestUrl(d.requestId) }),
  request_approved: (d) => ({ title: t.requestApprovedTitle, body: t.requestApproved(d.title), url: requestUrl(d.requestId) }),
  request_closed: (d) =>
    d.outcome === 'refused'
      ? { title: t.requestRefusedTitle, body: t.requestRefused(d.title, d.reason), url: requestUrl(d.requestId) }
      : { title: t.requestUnavailableTitle, body: t.requestUnavailable(d.title, d.reason), url: requestUrl(d.requestId) },
  request_partially_available: (d) => ({ title: t.requestPartialTitle, body: t.requestPartial(d.title), url: requestUrl(d.requestId) }),
  request_fulfilled: (d) => ({ title: t.requestFulfilledTitle, body: t.requestFulfilled(d.title, d.note), url: requestUrl(d.requestId) }),
  co_request: (d) => ({ title: t.coRequestTitle, body: t.coRequest(d.memberName, d.title), url: requestUrl(d.requestId) }),
  likes: (d) => ({ title: t.likesTitle, body: t.likes(d.names, d.requestId !== null), url: d.requestId ? requestUrl(d.requestId) : '/' }),
  petisco_received: (d) => ({ title: t.petiscoReceivedTitle, body: t.petiscoReceived(d.kind, d.amount), url: '/' }),
  petisco_expiring: (d) => ({ title: t.petiscoExpiringTitle, body: t.petiscoExpiring(d.amount), url: '/' }),
  monthly_renewed: (d) => ({ title: t.monthlyRenewedTitle, body: t.monthlyRenewed(d.amount), url: '/' }),
  thanked: (d) => ({ title: t.thankedTitle, body: t.thanked(d.memberName, d.title), url: requestUrl(d.requestId) }),
  webhook_failed: (d) => ({ title: t.webhookFailedTitle, body: t.webhookFailed(d.detail), url: '/avisos' }),
  inheritance_offer: (d) => ({ title: t.inheritanceOfferTitle, body: t.inheritanceOffer(d.title), url: requestUrl(d.requestId) }),
  problem_reported: (d) => ({ title: t.problemReportedTitle, body: t.problemReported(d.memberName, d.title, d.description), url: '/filas' }),
  problem_resolved: (d) => ({ title: t.problemResolvedTitle, body: t.problemResolved(d.title), url: '/catalogo' }),
  request_stuck: (d) => ({ title: t.requestStuckTitle, body: t.requestStuck(d.title, d.status, d.days), url: requestUrl(d.requestId) }),
  daily_digest: (d) => ({ title: t.dailyDigestTitle, body: t.dailyDigest(d.titles), url: '/avisos' }),
};

export function renderNotification<T extends NotificationType>(type: T, data: NotificationData[T]): RenderedNotification {
  return RENDER[type](data);
}

/** Data that piles up in one pending push: likes on the same event, requests in the same digest. */
export function mergeData<T extends NotificationType>(type: T, pending: NotificationData[T], next: NotificationData[T]): NotificationData[T] {
  if (type === 'likes') {
    const a = pending as NotificationData['likes'];
    const b = next as NotificationData['likes'];
    return { ...b, names: [...new Set([...a.names, ...b.names])] } as NotificationData[T];
  }
  if (type === 'daily_digest') {
    const a = pending as NotificationData['daily_digest'];
    const b = next as NotificationData['daily_digest'];
    return { titles: [...a.titles, ...b.titles] } as NotificationData[T];
  }
  return next;
}
