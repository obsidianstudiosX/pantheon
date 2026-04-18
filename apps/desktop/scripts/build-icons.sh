#!/usr/bin/env bash
# Generate Pantheon Electron icons from public/icon.svg.
#
# This shell driver complements build-icons.mjs for producing .ico / .icns on
# hosts where the JS path can't (e.g. macOS-only iconutil for .icns, or CI
# boxes without png-to-ico). Run from the repo root or anywhere — it resolves
# paths relative to the script.
#
# Requirements (install whichever apply):
#   - Node + sharp (root node_modules)         → PNG sizes
#   - ImageMagick `convert` OR `png-to-ico`    → Windows icon.ico
#   - macOS `iconutil` OR `png2icns`           → macOS icon.icns
#
# Output: apps/desktop/build/icons/{icon.png, icon.ico, icon.icns, icon-*.png}

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DESKTOP_DIR}/../.." && pwd)"
OUT_DIR="${DESKTOP_DIR}/build/icons"
SVG_SRC="${REPO_ROOT}/public/icon.svg"

mkdir -p "${OUT_DIR}"

echo "🎨 Generating PNG sizes from ${SVG_SRC} via sharp…"
cd "${REPO_ROOT}"
node "${DESKTOP_DIR}/scripts/build-icons.mjs"

# -- Windows .ico -----------------------------------------------------------
if [[ ! -f "${OUT_DIR}/icon.ico" ]]; then
  if command -v convert >/dev/null 2>&1; then
    echo "🪟 Building icon.ico with ImageMagick…"
    convert \
      "${OUT_DIR}/icon-16.png" \
      "${OUT_DIR}/icon-24.png" \
      "${OUT_DIR}/icon-32.png" \
      "${OUT_DIR}/icon-48.png" \
      "${OUT_DIR}/icon-64.png" \
      "${OUT_DIR}/icon-128.png" \
      "${OUT_DIR}/icon-256.png" \
      "${OUT_DIR}/icon.ico"
    echo "✅ ${OUT_DIR}/icon.ico"
  else
    echo "⚠️  Skipping icon.ico — install ImageMagick (convert) or png-to-ico."
  fi
fi

# -- macOS .icns ------------------------------------------------------------
if [[ "$(uname)" == "Darwin" ]] && command -v iconutil >/dev/null 2>&1; then
  echo "🍎 Building icon.icns with iconutil…"
  ICONSET="${OUT_DIR}/icon.iconset"
  mkdir -p "${ICONSET}"
  # iconutil expects specific names.
  sips -z 16 16     "${OUT_DIR}/icon.png" --out "${ICONSET}/icon_16x16.png"
  sips -z 32 32     "${OUT_DIR}/icon.png" --out "${ICONSET}/icon_16x16@2x.png"
  sips -z 32 32     "${OUT_DIR}/icon.png" --out "${ICONSET}/icon_32x32.png"
  sips -z 64 64     "${OUT_DIR}/icon.png" --out "${ICONSET}/icon_32x32@2x.png"
  sips -z 128 128   "${OUT_DIR}/icon.png" --out "${ICONSET}/icon_128x128.png"
  sips -z 256 256   "${OUT_DIR}/icon.png" --out "${ICONSET}/icon_128x128@2x.png"
  sips -z 256 256   "${OUT_DIR}/icon.png" --out "${ICONSET}/icon_256x256.png"
  sips -z 512 512   "${OUT_DIR}/icon.png" --out "${ICONSET}/icon_256x256@2x.png"
  sips -z 512 512   "${OUT_DIR}/icon.png" --out "${ICONSET}/icon_512x512.png"
  cp "${OUT_DIR}/icon.png" "${ICONSET}/icon_512x512@2x.png"
  iconutil -c icns "${ICONSET}" -o "${OUT_DIR}/icon.icns"
  rm -rf "${ICONSET}"
  echo "✅ ${OUT_DIR}/icon.icns"
elif command -v png2icns >/dev/null 2>&1; then
  echo "🍎 Building icon.icns with png2icns…"
  png2icns "${OUT_DIR}/icon.icns" \
    "${OUT_DIR}/icon-256.png" \
    "${OUT_DIR}/icon-128.png" \
    "${OUT_DIR}/icon-64.png" \
    "${OUT_DIR}/icon-32.png" \
    "${OUT_DIR}/icon-16.png" \
    "${OUT_DIR}/icon.png"
  echo "✅ ${OUT_DIR}/icon.icns"
else
  echo "⚠️  Skipping icon.icns — requires macOS iconutil or libicns (png2icns)."
fi

echo ""
echo "Done. Artifacts in ${OUT_DIR}:"
ls -1 "${OUT_DIR}"
