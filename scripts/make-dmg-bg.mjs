// Generates the DMG window background (build/background.png + @2x) via resvg.
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(__dirname, '..', 'build');

const W = 620;
const H = 430;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#faf9f5"/>
      <stop offset="1" stop-color="#efe9dd"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="${W / 2}" y="78" text-anchor="middle" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="#2b2926">Inkdown</text>
  <text x="${W / 2}" y="108" text-anchor="middle" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="14" fill="#8a847a">Trascina l'icona nella cartella Applicazioni per installare</text>
  <g stroke="#c8613a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.85">
    <path d="M 255 200 H 367" stroke-dasharray="2 9"/>
    <path d="M 355 188 l 16 12 l -16 12"/>
  </g>
  <text x="${W / 2}" y="300" text-anchor="middle" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="12.5" fill="#a8a194">Dopo l'installazione, leggi il file "Leggimi" qui sotto</text>
</svg>`;

function render(scale) {
  const r = new Resvg(SVG, { fitTo: { mode: 'width', value: W * scale } });
  return r.render().asPng();
}

fs.mkdirSync(buildDir, { recursive: true });
fs.writeFileSync(path.join(buildDir, 'background.png'), render(1));
fs.writeFileSync(path.join(buildDir, 'background@2x.png'), render(2));
console.log('✓ build/background.png (+@2x) generated');
