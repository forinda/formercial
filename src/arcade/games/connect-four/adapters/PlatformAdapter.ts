import type { GameInstance } from '@/arcade/shared/GameInterface.ts'
import { ConnectFourEngine } from '../ConnectFourEngine.ts'

export class PlatformAdapter implements GameInstance {
  private engine: ConnectFourEngine

  constructor(canvas: HTMLCanvasElement, onExit: () => void) {
    this.engine = new ConnectFourEngine(canvas, onExit)
  }

  start(): void {
    this.engine.start()
  }

  destroy(): void {
    this.engine.destroy()
  }
}
