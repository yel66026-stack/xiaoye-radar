/// <reference types="vite/client" />

import type { CommunityDesktopApi } from '../shared/contracts'

declare global {
  interface Window {
    xiaoyeCommunity: CommunityDesktopApi
  }
}

export {}
