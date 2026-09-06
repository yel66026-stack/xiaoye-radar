import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('secret scanner operational failures', () => {
  it('fails closed when Git cannot enumerate the repository', () => {
    const environment = { ...process.env }
    for (const key of Object.keys(environment)) {
      if (key.toLocaleLowerCase() === 'path') delete environment[key]
    }
    environment.PATH = ''

    const result = spawnSync(
      process.execPath,
      [resolve('scripts/check-secrets.mjs'), '--history'],
      {
        encoding: 'utf8',
        env: environment,
      },
    )

    expect(result.status).toBe(2)
    expect(result.stderr).toContain(
      'Secret scan failed: unable to enumerate repository files with Git',
    )
    expect(result.stderr).not.toContain(process.cwd())
  })
})
