export interface FocusableWindow {
  isMinimized(): boolean
  restore(): void
  show(): void
  focus(): void
}

export function installSingleInstanceProtection(options: {
  requestLock: () => boolean
  quit: () => void
  onSecondInstance: (handler: () => void) => void
  getWindow: () => FocusableWindow | null
}): boolean {
  if (!options.requestLock()) {
    options.quit()
    return false
  }

  options.onSecondInstance(() => {
    const window = options.getWindow()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })
  return true
}
