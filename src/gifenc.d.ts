// gifenc ships no types: the parts the meme GIF export uses.
declare module 'gifenc' {
  export type Palette = number[][]
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): Palette
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette): Uint8Array
  export function GIFEncoder(): {
    /** delay in milliseconds; repeat 0 loops forever (set on the first frame). */
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts: { palette: Palette; delay?: number; repeat?: number },
    ): void
    finish(): void
    bytes(): Uint8Array
  }
}
