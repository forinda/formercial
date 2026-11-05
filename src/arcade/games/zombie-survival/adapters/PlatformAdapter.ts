import type { GameInstance } from '@/arcade/shared/GameInterface.ts'
import { ZombieEngine } from '../ZombieEngine.ts'

export class PlatformAdapter implements GameInstance {
  private engine: ZombieEngine

  constructor(canvas: HTMLCanvasElement, onExit: () => void) {
    this.engine = new ZombieEngine(canvas, onExit)
  }

  start(): void {
    this.engine.start()
  }

  destroy(): void {
    this.engine.stop()
  }
}
