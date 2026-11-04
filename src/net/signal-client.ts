import { addBreadcrumb } from '../telemetry';
import type {
  BeatReply,
  JoinReply,
  ListedRoom,
  LobbiesReply,
  Mail,
  MemberInfo,
  MembersReply,
  PollReply,
  RoomListing,
  Signal,
  SignalErrorCode,
  SignalOp,
  SignalReply,
} from './signal-protocol';

/**
 * Browser side of the signaling API. The only place that knows where the API
 * lives: same origin by default, so a Next-hosted page needs no configuration.
 * A build served from anywhere else (a packaged app) calls `setSignalBase` with
 * the hosted origin before booting; docs/NETCODE.md lists what else that takes.
 */
let signalBase = '';

export function setSignalBase(url: string) {
  signalBase = url.replace(/\/+$/, '');
}

export function signalUrl(op: SignalOp): string {
  return `${signalBase}/api/net/${op}`;
}

/** `network` means the request never got an answer; everything else is the API's own code. */
export class SignalError extends Error {
  /** `network`: no answer. `forgotten`: the store has no session of ours (it lapsed); rejoin before anything else. */
  constructor(readonly code: SignalErrorCode | 'network' | 'forgotten') {
    super(code);
  }
}

/** What the transport needs from the API; tests swap in a direct call to the handlers. */
export interface SignalApi {
  /** `since` stamps the session (see `sessionStamp`), so the store can tell two sessions of this peer apart. */
  join(since: number): Promise<JoinReply>;
  /** A host's beat may put the room on the lobby list (`list`), or take it off (`false`). */
  beat(host: boolean, list?: RoomListing | false): Promise<BeatReply>;
  members(): Promise<MemberInfo[]>;
  /** Report `peer` (the session with this `order`) dead, and get the room back. */
  gone(peer: string, order: number): Promise<MemberInfo[]>;
  /** False if `to` isn't in the room any more; throws `forgotten` if we aren't. */
  send(to: string, s: Signal): Promise<boolean>;
  poll(): Promise<Mail[]>;
  /** Fire and forget; must survive the page unloading. `unlist`: a host that listed the room takes it off the list. */
  leave(order: number, since: number, unlist?: boolean): void;
}

/** The `signal` reply as `send` reports it: a store that forgot us is our problem, not the target's. */
export function deliveredOrThrow(r: SignalReply): boolean {
  if (r.gone === 'self') throw new SignalError('forgotten');
  return r.delivered;
}

let lastStamp = 0;

/** When a session started, in ms, strictly increasing within the page: two sessions of one peer never share one. */
export function sessionStamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

export class HttpSignal implements SignalApi {
  constructor(
    private room: string,
    private peer: string,
  ) {}

  /** The last failure put in the trail, so a poll failing every few seconds adds one breadcrumb, not dozens. */
  private failing = '';

  /** A failed call, in the trail once per run of the same failure. The 503 `store-failed` is the store, not us. */
  private note(op: SignalOp, code: string, status = 0) {
    const key = `${op}:${code}`;
    if (key === this.failing) return;
    this.failing = key;
    addBreadcrumb('signal', `${op} failed`, { code, status });
  }

  private async call<T>(op: SignalOp, extra: Record<string, unknown> = {}): Promise<T> {
    let res: Response;
    try {
      // text/plain keeps this a CORS "simple request": no preflight, so no extra function invocation, on any origin.
      res = await fetch(signalUrl(op), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ room: this.room, peer: this.peer, ...extra }),
      });
    } catch {
      this.note(op, 'network');
      throw new SignalError('network');
    }
    const body = (await res.json().catch(() => ({}))) as { error?: SignalErrorCode };
    if (!res.ok) {
      this.note(op, body.error ?? 'network', res.status);
      throw new SignalError(body.error ?? 'network');
    }
    this.failing = '';
    return body as T;
  }

  join = (since: number) => this.call<JoinReply>('join', { since });
  beat = (host: boolean, list?: RoomListing | false) => this.call<BeatReply>('beat', list === undefined ? { host } : { host, list });
  members = () => this.call<MembersReply>('members').then((r) => r.members);
  gone = (peer: string, order: number) => this.call<MembersReply>('gone', { gone: peer, order }).then((r) => r.members);
  send = (to: string, signal: Signal) => this.call<SignalReply>('signal', { to, signal }).then(deliveredOrThrow);
  poll = () => this.call<PollReply>('poll').then((r) => r.mail);

  leave(order: number, since: number, unlist = false) {
    const body = JSON.stringify(unlist ? { room: this.room, peer: this.peer, order, since, unlist } : { room: this.room, peer: this.peer, order, since });
    // sendBeacon with a string posts text/plain, and outlives the page.
    if (typeof navigator !== 'undefined' && navigator.sendBeacon?.(signalUrl('leave'), body)) return;
    void fetch(signalUrl('leave'), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true }).catch(() => {});
  }
}

/** The public lobby list, for the Lobbies screen. Throws SignalError, like the room calls. */
export async function fetchLobbies(signal?: AbortSignal): Promise<ListedRoom[]> {
  let res: Response;
  try {
    res = await fetch(signalUrl('lobbies'), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}', signal });
  } catch {
    throw new SignalError('network');
  }
  const body = (await res.json().catch(() => ({}))) as Partial<LobbiesReply> & { error?: SignalErrorCode };
  if (!res.ok) throw new SignalError(body.error ?? 'network');
  return body.rooms ?? [];
}
