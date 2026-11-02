import type { RoomConnection } from './client';

/**
 * Interim online-status badge (a tiny DOM overlay, bottom-left): connection
 * state, who's in the room with the host crown and pings, and a copy-invite
 * button. It exists so online play is usable before the HUD draws this
 * itself from `NetHudInfo` (see docs/NETCODE.md → HUD); delete it then.
 */
export function mountNetBadge(container: HTMLElement, conn: RoomConnection): void {
  const el = document.createElement('div');
  el.className = 'slag-net';
  el.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:5;font:10px/1.3 ui-monospace,Menlo,monospace;color:#cfc8b8;background:rgba(10,8,14,.72);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:5px 8px;max-width:38ch;opacity:.9;pointer-events:auto;user-select:none';
  const line = document.createElement('div');
  const list = document.createElement('div');
  list.style.cssText = 'opacity:.85;white-space:pre';
  const btn = document.createElement('button');
  btn.textContent = 'copy invite link';
  btn.style.cssText = 'margin-top:4px;font:inherit;color:#111;background:#e8c46a;border:0;border-radius:4px;padding:2px 7px;cursor:pointer';
  btn.onclick = async (e) => {
    e.stopPropagation();
    const ok = await conn.copyInvite();
    btn.textContent = ok ? 'copied!' : 'copy invite link';
    setTimeout(() => (btn.textContent = 'copy invite link'), 1500);
  };
  btn.onpointerdown = (e) => e.stopPropagation();
  el.append(line, list, btn);
  container.append(el);

  const dot = { online: '#6c6', connecting: '#cc6', reconnecting: '#e94', offline: '#888', unavailable: '#e55' } as const;
  const render = () => {
    const h = conn.hud;
    const peers = h.peers();
    const state = h.status === 'online' ? (h.transport === 'broadcast' ? 'local tabs' : 'online') : h.status;
    line.innerHTML = '';
    const d = document.createElement('span');
    d.textContent = '● ';
    d.style.color = dot[h.status];
    line.append(d, `${state} · ${peers.length} here${h.isHost ? ' · you host' : ''}`);
    if (h.notice) line.append(document.createElement('br'), h.notice);
    list.textContent = peers
      .map((p) => `${p.isHost ? '♛' : ' '} ${p.name}${p.isSelf ? ' (you)' : ''}${p.ping !== null && !p.isHost ? ` ${Math.round(p.ping)}ms` : ''}${p.quality === 'bad' ? ' ⚠' : ''}`)
      .join('\n');
    list.style.display = peers.length > 1 ? '' : 'none';
  };
  render();
  setInterval(render, 500);
}
