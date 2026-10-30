/** Whether a driver or provider can run here, and what to install if not. */
export interface Check {
  ok: boolean
  missing: string[]
}

/** Turns a spoken line into an audio file. edge-tts is built in; add others in src/formercial.config.ts. */
export interface VoiceProvider {
  name: string
  check(): Promise<Check>
  speak(text: string, opts: { voice: string; rate: string }, outFile: string): Promise<void>
}
