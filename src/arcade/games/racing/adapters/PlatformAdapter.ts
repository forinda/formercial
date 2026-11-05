import type { GameInstance } from '@/arcade/shared/GameInterface'
import { RacingEngine } from '../RacingEngine'

export class PlatformAdapter implements GameInstance {
  private engine: RacingEngine

  constructor(canvas: HTMLCanvasElement, onExit: () => void) {
    this.engine = new RacingEngine(canvas, onExit)
  }

  start(): void {
    this.engine.start()
  }

  destroy(): void {
    this.engine.destroy()
  }
}
