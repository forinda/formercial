// Utility jobs: make one, add its files, start it, download what it made. Each
// job has its own folder in the system's temporary space, kept for an hour.
// Jobs run one at a time, each with a time limit.
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HttpException, Service } from '@forinda/kickjs'
import { findChrome } from '@/core/render/cdp'
import { hasCommand } from '@/core/media/media'
import { exec } from '@/core/tools/exec'
import { TOOLS } from '@/core/tools'
import type { AnyTool } from '@/core/tools/tool'
import { sniff } from '@/core/tools/sniff'

export const MAX_FILE = 200 * 1024 * 1024
const KEEP_MS = 60 * 60 * 1000
const TIME_LIMIT_MS = 10 * 60 * 1000
const MAX_JOBS = 200
const ID = /^[0-9a-f]{32}$/

export type ToolJob = {
  id: string
  tool: string
  options: unknown
  state: 'waiting' | 'queued' | 'running' | 'done' | 'failed'
  /** Uploaded files: their names as given (for the download names) and kinds. */
  files: { name: string; kind: string; size: number }[]
  outputs: string[]
  error?: string
  createdAt: number
}

export type ToolSummary = Awaited<ReturnType<ToolJobs['list']>>[number]

const safeName = (name: string) => name.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'file'

/** Whether a program a tool needs is here. Chromium is found by path, the rest by starting them. */
function present(need: string) {
  if (need === 'chromium') return Promise.resolve(findChrome() !== null)
  return hasCommand(need, need === 'ffmpeg' ? ['-version'] : ['--version'])
}

@Service()
export class ToolJobs {
  root = join(tmpdir(), 'formercial-tools')
  /** The tools on offer; tests swap in their own. */
  tools: AnyTool[] = TOOLS
  private readonly jobs = new Map<string, ToolJob>()
  private queue: Promise<unknown> = Promise.resolve()
  private available?: Promise<Record<string, boolean>>

  constructor() {
    setInterval(() => void this.sweep(), 10 * 60_000).unref()
  }

  private tool(id: unknown): AnyTool {
    const tool = this.tools.find((t) => t.id === id)
    if (!tool) throw HttpException.notFound('no such tool')
    return tool
  }

  private job(id: string): ToolJob {
    const job = ID.test(id) ? this.jobs.get(id) : undefined
    if (!job) throw HttpException.notFound('no such job; jobs are kept for an hour')
    return job
  }

  private dir = (id: string) => join(this.root, id)

  /** Every tool, with any programs it needs that this machine lacks (checked once). */
  async list() {
    this.available ??= Promise.all(
      [...new Set(this.tools.flatMap((t) => t.needs))].map(
        async (n) => [n, await present(n)] as const,
      ),
    ).then(Object.fromEntries)
    const have = await this.available
    return this.tools.map(
      ({ id, title, description, group, accepts, minFiles, maxFiles, fields, needs, note }) => ({
        id,
        title,
        description,
        group,
        accepts,
        minFiles: minFiles ?? 1,
        maxFiles: maxFiles ?? 1,
        fields,
        note,
        missing: needs.filter((n) => !have[n]),
      }),
    )
  }

  async create(toolId: unknown, options: unknown): Promise<ToolJob> {
    const tool = this.tool(toolId)
    const parsed = tool.options.safeParse(options ?? {})
    if (!parsed.success) throw HttpException.badRequest('those options are not right for this tool')
    await this.sweep()
    if (this.jobs.size >= MAX_JOBS)
      throw HttpException.badRequest('too many jobs at once, try again later')
    const job: ToolJob = {
      id: randomBytes(16).toString('hex'),
      tool: tool.id,
      options: parsed.data,
      state: 'waiting',
      files: [],
      outputs: [],
      createdAt: Date.now(),
    }
    await mkdir(join(this.dir(job.id), 'out'), { recursive: true })
    this.jobs.set(job.id, job)
    return job
  }

