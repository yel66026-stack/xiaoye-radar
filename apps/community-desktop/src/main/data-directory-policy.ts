import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

export const COMMUNITY_APP_NAME = 'Xiaoye Radar Community' as const

export function resolveCommunityUserDataPath(options: {
  appDataPath: string
  isPackaged: boolean
  override?: string
}): string {
  const communityDefault = join(options.appDataPath, COMMUNITY_APP_NAME)
  const override = options.override?.trim()

  // Packaged releases always use the Community-owned directory. The override is
  // intentionally limited to unpackaged development and automated test processes.
  return !options.isPackaged && override ? resolve(override) : communityDefault
}

function firstRelativeSegment(root: string, target: string): string | null {
  const path = relative(resolve(root), resolve(target))
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) return null
  return path.split(sep)[0] ?? null
}

export function resolveCapturePath(options: {
  isPackaged: boolean
  requestedPath?: string
  tempPath: string
  userDataRealPath: string
}): string | null {
  const requested = options.requestedPath?.trim()
  if (!requested) return null
  const target = resolve(requested)
  if (!options.isPackaged) return target

  const captureRoot = firstRelativeSegment(options.tempPath, target)
  const dataRoot = firstRelativeSegment(options.tempPath, options.userDataRealPath)
  if (
    !captureRoot ||
    captureRoot !== dataRoot ||
    !captureRoot.startsWith('xiaoye-community-portable-smoke-') ||
    extname(target).toLocaleLowerCase() !== '.png'
  ) {
    return null
  }
  return target
}
