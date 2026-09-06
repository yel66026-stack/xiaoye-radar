import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COMMUNITY_APP_NAME,
  resolveCapturePath,
  resolveCommunityUserDataPath,
} from '../../apps/community-desktop/src/main/data-directory-policy'

describe('Community data directory policy', () => {
  const appDataPath = resolve('test-app-data')
  const override = resolve('isolated-community-test-data')

  it('allows an override for unpackaged development', () => {
    expect(resolveCommunityUserDataPath({ appDataPath, isPackaged: false, override })).toBe(
      override,
    )
  })

  it('allows an override for an unpackaged automated test', () => {
    expect(
      resolveCommunityUserDataPath({
        appDataPath,
        isPackaged: false,
        override: `  ${override}  `,
      }),
    ).toBe(override)
  })

  it('ignores the override in a packaged release', () => {
    expect(
      resolveCommunityUserDataPath({
        appDataPath,
        isPackaged: true,
        override: resolve('Xiaoye Radar Pro'),
      }),
    ).toBe(join(appDataPath, COMMUNITY_APP_NAME))
  })

  it('always gives packaged Community its own named default directory', () => {
    const result = resolveCommunityUserDataPath({ appDataPath, isPackaged: true })

    expect(result).toBe(join(appDataPath, 'Xiaoye Radar Community'))
    expect(result).not.toBe(appDataPath)
  })
})

describe('packaged capture-path policy', () => {
  const tempPath = resolve('test-temp')
  const smokeRoot = join(tempPath, 'xiaoye-community-portable-smoke-123')

  it('allows an unpackaged test capture path', () => {
    const target = resolve('development-captures', 'screen.png')
    expect(
      resolveCapturePath({
        isPackaged: false,
        requestedPath: target,
        tempPath,
        userDataRealPath: resolve('development-data'),
      }),
    ).toBe(target)
  })

  it('allows a packaged smoke PNG only beside its disposable user data', () => {
    const target = join(smokeRoot, 'dashboard.png')
    expect(
      resolveCapturePath({
        isPackaged: true,
        requestedPath: target,
        tempPath,
        userDataRealPath: join(smokeRoot, 'user-data'),
      }),
    ).toBe(target)
  })

  it('rejects arbitrary or mismatched packaged capture paths', () => {
    expect(
      resolveCapturePath({
        isPackaged: true,
        requestedPath: resolve('outside-temp', 'overwrite.png'),
        tempPath,
        userDataRealPath: join(smokeRoot, 'user-data'),
      }),
    ).toBeNull()
    expect(
      resolveCapturePath({
        isPackaged: true,
        requestedPath: join(tempPath, 'xiaoye-community-portable-smoke-other', 'screen.png'),
        tempPath,
        userDataRealPath: join(smokeRoot, 'user-data'),
      }),
    ).toBeNull()
    expect(
      resolveCapturePath({
        isPackaged: true,
        requestedPath: join(smokeRoot, 'not-an-image.txt'),
        tempPath,
        userDataRealPath: join(smokeRoot, 'user-data'),
      }),
    ).toBeNull()
  })
})
