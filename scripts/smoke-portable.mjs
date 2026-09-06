import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'

/** @typedef {import('node:child_process').ChildProcessWithoutNullStreams} ChildProcessWithoutNullStreams */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** @param {unknown} value @returns {Record<string, unknown>} */
function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
}

const packageVersionValue = asRecord(
  JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')),
).version
if (typeof packageVersionValue !== 'string') throw new Error('package.json has no valid version')
const packageVersion = packageVersionValue
const executable = join(
  root,
  'release',
  'community',
  `Xiaoye-Radar-Community-${packageVersion}-portable-x64.exe`,
)

if (!existsSync(executable)) throw new Error(`Portable executable not found: ${executable}`)

const smokeRoot = mkdtempSync(join(tmpdir(), 'xiaoye-community-portable-smoke-'))
const appDataRoot = process.env.APPDATA
if (!appDataRoot) throw new Error('APPDATA is unavailable; portable smoke requires Windows')
const defaultDataRoot = join(appDataRoot, 'Xiaoye Radar Community')
const dataRoot = join(smokeRoot, 'user-data')
const ignoredOverrideRoot = join(smokeRoot, 'packaged-override-must-not-be-used')
const firstScreenshot = join(smokeRoot, 'dashboard-first-run.png')
const reopenedScreenshot = join(smokeRoot, 'dashboard-reopened.png')
mkdirSync(dataRoot, { recursive: true })

/**
 * @param {string | null} screenshot
 * @param {boolean} autoDemo
 * @returns {NodeJS.ProcessEnv}
 */
function portableEnvironment(screenshot, autoDemo) {
  return {
    ...process.env,
    ELECTRON_RENDERER_URL: 'https://renderer-override.invalid',
    XIAOYE_RADAR_COMMUNITY_DATA_DIR: ignoredOverrideRoot,
    XIAOYE_RADAR_AUTO_DEMO: autoDemo ? '1' : '0',
    ...(screenshot ? { XIAOYE_RADAR_CAPTURE_PATH: screenshot } : {}),
  }
}

/**
 * @param {ChildProcessWithoutNullStreams} child
 * @param {number} timeoutMilliseconds
 * @param {string} label
 * @returns {Promise<void>}
 */
