import type { PrivacyFinding } from './types'

export function findingsRequiringConfirmation(findings: PrivacyFinding[]) {
  return findings.filter(({ kind }) => kind === 'identity' || kind === 'bank_card')
}
