import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { extname, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const scanHistory = process.argv.includes('--history')
const binaryExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.exe',
  '.dll',
  '.node',
  '.zip',
])
const ignored = /(^|[\\/])(node_modules|out|release|coverage|\.git)([\\/]|$)/u

const checks = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/gu],
  [
    'github-token',
    /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/gu,
  ],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/gu],
  ['openai-key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/gu],
  ['credential-url', /https?:\/\/[^\s/:]+:[^\s/@]+@[^\s/]+/gu],
  [
    'assigned-secret',
    /(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_./+=-]{20,}["']/giu,
  ],
]

function failOperationally(message) {
  console.error(`Secret scan failed: ${message}`)
  process.exit(2)
}

let listed
try {
  listed = execFileSync('git', ['-C', root, 'ls-files', '-co', '--exclude-standard'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
} catch {
  failOperationally('unable to enumerate repository files with Git')
}

const files = [...new Set(listed.split(/\r?\n/u).filter(Boolean))]
  .map((path) => resolve(root, path))
  .filter((path) => !ignored.test(path))
  .filter((path) => !binaryExtensions.has(extname(path).toLocaleLowerCase()))
  .filter(
    (path) =>
      !path.endsWith('scripts\\check-secrets.mjs') && !path.endsWith('scripts/check-secrets.mjs'),
  )

const findings = []
for (const file of files) {
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch {
    continue
  }
  if (text.includes('\0')) continue
  for (const [name, pattern] of checks) {
    pattern.lastIndex = 0
    const count = [...text.matchAll(pattern)].length
    if (count > 0) findings.push({ file: relative(root, file), name, count })
  }
}

if (scanHistory) {
  try {
    const history = execFileSync(
      'git',
      ['-C', root, 'log', '--all', '-p', '--', '.', ':(exclude)scripts/check-secrets.mjs'],
      {
        encoding: 'utf8',
        maxBuffer: 100 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )
    for (const [name, pattern] of checks) {
      pattern.lastIndex = 0
      const count = [...history.matchAll(pattern)].length
      if (count > 0) findings.push({ file: 'Git history', name, count })
    }
  } catch {
    failOperationally('unable to inspect the complete Git history')
  }
}

if (findings.length > 0) {
  console.error('Potential secrets found (values intentionally redacted):')
  for (const finding of findings)
    console.error(`- ${finding.file}: ${finding.name} (${finding.count})`)
  process.exit(1)
}

console.log(
  `Secret scan passed across ${files.length} text files${scanHistory ? ' and all Git revisions' : ''}.`,
)
