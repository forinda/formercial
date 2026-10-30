// An ffmpeg process fed frames on stdin. If it dies, the next write fails at
// once instead of waiting for a drain that will never come, and no rejection
// is ever left unhandled.
import { spawn } from 'node:child_process'
import { runInBackground } from '@/core/media'

export interface Encoder {
  write(frame: Buffer): Promise<void>
  /** Close stdin and wait for a clean exit. */
  end(): Promise<void>
  kill(): void
}

export function startEncoder(cmd: string, args: string[]): Encoder {
  const child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'pipe'] })
  runInBackground(child)
  let log = ''
  child.stderr.on('data', (d) => (log += d))
  let failure: Error | undefined
  const fail = (err: Error) => (failure ??= err)
  // EPIPE and friends once the process is gone: recorded, never thrown.
  child.stdin.on('error', (err) => fail(err))
  const exited = new Promise<void>((resolve, reject) => {
    child.on('error', (err) => reject(fail(err)))
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(fail(new Error(`${cmd} exited ${code}: ${log.trim().slice(-300)}`))),
    )
  })
  exited.catch(() => {})

  return {
    async write(frame) {
      if (failure) throw failure
      if (child.stdin.write(frame)) return
      // Wait for room, or for the process to end; whichever comes first.
      await Promise.race([
        new Promise<void>((r) => child.stdin.once('drain', r)),
        exited.then(() => {
          throw new Error(`${cmd} stopped reading frames`)
        }),
      ])
      if (failure) throw failure
    },
    end() {
      child.stdin.end()
      return exited
    },
    kill() {
      // ffmpeg waiting for a frame doesn't act on the signal until stdin closes.
      child.stdin.destroy()
      child.kill()
    },
  }
}
