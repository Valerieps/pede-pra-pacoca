// What the UI needs from the outside world. src/infrastructure/ implements it; the UI receives it
// through ServicesProvider and never makes network calls itself.
import type { ApiResult, CommandName, Commands, PushSubscriptionInput, QueryName, Queries, Topic } from './api-contract';

export interface Backend {
  query<N extends QueryName>(name: N, input: Queries[N]['input']): Promise<ApiResult<Queries[N]['output']>>;
  command<N extends CommandName>(name: N, input: Commands[N]['input']): Promise<ApiResult<Commands[N]['output']>>;
  signOut(): Promise<void>;
  /** The test sign-in without Google; the server accepts it only on localhost (ADR-009). */
  devSignIn(email: string, name: string): Promise<ApiResult<null>>;
  /** The address the browser navigates to for "Entrar com Google". */
  readonly signInUrl: string;
}

export type LiveStatus = 'connecting' | 'online' | 'offline';

export interface LiveUpdates {
  /** Calls `onChange` with the topics that changed; also with every topic after a reconnect. */
  subscribe(onChange: (topics: readonly Topic[]) => void): () => void;
  onStatus(listener: (status: LiveStatus) => void): () => void;
  start(): void;
  stop(): void;
}

/**
 * - unsupported: this browser has no Web Push
 * - needs-install: iPhone or iPad outside the home screen (push needs the installed app)
 * - prompt: the browser will ask; denied / granted: the member already answered
 */
export type PushState = 'unsupported' | 'needs-install' | 'prompt' | 'denied' | 'granted';

/** This phone's side of push notifications (service worker and Push API). */
export interface PushDevice {
  state(): PushState;
  /** iPhone or iPad, installed or not: the permission screen explains the home screen. */
  readonly isIos: boolean;
  /** Asks for permission (call it from a tap) and subscribes; null if refused or impossible. */
  subscribe(publicKey: string): Promise<PushSubscriptionInput | null>;
  /**
   * This phone's subscription, made again if the server's key changed; null without permission
   * or when the member turned push off here. The app sends it on every start, so the server
   * always has the live one.
   */
  current(publicKey: string): Promise<PushSubscriptionInput | null>;
  isSubscribed(): Promise<boolean>;
  /** Unsubscribes this phone; returns the endpoint it had, so the server forgets it too. */
  unsubscribe(): Promise<string | null>;
  /** The service worker asks the open app to show a screen after a notification tap. */
  onNavigate(listener: (path: string) => void): () => void;
}
