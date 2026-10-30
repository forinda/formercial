// Your render drivers and voice providers. The built-ins (chromium-ffmpeg and
// edge-tts) are always there; anything listed here is added next to them, for
// the app and for `kick cxc`.
import { defineConfig } from './core/render/registry'

export default defineConfig({
  drivers: [],
  voices: [],
})
