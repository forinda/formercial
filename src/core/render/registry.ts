// Render drivers and voice providers by name: the built-ins plus whatever
// src/cxc.config.ts adds.
import { edgeTts } from '../voice/edge-tts'
import type { Check, VoiceProvider } from '../voice/provider'
import { chromiumFfmpeg } from './chromium-ffmpeg'
import type { RenderDriver } from './driver'

export type CxcConfig = { drivers?: RenderDriver[]; voices?: VoiceProvider[] }
export type Registry = { drivers: Map<string, RenderDriver>; voices: Map<string, VoiceProvider> }

export const defineConfig = (config: CxcConfig): CxcConfig => config

function byName<T extends { name: string }>(kind: string, items: T[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of items) {
    if (map.has(item.name)) throw new Error(`two ${kind} are named "${item.name}"`)
    map.set(item.name, item)
  }
  return map
}

export function createRegistry(config: CxcConfig): Registry {
  return {
    drivers: byName('render drivers', [chromiumFfmpeg, ...(config.drivers ?? [])]),
    voices: byName('voice providers', [edgeTts, ...(config.voices ?? [])]),
  }
}

export async function driverReport(reg: Registry): Promise<{ name: string; check: Check }[]> {
  return Promise.all(
    [...reg.drivers.values()].map(async (d) => ({ name: d.name, check: await d.check() })),
  )
}
