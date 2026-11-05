import type { GameInstance } from '@/arcade/shared/GameInterface'
import { GravityEngine } from '../GravityEngine'

export class PlatformAdapter implements GameInstance {
  private engine: GravityEngine

  constructor(canvas: HTMLCanvasElement, onExit: () => void) {
    this.engine = new GravityEngine(canvas, onExit)
  }

  start(): void {
    this.engine.start()
  }

  destroy(): void {
    this.engine.destroy()
  }
}
