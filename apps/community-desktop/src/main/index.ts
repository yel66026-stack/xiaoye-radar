import { mkdirSync, realpathSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { candidatesToCsv, candidatesToJson } from '@xiaoye-radar/export'
import { reviewStatusSchema } from '@xiaoye-radar/core'
import { JsonFileStorage } from '@xiaoye-radar/storage'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell,
  type IpcMainInvokeEvent,
} from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS, type BootstrapResponse } from '../shared/contracts'
import { CommunityService } from './community-service'
import {
  COMMUNITY_APP_NAME,
  resolveCapturePath,
  resolveCommunityUserDataPath,
} from './data-directory-policy'
import { isAllowedExternalUrl, isAllowedRendererUrl } from './url-policy'
import { installSingleInstanceProtection } from './single-instance'

const APP_ID = 'com.xiaoye.radar.community'
const developmentUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL
let mainWindow: BrowserWindow | null = null
let service: CommunityService | null = null

app.setName(COMMUNITY_APP_NAME)
const communityUserDataPath = resolveCommunityUserDataPath({
  appDataPath: app.getPath('appData'),
  isPackaged: app.isPackaged,
  override: process.env.XIAOYE_RADAR_COMMUNITY_DATA_DIR,
})
mkdirSync(communityUserDataPath, { recursive: true, mode: 0o700 })
app.setPath('userData', communityUserDataPath)
const capturePath = resolveCapturePath({
  isPackaged: app.isPackaged,
  requestedPath: process.env.XIAOYE_RADAR_CAPTURE_PATH,
  tempPath: app.getPath('temp'),
  userDataRealPath: realpathSync(communityUserDataPath),
})
const ownsSingleInstanceLock = installSingleInstanceProtection({
  requestLock: () => app.requestSingleInstanceLock(),
  quit: () => app.quit(),
  onSecondInstance: (handler) => app.on('second-instance', handler),
  getWindow: () => mainWindow,
})

function examplesPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'examples')
    : join(app.getAppPath(), 'examples')
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url
  if (!senderUrl || !isAllowedRendererUrl(senderUrl, developmentUrl)) {
    throw new Error('IPC request rejected: untrusted sender')
  }
}

function currentService(): CommunityService {
  if (!service) throw new Error('Community service is not initialized')
  return service
}

async function bootstrap(): Promise<BootstrapResponse> {
  const active = currentService()
  return {
    appName: COMMUNITY_APP_NAME,
    appVersion: app.getVersion(),
    dataPath: active.dataPath,
    telemetryEnabled: false,
    automaticUpdatesEnabled: false,
    state: await active.state(),
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.bootstrap, async (event) => {
    assertTrustedSender(event)
    return bootstrap()
  })
  ipcMain.handle(IPC_CHANNELS.importDemo, async (event) => {
    assertTrustedSender(event)
    await currentService().importDemo()
    return { ok: true, message: 'Demo imported and scanned', state: await currentService().state() }
  })
  ipcMain.handle(IPC_CHANNELS.importSource, async (event) => {
    assertTrustedSender(event)
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        {
          name: 'Supported sources',
          extensions: ['csv', 'json', 'rss', 'xml', 'atom', 'md', 'txt'],
        },
      ],
    })
    const path = result.filePaths[0]
    if (result.canceled || !path) return null
    await currentService().importFile(path)
    return { ok: true, message: 'Source imported', state: await currentService().state() }
  })
  ipcMain.handle(IPC_CHANNELS.saveRule, async (event, request: unknown) => {
    assertTrustedSender(event)
    const { document } = z
      .object({ document: z.string().min(1).max(100_000) })
      .strict()
      .parse(request)
    await currentService().saveRule(document)
    return { ok: true, message: 'Rule saved', state: await currentService().state() }
  })
  ipcMain.handle(IPC_CHANNELS.runMonitoring, async (event, request: unknown) => {
    assertTrustedSender(event)
    const input = z
      .object({ sourceRecordId: z.string().min(1), ruleId: z.string().min(1) })
      .strict()
      .parse(request)
    await currentService().run(input.sourceRecordId, input.ruleId)
    return { ok: true, message: 'Monitoring run complete', state: await currentService().state() }
  })
  ipcMain.handle(IPC_CHANNELS.updateReview, async (event, request: unknown) => {
    assertTrustedSender(event)
    const input = z
      .object({
        candidateId: z.string().min(1),
        status: reviewStatusSchema,
        note: z.string().max(2000),
      })
      .strict()
      .parse(request)
    await currentService().review(input.candidateId, input.status, input.note)
    return { ok: true, message: 'Review updated', state: await currentService().state() }
  })
  ipcMain.handle(IPC_CHANNELS.exportCandidates, async (event, request: unknown) => {
    assertTrustedSender(event)
    const { format } = z
      .object({ format: z.enum(['csv', 'json']) })
      .strict()
      .parse(request)
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `xiaoye-radar-candidates.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    })
    if (result.canceled || !result.filePath) return null
    const candidates = (await currentService().state()).candidates
    await writeFile(
      result.filePath,
      format === 'csv' ? candidatesToCsv(candidates) : candidatesToJson(candidates),
      'utf8',
    )
    return { ok: true, path: result.filePath }
  })
  ipcMain.handle(IPC_CHANNELS.openDataFolder, async (event) => {
    assertTrustedSender(event)
    const error = await shell.openPath(currentService().dataPath)
    if (error) throw new Error('Could not open the Community data directory')
    return { ok: true }
  })
  ipcMain.handle(IPC_CHANNELS.openCandidateUrl, async (event, request: unknown) => {
    assertTrustedSender(event)
    const { candidateId } = z
      .object({ candidateId: z.string().min(1) })
      .strict()
      .parse(request)
    const candidate = (await currentService().state()).candidates.find(
      ({ id }) => id === candidateId,
    )
    const url = candidate?.item.url
    if (!url || !isAllowedExternalUrl(url))
      throw new Error('Candidate URL is not an allowed web URL')
    await shell.openExternal(url)
    return { ok: true }
  })
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 820,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    title: COMMUNITY_APP_NAME,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedRendererUrl(targetUrl, developmentUrl)) event.preventDefault()
  })
  window.once('ready-to-show', () => {
    window.show()
    window.focus()
  })
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })
  if (developmentUrl) void window.loadURL(developmentUrl)
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  return window
}

async function captureIfRequested(window: BrowserWindow, target: string | null): Promise<void> {
  if (!target) return
  await new Promise<void>((resolveDone) => setTimeout(resolveDone, 800))
  const image = await window.webContents.capturePage()
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, image.toPNG())
  app.quit()
}

async function start(): Promise<void> {
  app.setAppUserModelId(APP_ID)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  )
  const storage = new JsonFileStorage(join(app.getPath('userData'), 'community-workspace'))
  service = new CommunityService(storage, examplesPath())
  await service.initialize()
  if (process.env.XIAOYE_RADAR_AUTO_DEMO === '1' && (!app.isPackaged || capturePath)) {
    await service.importDemo()
  }
  registerIpc()
  mainWindow = createWindow()
  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow) void captureIfRequested(mainWindow, capturePath)
  })
}

if (ownsSingleInstanceLock) {
  void app
    .whenReady()
    .then(start)
    .catch((error: unknown) => {
      console.error(
        'Xiaoye Radar Community failed to start',
        error instanceof Error ? error.message : 'Unknown error',
      )
      app.exit(1)
    })

  app.on('activate', () => {
    if (!mainWindow) mainWindow = createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
