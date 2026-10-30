import { type ChildProcess, spawn } from 'node:child_process'
import { setPriority } from 'node:os'

/** A render takes minutes of work: the rest of the machine goes first. */
export function runInBackground(child: ChildProcess): void {
  try {
    if (child.pid) setPriority(child.pid, 10)
  } catch {
    // Already gone: its exit is reported where it's waited on.
  }
}

/** Run a tool to completion; reject with its stderr when it fails or is missing. */
export function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => reject(e))
    child.on('close', (code) =>
      code === 0
        ? resolve(out)
        : reject(new Error(`${cmd} exited ${code}: ${err.trim().slice(-500)}`)),
    )
  })
}

/** Whether a command can be started at all. */
export function hasCommand(cmd: string, args = ['-version']): Promise<boolean> {
  return run(cmd, args).then(
    () => true,
    (e: NodeJS.ErrnoException) => e.code !== 'ENOENT',
  )
}

export async function probeSeconds(file: string): Promise<number> {
  const out = await run('ffprobe', [
    // Local files only: a crafted upload can't make ffprobe fetch anything.
    '-protocol_whitelist',
    'file,pipe',
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    file,
  ])
  const seconds = Number(out.trim())
  if (!Number.isFinite(seconds)) throw new Error(`ffprobe gave no duration for ${file}`)
  return seconds
}