function waitForExit(child, timeoutMilliseconds, label) {
  return new Promise((resolveRun, reject) => {
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk).slice(0, 8_000)
    })
    const timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${String(timeoutMilliseconds)} milliseconds`))
    }, timeoutMilliseconds)
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      if (code === 0) resolveRun()
      else reject(new Error(`Portable executable exited with code ${String(code)}: ${stderr}`))
    })
  })
}

/**
 * @param {string | null} [screenshot]
 * @param {boolean} [autoDemo]
 * @returns {ChildProcessWithoutNullStreams}
 */
function spawnPortable(screenshot = null, autoDemo = false) {
  const child = /** @type {ChildProcessWithoutNullStreams} */ (
    spawn(executable, [], {
      env: portableEnvironment(screenshot, autoDemo),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  )
  child.stdout.resume()
  return child
}

/**
 * @param {string} screenshot
 * @param {boolean} autoDemo
 */
async function runPortable(screenshot, autoDemo) {
  const child = spawnPortable(screenshot, autoDemo)
  await waitForExit(child, 90_000, 'Portable smoke run')
}

async function verifySingleInstance() {
  const primary = spawnPortable()
  let primaryError = ''
  let primaryExited = false
  const primaryExit = new Promise((resolveExit) => {
    primary.once('exit', () => {
      primaryExited = true
      resolveExit()
    })
  })
  primary.stderr.on('data', (chunk) => {
    primaryError += String(chunk).slice(0, 8_000)
  })

  try {
    await new Promise((resolveWait) => setTimeout(resolveWait, 2_500))
    if (primaryExited) {
      throw new Error(`Primary portable instance exited early: ${primaryError}`)
    }

    const secondary = spawnPortable()
    await waitForExit(secondary, 20_000, 'Second portable instance')
    if (primaryExited) {
      throw new Error('Launching a second instance terminated the primary instance')
    }
  } finally {
    if (!primaryExited && primary.pid) {
      spawnSync('taskkill.exe', ['/PID', String(primary.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      await Promise.race([
        primaryExit,
        new Promise((resolveWait) => setTimeout(resolveWait, 10_000)),
      ])
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500))
  }
}

let dataJunctionCreated = false

function cleanupSmoke() {
  if (dataJunctionCreated && existsSync(defaultDataRoot)) {
    if (!lstatSync(defaultDataRoot).isSymbolicLink()) {
      throw new Error('Portable smoke will not remove an unexpected Community data directory')
    }
    unlinkSync(defaultDataRoot)
  }
  rmSync(smokeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}

try {
  if (existsSync(defaultDataRoot)) {
    throw new Error(
      'Portable smoke requires a clean test account and will not touch existing Community user data',
    )
  }
  symlinkSync(dataRoot, defaultDataRoot, 'junction')
  dataJunctionCreated = true
  await runPortable(firstScreenshot, true)
  const ignoredWorkspace = join(ignoredOverrideRoot, 'community-workspace', 'workspace.json')
  if (existsSync(ignoredWorkspace)) {
    throw new Error('Packaged app accepted XIAOYE_RADAR_COMMUNITY_DATA_DIR')
  }
  const workspacePath = join(dataRoot, 'community-workspace', 'workspace.json')
  if (!existsSync(workspacePath)) throw new Error('Portable app did not create its workspace')
  if (!existsSync(firstScreenshot) || statSync(firstScreenshot).size === 0) {
    throw new Error('Portable app did not render a screenshot')
  }
  const firstWorkspace = asRecord(JSON.parse(readFileSync(workspacePath, 'utf8')))
  const firstRuns = Array.isArray(firstWorkspace.runs) ? firstWorkspace.runs : []
  const firstLatest = asRecord(firstRuns[0])
  const firstRunStats = {
    total: 80,
    candidates: 45,
    duplicates: 5,
    excluded: 10,
    timeFiltered: 10,
    ruleFiltered: 10,
  }
  if (JSON.stringify(firstLatest.stats) !== JSON.stringify(firstRunStats)) {
    throw new Error('Portable Demo workflow returned unexpected statistics')
  }
  if (!Array.isArray(firstWorkspace.candidates) || firstWorkspace.candidates.length !== 45) {
    throw new Error('Portable Demo workflow did not persist 45 candidates')
  }

  await runPortable(reopenedScreenshot, true)
  if (!existsSync(reopenedScreenshot) || statSync(reopenedScreenshot).size === 0) {
    throw new Error('Reopened portable app did not render a screenshot')
  }
  const reopenedWorkspace = asRecord(JSON.parse(readFileSync(workspacePath, 'utf8')))
  const reopenedRuns = Array.isArray(reopenedWorkspace.runs) ? reopenedWorkspace.runs : []
  const reopenedLatest = asRecord(reopenedRuns[0])
  const reopenedStats = {
    total: 80,
    candidates: 0,
    duplicates: 50,
    excluded: 10,
    timeFiltered: 10,
    ruleFiltered: 10,
  }
  if (JSON.stringify(reopenedLatest.stats) !== JSON.stringify(reopenedStats)) {
    throw new Error('Reopened portable app did not reuse persisted candidate fingerprints')
  }
  if (!Array.isArray(reopenedWorkspace.candidates) || reopenedWorkspace.candidates.length !== 45) {
    throw new Error('Reopened portable app did not preserve the candidate queue')
  }
  if (reopenedRuns.length !== 2) {
    throw new Error('Reopened portable app did not preserve and append scan history')
  }

  await verifySingleInstance()
  const sha256 = createHash('sha256').update(readFileSync(executable)).digest('hex')
  console.log(
    JSON.stringify({
      artifact: executable,
      sha256,
      screenshotBytes: {
        firstRun: statSync(firstScreenshot).size,
        reopened: statSync(reopenedScreenshot).size,
      },
      firstRun: firstRunStats,
      reopened: reopenedStats,
      persistedCandidates: 45,
      persistedRuns: 2,
      singleInstance: true,
    }),
  )
} finally {
  cleanupSmoke()
}
