#!/usr/bin/env node
/**
 * Generate Pantheon-branded Electron icons from a procedurally-drawn
 * source mark. Writes PNGs at all required sizes plus .ico / .icns
 * bundles into apps/desktop/build/.
 *
 * Invoke from the repo root: `node scripts/gen-electron-icons.mjs`.
 *
 * Design: a minimalist "P" glyph in cream on a dark slate background
 * with a subtle temple-column accent stripe. All sizes are rasterized
 * from the same 1024px SVG so edges stay crisp.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import png2icons from 'png2icons';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = resolve(__dirname, '..', 'apps', 'desktop', 'build');
const iconsSubdir = join(buildDir, 'icons');
mkdirSync(iconsSubdir, { recursive: true });

const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d2333"/>
      <stop offset="1" stop-color="#0f1420"/>
    </linearGradient>
    <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f5ead0"/>
      <stop offset="1" stop-color="#d8c69a"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" rx="180" fill="url(#bg)"/>
  <g opacity="0.22" fill="#f5ead0">
    <rect x="210" y="230" width="22" height="600"/>
    <rect x="792" y="230" width="22" height="600"/>
  </g>
  <path fill="url(#fg)" d="
    M 310 230
    L 310 830
    L 410 830
    L 410 620
    L 560 620
    C 700 620 790 532 790 425
    C 790 318 700 230 560 230
    Z
    M 410 320
    L 556 320
    C 636 320 688 366 688 425
    C 688 484 636 530 556 530
    L 410 530
    Z
  "/>
</svg>`;

const master = Buffer.from(svg);

async function run() {
  const rasterByHW = {};
  for (const size of SIZES) {
    const out = join(iconsSubdir, `icon-${size}.png`);
    const buf = await sharp(master).resize(size, size).png().toBuffer();
    writeFileSync(out, buf);
    rasterByHW[size] = buf;
    console.log(`  wrote ${out}`);
  }

  writeFileSync(join(buildDir, 'icon.png'), rasterByHW[1024]);
  console.log(`  wrote ${join(buildDir, 'icon.png')}`);

  const icoInput = [
    rasterByHW[16], rasterByHW[24], rasterByHW[32],
    rasterByHW[48], rasterByHW[64], rasterByHW[128],
    rasterByHW[256],
  ];
  const icoBuf = png2icons.createICO(rasterByHW[256], png2icons.BILINEAR, 0, false, true);
  if (!icoBuf) throw new Error('ICO generation returned null');
  writeFileSync(join(buildDir, 'icon.ico'), icoBuf);
  console.log(`  wrote ${join(buildDir, 'icon.ico')}`);

  const icnsBuf = png2icons.createICNS(rasterByHW[1024], png2icons.BILINEAR, 0);
  if (!icnsBuf) throw new Error('ICNS generation returned null');
  writeFileSync(join(buildDir, 'icon.icns'), icnsBuf);
  console.log(`  wrote ${join(buildDir, 'icon.icns')}`);

  for (const variant of ['dev', 'beta', 'nightly']) {
    writeFileSync(join(buildDir, `icon-${variant}.png`), rasterByHW[1024]);
    writeFileSync(join(buildDir, `icon-${variant}.ico`), icoBuf);
  }
  console.log('  wrote variant copies (dev/beta/nightly .png/.ico)');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
