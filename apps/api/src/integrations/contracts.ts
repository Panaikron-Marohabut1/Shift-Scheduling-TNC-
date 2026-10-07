// Interfaces only. Company intake stays disabled pending approved contracts.
export interface CompanyIdentityProvider {
  resolveAuthenticatedIdentity(proof: unknown): Promise<{ externalSubject: string; provider: string }>;
}
export interface PowerAppsSource {
  previewApprovedPayload(payload: unknown): Promise<{ sourceId: string; diagnostics: string[] }>;
}
export const integrationReadiness = { companyIdentity: 'AWAITING_COMPANY_CONTRACT', powerApps: 'AWAITING_COMPANY_CONTRACT', realDataEnabled: false } as const;
