import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type CommunityDesktopApi } from '../shared/contracts'

const api: CommunityDesktopApi = {
  getBootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.bootstrap),
  importDemo: () => ipcRenderer.invoke(IPC_CHANNELS.importDemo),
  importLegalInquiryExample: () => ipcRenderer.invoke(IPC_CHANNELS.importLegalInquiryExample),
  importSource: () => ipcRenderer.invoke(IPC_CHANNELS.importSource),
  saveRule: (document) => ipcRenderer.invoke(IPC_CHANNELS.saveRule, { document }),
  runMonitoring: (sourceRecordId, ruleId) =>
    ipcRenderer.invoke(IPC_CHANNELS.runMonitoring, { sourceRecordId, ruleId }),
  updateReview: (candidateId, status, note) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateReview, { candidateId, status, note }),
  exportCandidates: (format, ruleId) =>
    ipcRenderer.invoke(IPC_CHANNELS.exportCandidates, { format, ruleId }),
  openDataFolder: () => ipcRenderer.invoke(IPC_CHANNELS.openDataFolder),
  openCandidateUrl: (candidateId) =>
    ipcRenderer.invoke(IPC_CHANNELS.openCandidateUrl, { candidateId }),
  openXiaohongshu: () => ipcRenderer.invoke(IPC_CHANNELS.openXiaohongshu),
  createMonitor: (request) => ipcRenderer.invoke(IPC_CHANNELS.createMonitor, request),
  updateJob: (jobId, enabled, intervalMinutes) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateJob, { jobId, enabled, intervalMinutes }),
  runJob: (jobId) => ipcRenderer.invoke(IPC_CHANNELS.runJob, { jobId }),
}

contextBridge.exposeInMainWorld('xiaoyeCommunity', Object.freeze(api))
