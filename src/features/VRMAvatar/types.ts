/**
 * Normalised runtime types for VRM avatar bindings.
 *
 * Mirrors the design spec §1-§2:
 *   docs/superpowers/specs/2026-04-22-vrm-avatars-design.md
 *
 * The manifest field `vrm` may be:
 *   - null (no binding)
 *   - a bare string (legacy URL/handle form)
 *   - an object with a `url` + optional pose/voice/stage fields
 *
 * All consumers should accept `VRMBindingRaw` at the boundary (fetch response,
 * projection artefact) and use `normaliseVrmBinding` to collapse to
 * `VRMBinding | null`.
 */

export interface VRMBinding {
  /** ISO-8601 expiry for a signed URL, if applicable. */
  expiresAt?: string;
  /** Optional vertical offset inside the scene. */
  offsetY?: number;
  /** Idle animation preset name. Defaults to `idle-01` at render time. */
  poseIdle?: string;
  /** Optional model scale multiplier. */
  scale?: number;
  /** Matrix room alias whose stage background should render behind the avatar. */
  stage?: string;
  /** Resolvable URL or logical handle (e.g. `/branding/vrm/<slug>.vrm`). */
  url: string;
  /** Bound @lobehub/tts voice, once wired. */
  voiceTts?: { provider: string; voice: string };
}

/**
 * Shape of the raw `vrm` field on the agent manifest / resolver response.
 *
 * The object form is described in design spec §2 (JSON schema snippet).
 * Property names on the wire use snake_case to match the YAML manifest; the
 * normaliser converts to camelCase for UI consumption.
 */
export interface VRMBindingRawObject {
  expires_at?: string;
  offset_y?: number;
  pose_idle?: string;
  scale?: number;
  stage?: string;
  url: string;
  voice_tts?: { provider: string; voice: string };
}

export type VRMBindingRaw = string | VRMBindingRawObject | null | undefined;

/**
 * Result of the resolver API. `url` may be either a signed MinIO URL or the
 * static `/branding/vrm/<slug>.vrm` path when `NEXT_PUBLIC_VRM_RESOLVER=static`.
 */
export interface VRMResolveResponse {
  expiresAt?: string;
  offsetY?: number;
  poseIdle?: string;
  scale?: number;
  stage?: string;
  url: string;
  voiceTts?: { provider: string; voice: string };
}
