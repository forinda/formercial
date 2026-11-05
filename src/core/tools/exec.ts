// Run a program for a tool: arguments as a list, never through a shell, so a
// file name can't turn into a command; killed when the job runs out of time.
import { spawn } from 'node:child_process'
import { runInBackground } from '@/core/media/media'

export function exec(
  cmd: string,
  args: string[],
  opts: { cwd?: string; signal?: AbortSignal; env?: Record<string, string> } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new Error('stopped'))
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...opts.env },
    })
    runInBackground(child)
    let out = ''
    let err = ''
    const stop = () => child.kill('SIGKILL')
    opts.signal?.addEventListener('abort', stop, { once: true })
    child.stdout.on('data', (d) => (out = (out + d).slice(-20_000)))
    child.stderr.on('data', (d) => (err = (err + d).slice(-20_000)))
    child.on('error', (e) => reject(e))
    child.on('close', (code) => {
      opts.signal?.removeEventListener('abort', stop)
      if (opts.signal?.aborted) return reject(new Error('it took too long, so it was stopped'))
      if (code === 0) resolve(out)
      else reject(new Error(`${cmd} failed: ${err.trim().slice(-400) || `exit ${code}`}`))
    })
  })
}
