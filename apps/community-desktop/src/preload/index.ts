import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type CommunityDesktopApi } from '../shared/contracts'

const api: CommunityDesktopApi = {
  getBootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.bootstrap),
  importDemo: () => ipcRenderer.invoke(IPC_CHANNELS.importDemo),
  importSource: () => ipcRenderer.invoke(IPC_CHANNELS.importSource),
  saveRule: (document) => ipcRenderer.invoke(IPC_CHANNELS.saveRule, { document }),
  runMonitoring: (sourceRecordId, ruleId) =>
    ipcRenderer.invoke(IPC_CHANNELS.runMonitoring, { sourceRecordId, ruleId }),
  updateReview: (candidateId, status, note) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateReview, { candidateId, status, note }),
  exportCandidates: (format) => ipcRenderer.invoke(IPC_CHANNELS.exportCandidates, { format }),
  openDataFolder: () => ipcRenderer.invoke(IPC_CHANNELS.openDataFolder),
  openCandidateUrl: (candidateId) =>
    ipcRenderer.invoke(IPC_CHANNELS.openCandidateUrl, { candidateId }),
}

contextBridge.exposeInMainWorld('xiaoyeCommunity', Object.freeze(api))
