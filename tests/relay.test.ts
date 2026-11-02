import { describe, expect, it } from 'vitest';
import { RelayRoom } from '../relay/room';
import { CLOSE_REPLACED } from '../src/net/relay-protocol';

/** Fake sockets: record what the room sends/closes. */
function setup() {
  const sent = new Map<string, any[]>();
  const closed = new Map<string, number>();
  const room = new RelayRoom<string>({
    send: (c, t) => sent.set(c, [...(sent.get(c) ?? []), JSON.parse(t)]),
    close: (c, code) => closed.set(c, code),
  });
  const last = (c: string) => sent.get(c)?.at(-1);
  return { room, sent, closed, last };
}

describe('relay room', () => {
  it('assigns join order, announces presence and fans out messages', () => {
    const { room, sent, last } = setup();
    room.open('s1', 'alice');
    room.open('s2', 'bob1');
    expect(sent.get('s1')![0]).toEqual({ t: 'welcome', self: { id: 'alice', order: 0 }, members: [{ id: 'alice', order: 0 }] });
    expect(last('s1')).toEqual({ t: 'join', m: { id: 'bob1', order: 1 } });
    expect(last('s2').t).toBe('welcome');
    expect(last('s2').members.map((m: any) => m.id)).toEqual(['alice', 'bob1']);
    room.message('s1', JSON.stringify({ d: { hi: 1 } }));
    expect(last('s2')).toEqual({ t: 'msg', from: 'alice', d: { hi: 1 } });
    room.open('s3', 'carl');
    room.message('s3', JSON.stringify({ d: 'x', to: 'alice' }));
    expect(last('s1')).toEqual({ t: 'msg', from: 'carl', d: 'x' });
    expect(last('s2')).toEqual({ t: 'join', m: { id: 'carl', order: 2 } });
    room.message('s2', JSON.stringify({ ping: 5 }));
    expect(last('s2')).toEqual({ t: 'pong', ts: 5 });
  });

  it('a reconnect with the same peer id replaces the old socket and joins later in order', () => {
    const { room, closed, last } = setup();
    room.open('s1', 'alice');
    room.open('s2', 'bob1');
    room.open('s3', 'alice');
    expect(closed.get('s1')).toBe(CLOSE_REPLACED);
    expect(room.members()).toEqual([
      { id: 'bob1', order: 1 },
      { id: 'alice', order: 2 },
    ]);
    expect(last('s2')).toEqual({ t: 'join', m: { id: 'alice', order: 2 } });
  });

  it('leave is broadcast; an empty room restarts the order so the next arrival hosts', () => {
    const { room, last } = setup();
    room.open('s1', 'alice');
    room.open('s2', 'bob1');
    room.close('s1');
    expect(last('s2')).toEqual({ t: 'leave', id: 'alice' });
    room.close('s2');
    expect(room.size).toBe(0);
    room.open('s4', 'dave');
    expect(room.members()).toEqual([{ id: 'dave', order: 0 }]);
  });

  it('rejects bad peer ids and survives garbage', () => {
    const { room, closed } = setup();
    expect(room.open('s1', 'no')).toBe(false);
    expect(closed.has('s1')).toBe(true);
    room.open('s2', 'okay');
    room.message('s2', 'not json');
    room.message('s9', '{}');
    expect(room.size).toBe(1);
  });
});
