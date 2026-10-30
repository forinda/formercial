import { describe, expect, test } from 'vitest'
import { startEncoder } from './encoder'

describe('startEncoder', () => {
  test('a write fails, instead of waiting forever, when the encoder dies', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (e: unknown) => unhandled.push(e)
    process.on('unhandledRejection', onUnhandled)
    try {
      // Exits at once without reading: writes back up and never drain.
      const enc = startEncoder('node', ['-e', 'process.exit(3)'])
      const big = Buffer.alloc(4 * 1024 * 1024)
      await expect(
        (async () => {
          for (let i = 0; i < 50; i++) await enc.write(big)
        })(),
      ).rejects.toThrow(/exited 3|EPIPE|write/)
      enc.kill()
      await new Promise((r) => setTimeout(r, 50))
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  test('end resolves when the encoder finishes cleanly', async () => {
    const enc = startEncoder('node', [
      '-e',
      'process.stdin.resume(); process.stdin.on("end", () => process.exit(0))',
    ])
    await enc.write(Buffer.from('frame'))
    await expect(enc.end()).resolves.toBeUndefined()
  })
})
