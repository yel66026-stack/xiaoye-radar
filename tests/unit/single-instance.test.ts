import { describe, expect, it, vi } from 'vitest'
import { installSingleInstanceProtection } from '../../apps/community-desktop/src/main/single-instance'

describe('single-instance protection', () => {
  it('quits before startup when another instance owns the lock', () => {
    const quit = vi.fn()
    const onSecondInstance = vi.fn()

    expect(
      installSingleInstanceProtection({
        requestLock: () => false,
        quit,
        onSecondInstance,
        getWindow: () => null,
      }),
    ).toBe(false)
    expect(quit).toHaveBeenCalledOnce()
    expect(onSecondInstance).not.toHaveBeenCalled()
  })

  it('restores and focuses the existing window for a second launch', () => {
    let secondInstanceHandler: (() => void) | undefined
    const window = {
      isMinimized: () => true,
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    }

    expect(
      installSingleInstanceProtection({
        requestLock: () => true,
        quit: vi.fn(),
        onSecondInstance: (handler) => {
          secondInstanceHandler = handler
        },
        getWindow: () => window,
      }),
    ).toBe(true)
    secondInstanceHandler?.()
    expect(window.restore).toHaveBeenCalledOnce()
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
  })
})
