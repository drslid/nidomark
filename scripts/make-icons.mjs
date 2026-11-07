// Renders the extension icon (bookmark ribbon on a teal tile, amber sparkle) to PNG without dependencies.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEAL = [15, 118, 110];
const WHITE = [255, 255, 255];
const AMBER = [245, 158, 11];

function inPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// Geometry in a 0..1 square.
const RIBBON = [[0.31, 0.2], [0.69, 0.2], [0.69, 0.82], [0.5, 0.66], [0.31, 0.82]];
const star = (cx, cy, r) => [[cx, cy - r], [cx + r * 0.28, cy - r * 0.28], [cx + r, cy], [cx + r * 0.28, cy + r * 0.28], [cx, cy + r], [cx - r * 0.28, cy + r * 0.28], [cx - r, cy], [cx - r * 0.28, cy - r * 0.28]];
const SPARKLE = star(0.79, 0.21, 0.13);

// Chrome Web Store: the 128px icon is 96px of artwork with 16px of transparent padding on each side.
const PADDING = { 128: 16 / 128 };

function pixel(x, y, size) {
  const pad = PADDING[size] ?? 0;
  const u = (x - pad) / (1 - 2 * pad);
  const v = (y - pad) / (1 - 2 * pad);
  if (!inRoundedRect(u, v, 0.02, 0.02, 0.98, 0.98, 0.2)) return null;
  if (size >= 48 && inPolygon(u, v, SPARKLE)) return AMBER;
  if (inPolygon(u, v, RIBBON)) return WHITE;
  return TEAL;
}

function render(size) {
  const ss = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = pixel((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size, size);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / (ss * ss)) * 255);
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = path.join(ROOT, 'public', 'icon');
fs.mkdirSync(out, { recursive: true });
for (const size of [16, 32, 48, 96, 128]) fs.writeFileSync(path.join(out, `${size}.png`), render(size));
fs.mkdirSync(path.join(ROOT, 'docs', 'assets'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'assets', 'icon-512.png'), render(512));
console.log('icons written');
