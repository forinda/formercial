import type { GameInstance } from '@/arcade/shared/GameInterface'
import { GolfEngine } from '../GolfEngine'

export class PlatformAdapter implements GameInstance {
  private engine: GolfEngine

  constructor(canvas: HTMLCanvasElement, onExit: () => void) {
    this.engine = new GolfEngine(canvas, onExit)
  }

  start(): void {
    this.engine.start()
  }

  destroy(): void {
    this.engine.destroy()
  }
}
