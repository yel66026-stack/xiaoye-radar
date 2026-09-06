export function isAllowedRendererUrl(value: string, developmentUrl?: string): boolean {
  try {
    const url = new URL(value)
    if (developmentUrl) return url.origin === new URL(developmentUrl).origin
    return url.protocol === 'file:' && url.pathname.endsWith('/out/renderer/index.html')
  } catch {
    return false
  }
}

export function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !url.username &&
      !url.password &&
      ['https:', 'http:'].includes(url.protocol)
    )
  } catch {
    return false
  }
}
