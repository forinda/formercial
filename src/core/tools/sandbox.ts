// Run a tool's program in a bubblewrap sandbox: no network, and of the files on
// this machine only the system's programs (read-only) and the job's own folder.
// A crafted document can then neither fetch a URL nor pull a local file into its
// output. Without bwrap (or where the kernel refuses it) programs run as they
// are, with only their own safeguards.
import { run } from '@/core/media/media'

const SYSTEM = ['/usr', '/etc', '/opt', '/lib', '/lib64', '/lib32', '/bin', '/sbin']

/** bwrap's arguments to run a program with only `dir` visible and writable. */
export function sandboxArgs(dir: string): string[] {
  const head = ['--unshare-all', '--die-with-parent', '--new-session', '--clearenv']
  const env = [
    '--setenv',
    'PATH',
    '/usr/bin:/bin',
    '--setenv',
    'HOME',
    dir,
    '--setenv',
    'LANG',
    'C.UTF-8',
  ]
  const system = SYSTEM.flatMap((d) => ['--ro-bind-try', d, d])
  const job = [
    '--proc',
    '/proc',
    '--dev',
    '/dev',
    '--tmpfs',
    '/tmp',
    '--bind',
    dir,
    dir,
    '--chdir',
    dir,
  ]
  return head.concat(env, system, job, '--')
}

let usable: Promise<boolean> | undefined

/** Whether bwrap is here and allowed to make a sandbox. Checked once. */
export function canSandbox(): Promise<boolean> {
  usable ??= run('bwrap', [...sandboxArgs('/tmp'), 'true']).then(
    () => true,
    () => false,
  )
  return usable
}

/** The command and arguments to run, inside the sandbox when there is one. */
export async function sandboxed(
  cmd: string,
  args: string[],
  dir: string,
): Promise<[string, string[]]> {
  return (await canSandbox()) ? ['bwrap', [...sandboxArgs(dir), cmd, ...args]] : [cmd, args]
}
