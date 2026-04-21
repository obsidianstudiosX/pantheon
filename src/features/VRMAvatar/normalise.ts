/**
 * Normaliser for the `vrm` manifest field.
 *
 * Mirrors the Python helper that will live at
 *   control-plane/src/pantheon_control/projection.py::normalise_vrm_binding
 * once the home-repo schema change lands (plan Task 1).
 *
 * Accepts the three shapes declared by the schema `oneOf` and returns a
 * single camelCase object (or null). Unknown properties on the object form
 * are silently dropped — JSON Schema allows additional properties for
 * forward-compat extensions (spec §4), but the TS type surface stays narrow.
 */

import type { VRMBinding, VRMBindingRaw, VRMBindingRawObject } from './types';

function isObjectForm(raw: VRMBindingRaw): raw is VRMBindingRawObject {
  return typeof raw === 'object' && raw !== null && typeof raw.url === 'string';
}

export function normaliseVrmBinding(raw: VRMBindingRaw): VRMBinding | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return { url: trimmed };
  }

  if (isObjectForm(raw)) {
    const out: VRMBinding = { url: raw.url };
    if (raw.pose_idle) out.poseIdle = raw.pose_idle;
    if (raw.voice_tts) out.voiceTts = raw.voice_tts;
    if (raw.stage) out.stage = raw.stage;
    if (typeof raw.scale === 'number') out.scale = raw.scale;
    if (typeof raw.offset_y === 'number') out.offsetY = raw.offset_y;
    if (raw.expires_at) out.expiresAt = raw.expires_at;
    return out;
  }

  return null;
}
