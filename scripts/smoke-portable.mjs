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
const requestedExecutable = process.env.XIAOYE_RADAR_PORTABLE_PATH?.trim()
const executable = requestedExecutable
  ? resolve(requestedExecutable)
  : join(root, 'release', 'community', `Xiaoye-Radar-Community-${packageVersion}-portable-x64.exe`)

if (!existsSync(executable)) throw new Error(`Portable executable not found: ${executable}`)

const smokeRoot = mkdtempSync(join(tmpdir(), 'xiaoye-community-portable-smoke-'))
const appDataRoot = process.env.APPDATA
if (!appDataRoot) throw new Error('APPDATA is unavailable; portable smoke requires Windows')
const defaultDataRoot = join(appDataRoot, 'Xiaoye Radar Community')
const dataRoot = join(smokeRoot, 'user-data')
const ignoredOverrideRoot = join(smokeRoot, 'packaged-override-must-not-be-used')
const firstScreenshot = join(smokeRoot, 'dashboard-first-run.png')
const legalScreenshot = join(smokeRoot, 'dashboard-legal-example.png')
const reopenedScreenshot = join(smokeRoot, 'dashboard-reopened.png')
mkdirSync(dataRoot, { recursive: true })

/**
 * @param {string | null} screenshot
 * @param {'none' | 'demo' | 'legal'} workflow
 * @param {boolean} autoReview
 * @returns {NodeJS.ProcessEnv}
 */
function portableEnvironment(screenshot, workflow, autoReview) {
  return {
    ...process.env,
    ELECTRON_RENDERER_URL: 'https://renderer-override.invalid',
    XIAOYE_RADAR_COMMUNITY_DATA_DIR: ignoredOverrideRoot,
    XIAOYE_RADAR_AUTO_DEMO: workflow === 'demo' ? '1' : '0',
    XIAOYE_RADAR_AUTO_LEGAL_EXAMPLE: workflow === 'legal' ? '1' : '0',
    XIAOYE_RADAR_AUTO_REVIEW: autoReview ? '1' : '0',
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
 * @param {'none' | 'demo' | 'legal'} [workflow]
 * @param {boolean} [autoReview]
 * @returns {ChildProcessWithoutNullStreams}
 */
function spawnPortable(screenshot = null, workflow = 'none', autoReview = false) {
  const child = /** @type {ChildProcessWithoutNullStreams} */ (
    spawn(executable, [], {
      env: portableEnvironment(screenshot, workflow, autoReview),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  )
  child.stdout.resume()
  return child
}

/**
 * @param {string} screenshot
 * @param {'none' | 'demo' | 'legal'} workflow
 * @param {boolean} [autoReview]
 */
async function runPortable(screenshot, workflow, autoReview = false) {
  const child = spawnPortable(screenshot, workflow, autoReview)
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
  await runPortable(firstScreenshot, 'demo')
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

  await runPortable(legalScreenshot, 'legal', true)
  if (!existsSync(legalScreenshot) || statSync(legalScreenshot).size === 0) {
    throw new Error('Portable Legal Inquiry Triage workflow did not render a screenshot')
  }
  const legalWorkspace = asRecord(JSON.parse(readFileSync(workspacePath, 'utf8')))
  const legalRuns = Array.isArray(legalWorkspace.runs) ? legalWorkspace.runs : []
  const legalLatest = asRecord(legalRuns[0])
  const legalRunStats = {
    total: 100,
    candidates: 51,
    duplicates: 5,
    excluded: 18,
    timeFiltered: 10,
    ruleFiltered: 16,
  }
  if (JSON.stringify(legalLatest.stats) !== JSON.stringify(legalRunStats)) {
    throw new Error('Portable Legal Inquiry Triage workflow returned unexpected statistics')
  }
  const legalCandidates = Array.isArray(legalWorkspace.candidates)
    ? legalWorkspace.candidates
        .map(asRecord)
        .filter(({ ruleId }) => ruleId === 'legal-inquiry-basic')
    : []
  if (legalCandidates.length !== 51) {
    throw new Error('Portable Legal Inquiry Triage workflow did not persist 51 candidates')
  }
  const approvedLegalCandidates = legalCandidates.filter(
    ({ reviewStatus }) => reviewStatus === 'approved',
  )
  if (
    approvedLegalCandidates.length !== 1 ||
    approvedLegalCandidates[0]?.reviewNote !== 'Automated portable smoke verification'
  ) {
    throw new Error('Portable Legal Inquiry Triage review did not persist')
  }
  if (legalRuns.length !== 2) {
    throw new Error('Portable Legal Inquiry Triage workflow did not append scan history')
  }

  await runPortable(reopenedScreenshot, 'legal')
  if (!existsSync(reopenedScreenshot) || statSync(reopenedScreenshot).size === 0) {
    throw new Error('Reopened portable app did not render a screenshot')
  }
  const reopenedWorkspace = asRecord(JSON.parse(readFileSync(workspacePath, 'utf8')))
  const reopenedRuns = Array.isArray(reopenedWorkspace.runs) ? reopenedWorkspace.runs : []
  const reopenedLatest = asRecord(reopenedRuns[0])
  const reopenedStats = {
    total: 100,
    candidates: 0,
    duplicates: 56,
    excluded: 18,
    timeFiltered: 10,
    ruleFiltered: 16,
  }
  if (JSON.stringify(reopenedLatest.stats) !== JSON.stringify(reopenedStats)) {
    throw new Error('Reopened portable app did not reuse persisted candidate fingerprints')
  }
  if (!Array.isArray(reopenedWorkspace.candidates) || reopenedWorkspace.candidates.length !== 96) {
    throw new Error('Reopened portable app did not preserve the candidate queue')
  }
  if (
    reopenedWorkspace.candidates
      .map(asRecord)
      .filter(
        ({ ruleId, reviewStatus }) =>
          ruleId === 'legal-inquiry-basic' && reviewStatus === 'approved',
      ).length !== 1
  ) {
    throw new Error('Reopened portable app did not preserve the human-review decision')
  }
  if (reopenedRuns.length !== 3) {
    throw new Error('Reopened portable app did not preserve and append scan history')
  }

  await verifySingleInstance()
  const sha256 = createHash('sha256').update(readFileSync(executable)).digest('hex')
  console.log(
    JSON.stringify({
      artifact: executable,
      sha256,
      screenshotBytes: {
        demo: statSync(firstScreenshot).size,
        legal: statSync(legalScreenshot).size,
        reopened: statSync(reopenedScreenshot).size,
      },
      demo: firstRunStats,
      legal: legalRunStats,
      legalReopened: reopenedStats,
      persistedCandidates: 96,
      approvedLegalCandidates: 1,
      persistedRuns: 3,
      singleInstance: true,
    }),
  )
} finally {
  cleanupSmoke()
}
