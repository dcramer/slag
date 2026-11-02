import type { AtlasOut } from './render';

/**
 * A contact sheet of an atlas for looking at: one row per clip and facing, every frame standing on a
 * common floor line at `zoom` times its size, on the game's light paper with a grey ground line.
 */
export async function contact(atlas: AtlasOut, zoom: number, smooth: boolean, facings: ('r' | 'l')[] = ['r']): Promise<string> {
  const img = new Image();
  img.src = atlas.png;
  await img.decode();
  const rows: { label: string; frames: AtlasOut['clips'][string]['r'] }[] = [];
  for (const [name, f] of Object.entries(atlas.clips)) for (const side of facings) rows.push({ label: `${name} ${side}`, frames: f[side] });
  const cellW = Math.ceil(40 * atlas.scale * zoom * 0.62);
  const cellH = Math.ceil(36 * atlas.scale * zoom * 0.95);
  const labelW = 110;
  const cols = Math.max(...rows.map((r) => r.frames.length));
  const c = document.createElement('canvas');
  c.width = labelW + cols * cellW;
  c.height = rows.length * cellH;
  const g = c.getContext('2d')!;
  g.fillStyle = '#efe6d2';
  g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = smooth;
  rows.forEach((r, i) => {
    const floor = i * cellH + cellH * 0.86;
    g.fillStyle = '#2a1c15';
    g.font = '600 14px sans-serif';
    g.fillText(r.label, 8, floor - cellH * 0.4);
    g.fillStyle = '#c8bba0';
    g.fillRect(labelW, floor, cols * cellW, 2);
    r.frames.forEach((f, j) => {
      const cx = labelW + j * cellW + cellW / 2;
      g.drawImage(img, f.x, f.y, f.w, f.h, cx - f.ax * zoom, floor - f.ay * zoom, f.w * zoom, f.h * zoom);
    });
  });
  return c.toDataURL('image/png');
}
