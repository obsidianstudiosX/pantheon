#!/usr/bin/env node
/**
 * Generates Pantheon app icons from public/icon.svg (gold gradient).
 *
 * - build/icons/icon.png (512x512, Linux)
 * - build/icons/icon-{16,24,32,48,64,128,256}.png (intermediate, for .ico)
 * - (If png-to-ico available) build/icons/icon.ico (Windows, multi-size)
 *
 * For .icns (macOS), run apps/desktop/scripts/build-icons.sh on a macOS host
 * (requires `iconutil`) or install `png2icns` cross-platform.
 *
 * Usage: node apps/desktop/scripts/build-icons.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const svgSrc = path.resolve(repoRoot, 'public', 'icon.svg');
const outDir = path.resolve(__dirname, '..', 'build', 'icons');

const WINDOWS_SIZES = [16, 24, 32, 48, 64, 128, 256];
const LINUX_SIZE = 512;

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const svgBuffer = await fs.readFile(svgSrc);

  // Linux: single 512x512 PNG
  await sharp(svgBuffer).resize(LINUX_SIZE, LINUX_SIZE).png().toFile(path.join(outDir, 'icon.png'));
  console.info(`✅ icon.png (${LINUX_SIZE}x${LINUX_SIZE})`);

  // Windows .ico component PNGs
  for (const size of WINDOWS_SIZES) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon-${size}.png`));
    console.info(`✅ icon-${size}.png`);
  }

  // Attempt .ico generation if png-to-ico is installed. Soft-fail if not.
  try {
    const pngToIcoMod = await import('png-to-ico');
    const pngToIco = pngToIcoMod.default ?? pngToIcoMod;
    const pngBuffers = await Promise.all(
      WINDOWS_SIZES.map((s) => fs.readFile(path.join(outDir, `icon-${s}.png`))),
    );
    const icoBuffer = await pngToIco(pngBuffers);
    await fs.writeFile(path.join(outDir, 'icon.ico'), icoBuffer);
    console.info(`✅ icon.ico (multi-size Windows)`);
  } catch (err) {
    console.warn(
      `⚠️  Skipping icon.ico — png-to-ico not installed. Run ` +
        `apps/desktop/scripts/build-icons.sh on a host with ImageMagick (convert) ` +
        `or install \`pnpm add -D -w png-to-ico\` and re-run this script.`,
    );
    console.warn(`    Reason: ${err instanceof Error ? err.message : String(err)}`);
  }

  // .icns requires macOS tooling (iconutil) or png2icns; defer to shell script.
  console.info(
    `ℹ️  icon.icns (macOS) not generated here — run build-icons.sh on macOS ` +
      `or on a Linux host with \`png2icns\`.`,
  );
}

main().catch((err) => {
  console.error('build-icons failed:', err);
  process.exit(1);
});
