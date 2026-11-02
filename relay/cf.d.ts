/**
 * Minimal ambient types for the Cloudflare Workers APIs relay/worker.ts uses,
 * so `npm run check` can type-check the relay without pulling in
 * @cloudflare/workers-types. Wrangler bundles the real runtime modules.
 */
declare module 'cloudflare:workers' {
  export abstract class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState;
    protected env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }
}

interface CfWebSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

interface DurableObjectState {
  acceptWebSocket(ws: CfWebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): CfWebSocket[];
  setWebSocketAutoResponse(pair: WebSocketRequestResponsePair): void;
}

interface DurableObjectStub {
  fetch(req: Request): Promise<Response>;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

declare class WebSocketPair {
  0: CfWebSocket;
  1: CfWebSocket;
}

declare class WebSocketRequestResponsePair {
  constructor(request: string, response: string);
}
