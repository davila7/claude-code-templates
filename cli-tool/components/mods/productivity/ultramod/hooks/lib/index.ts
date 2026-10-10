// Public API of the ultramod detection library.
export { splitCommand, tokens, normalize, baseName, commandTokens } from './shell'
export {
  classifyCommand,
  type RiskHit,
  type RiskKind,
  type ClassifyOptions,
} from './risk'
export {
  isSecretPath,
  bashReadsSecret,
  isEnvDump,
  redactSecrets,
  type RedactionResult,
} from './secrets'
export { isTestPath, addedMarkers, assertionDrop, bashDeletesTests } from './testguard'
export { commandKind, claimsIn, type CommandKind, type Claims } from './claims'
export { isDocFile, isAllowedDocPath } from './tidy'