  /** Add one file. Its kind comes from its contents, and must be one the tool takes. */
  async addFile(id: string, name: string, bytes: Uint8Array): Promise<ToolJob> {
    const job = this.job(id)
    const tool = this.tool(job.tool)
    if (job.state !== 'waiting') throw HttpException.badRequest('this job has started')
    if (job.files.length >= (tool.maxFiles ?? 1))
      throw HttpException.badRequest('that is enough files for this tool')
    const kind = sniff(bytes)
    if (!kind || !tool.accepts.includes(kind))
      throw HttpException.badRequest(`this tool takes ${tool.accepts.join(', ')} files`)
    // Stored under a name of our own: what the visitor called it never touches the disk.
    const n = job.files.length + 1
    job.files.push({ name: safeName(name), kind, size: bytes.length })
    await writeFile(join(this.dir(id), `in-${n}.${kind}`), bytes)
    return job
  }

  start(id: string): ToolJob {
    const job = this.job(id)
    const tool = this.tool(job.tool)
    if (job.state !== 'waiting') throw HttpException.badRequest('this job has started')
    if (job.files.length < (tool.minFiles ?? 1)) throw HttpException.badRequest('add a file first')
    job.state = 'queued'
    // ponytail: one job at a time across the app; a small pool if people wait too long.
    this.queue = this.queue.then(() => this.run(job, tool))
    return job
  }

  /** Resolves once every job started so far has finished. For tests. */
  idle() {
    return this.queue
  }

  private async run(job: ToolJob, tool: AnyTool) {
    job.state = 'running'
    const dir = this.dir(job.id)
    const signal = AbortSignal.timeout(TIME_LIMIT_MS)
    try {
      await tool.run({
        inputs: job.files.map((f, i) => join(dir, `in-${i + 1}.${f.kind}`)),
        dir,
        options: job.options,
        signal,
        exec: (cmd, args, opts) => exec(cmd, args, { cwd: opts?.cwd ?? dir, signal }),
      })
      // What's really in out/, not what the tool said: nothing outside it is ever offered.
      job.outputs = (await readdir(join(dir, 'out'))).filter((n) => !n.startsWith('.')).sort()
      if (!job.outputs.length) throw new Error('it finished without making anything')
      job.state = 'done'
    } catch (err) {
      job.state = 'failed'
      job.error = signal.aborted ? 'it took too long, so it was stopped' : (err as Error).message
    }
  }

  status(id: string): ToolJob {
    return this.job(id)
  }

  /** One output, by its name in out/, offered under the uploaded file's name. */
  async output(id: string, name: string): Promise<{ bytes: Buffer; name: string }> {
    const job = this.job(id)
    if (!job.outputs.includes(name)) throw HttpException.notFound('no such file in this job')
    const bytes = await readFile(join(this.dir(id), 'out', name))
    return { bytes, name: this.nameFor(job, name) }
  }

  /** An output's download name: the uploaded file's name, with the output's extension. */
  nameFor(job: ToolJob, output: string) {
    const ext = output.includes('.') ? `.${output.split('.').pop()}` : ''
    const i = Number(/^in-(\d+)/.exec(output)?.[1] ?? 1) - 1
    const given = (job.files[i] ?? job.files[0])?.name.replace(/\.[^.]+$/, '') ?? 'file'
    // Several outputs from one input (pages, say) keep what follows "in-N".
    const suffix = /^in-\d+(.*)\.[^.]+$/.exec(output)?.[1] ?? ''
    return `${given}${suffix}${ext}`
  }

  /** Forget finished jobs older than an hour, and their folders. */
  async sweep() {
    const cutoff = Date.now() - KEEP_MS
    for (const [id, job] of this.jobs) {
      if (job.createdAt >= cutoff || job.state === 'running' || job.state === 'queued') continue
      this.jobs.delete(id)
      await rm(this.dir(id), { recursive: true, force: true })
    }
  }
}
