import type { UltraAllow } from '../../types/index'

// Value helpers for the shared allowlist state. Atoms live in each consuming
// file, where the validator can read them; these keep one array update from
// replacing the other.

export const addAllowedRisk = (allow: UltraAllow, id: string): UltraAllow =>
  allow.risks.includes(id) ? allow : { risks: [...allow.risks, id], paths: allow.paths }

export const addAllowedPath = (allow: UltraAllow, path: string): UltraAllow =>
  allow.paths.includes(path) ? allow : { risks: allow.risks, paths: [...allow.paths, path] }
