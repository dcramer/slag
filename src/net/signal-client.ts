import type { BeatReply, JoinReply, Mail, MemberInfo, MembersReply, PollReply, Signal, SignalErrorCode, SignalOp } from './signal-protocol';

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
  constructor(readonly code: SignalErrorCode | 'network') {
    super(code);
  }
}

/** What the transport needs from the API; tests swap in a direct call to the handlers. */
export interface SignalApi {
  join(): Promise<JoinReply>;
  beat(host: boolean): Promise<BeatReply>;
  members(): Promise<MemberInfo[]>;
  /** Report `peer` (the session with this `order`) dead, and get the room back. */
  gone(peer: string, order: number): Promise<MemberInfo[]>;
  /** False if `to` isn't in the room any more. */
  send(to: string, s: Signal): Promise<boolean>;
  poll(): Promise<Mail[]>;
  /** Fire and forget; must survive the page unloading. */
  leave(order: number): void;
}

export class HttpSignal implements SignalApi {
  constructor(
    private room: string,
    private peer: string,
  ) {}

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
      throw new SignalError('network');
    }
    const body = (await res.json().catch(() => ({}))) as { error?: SignalErrorCode };
    if (!res.ok) throw new SignalError(body.error ?? 'network');
    return body as T;
  }

  join = () => this.call<JoinReply>('join');
  beat = (host: boolean) => this.call<BeatReply>('beat', { host });
  members = () => this.call<MembersReply>('members').then((r) => r.members);
  gone = (peer: string, order: number) => this.call<MembersReply>('gone', { gone: peer, order }).then((r) => r.members);
  send = (to: string, signal: Signal) => this.call<{ delivered: boolean }>('signal', { to, signal }).then((r) => r.delivered);
  poll = () => this.call<PollReply>('poll').then((r) => r.mail);

  leave(order: number) {
    const body = JSON.stringify({ room: this.room, peer: this.peer, order });
    // sendBeacon with a string posts text/plain, and outlives the page.
    if (typeof navigator !== 'undefined' && navigator.sendBeacon?.(signalUrl('leave'), body)) return;
    void fetch(signalUrl('leave'), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true }).catch(() => {});
  }
}
