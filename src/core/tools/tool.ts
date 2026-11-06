// What every utility provides. The job runner knows nothing about any one tool:
// it checks the files against `accepts` (by their contents, not their names) and
// the options against `options`, then lets the tool turn its inputs into outputs
// inside the job's own folder.
import type { z } from 'zod'

/** A choice the tool's page offers, shown as a form field. */
export type ToolField =
  | { key: string; label: string; kind: 'select'; choices: { value: string; label: string }[] }
  | { key: string; label: string; kind: 'number'; min?: number; max?: number; step?: number }
  /** `secret`: typed in a password box, and never shown back. */
  | { key: string; label: string; kind: 'text'; secret?: boolean }

export type ToolRun<Options> = {
  /** Absolute paths of the uploaded files, in the order they were given. */
  inputs: string[]
  /** The job's folder: write outputs into `${dir}/out`. */
  dir: string
  options: Options
  /** Run a program with these arguments: no shell, killed after the job's time limit. */
  exec(cmd: string, args: string[], opts?: { cwd?: string }): Promise<string>
  signal: AbortSignal
}

export interface ToolDef<Options> {
  id: string
  title: string
  description: string
  group: 'media' | 'documents' | 'pdf'
  /** The run button's word, if not "Convert". */
  action?: string
  /** File kinds it takes, as sniff() names them. */
  accepts: string[]
  minFiles?: number
  maxFiles?: number
  fields: ToolField[]
  options: z.ZodType<Options>
  /** Programs it needs on this machine; missing ones show as unavailable, not as a failure. */
  needs: string[]
  /**
   * Opens documents that can link outside themselves: only offered where the
   * sandbox works, unless TOOLS_ALLOW_UNSANDBOXED is set.
   */
  needsSandbox?: boolean
  /** A note shown with the tool, like how well it keeps layouts. */
  note?: string
  /** Returns the names of the files it wrote into `${dir}/out`. */
  run(job: ToolRun<Options>): Promise<string[]>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = ToolDef<any>

export const defineTool = <O>(tool: ToolDef<O>) => tool
