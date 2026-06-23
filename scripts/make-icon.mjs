// Generates build/icon.icns from an inline SVG using @resvg/resvg-js + iconutil.
import { Resvg } from '@resvg/resvg-js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const buildDir = path.join(root, 'build');
const iconset = path.join(buildDir, 'icon.iconset');

// A warm "paper + ink" tile with the classic Markdown mark in white.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e89069"/>
      <stop offset="1" stop-color="#c4582f"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" rx="228" ry="228" fill="url(#bg)"/>
  <rect x="0" y="0" width="1024" height="512" rx="228" ry="228" fill="url(#sheen)"/>
  <g transform="translate(232,340) scale(2.6923)" fill="none" stroke="#ffffff" stroke-width="14" stroke-linejoin="round">
    <rect x="5" y="5" width="198" height="118" rx="14" ry="14"/>
    <path d="M30 98 V30 h20 l20 25 l20 -25 h20 v68 H90 V59 L70 84 L50 59 v39 z" fill="#ffffff" stroke="#ffffff" stroke-width="6"/>
    <path d="M170 30 v40 h22 l-32 33 -32 -33 h22 V30 z" fill="#ffffff" stroke="#ffffff" stroke-width="6"/>
  </g>
</svg>`;

const sizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];

fs.rmSync(iconset, { recursive: true, force: true });
fs.mkdirSync(iconset, { recursive: true });

function render(size) {
  const r = new Resvg(SVG, { fitTo: { mode: 'width', value: size } });
  return r.render().asPng();
}

for (const [name, size] of sizes) {
  fs.writeFileSync(path.join(iconset, name), render(size));
}
// Standalone PNG fallback.
fs.writeFileSync(path.join(buildDir, 'icon.png'), render(512));

execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(buildDir, 'icon.icns')]);
console.log('✓ build/icon.icns generated');
