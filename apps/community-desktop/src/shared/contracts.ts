import type { ReviewStatus } from '@xiaoye-radar/core'
import type { WorkspaceState } from '@xiaoye-radar/storage'

export const IPC_CHANNELS = {
  bootstrap: 'community:bootstrap',
  importDemo: 'community:import-demo',
  importLegalInquiryExample: 'community:import-legal-inquiry-example',
  importSource: 'community:import-source',
  saveRule: 'community:save-rule',
  runMonitoring: 'community:run-monitoring',
  updateReview: 'community:update-review',
  exportCandidates: 'community:export-candidates',
  openDataFolder: 'community:open-data-folder',
  openCandidateUrl: 'community:open-candidate-url',
} as const

export interface BootstrapResponse {
  appName: 'Xiaoye Radar Community'
  appVersion: string
  dataPath: string
  telemetryEnabled: false
  automaticUpdatesEnabled: false
  state: WorkspaceState
}

export interface ActionResponse {
  ok: true
  message: string
  state: WorkspaceState
}

export interface CommunityDesktopApi {
  getBootstrap(): Promise<BootstrapResponse>
  importDemo(): Promise<ActionResponse>
  importLegalInquiryExample(): Promise<ActionResponse>
  importSource(): Promise<ActionResponse | null>
  saveRule(document: string): Promise<ActionResponse>
  runMonitoring(sourceRecordId: string, ruleId: string): Promise<ActionResponse>
  updateReview(candidateId: string, status: ReviewStatus, note: string): Promise<ActionResponse>
  exportCandidates(format: 'csv' | 'json'): Promise<{ ok: true; path: string } | null>
  openDataFolder(): Promise<{ ok: true }>
  openCandidateUrl(candidateId: string): Promise<{ ok: true }>
}
