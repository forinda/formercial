// A PDF opened in the browser with PDF.js: its pages' sizes as they're seen
// (rotation applied, within the crop box), and drawing any page onto a canvas.
// Loaded only in the browser, so the server-side render never touches it.

export type LoadedPdf = {
  pageCount: number
  /** In points, as the page is seen. */
  size(page: number): { width: number; height: number }
  /** Draws `page` at `scale` pixels per point (times the screen's pixel ratio). */
  render(page: number, canvas: HTMLCanvasElement, scale: number): Promise<void>
  /** Stops any drawing on `canvas` and frees its pixels. */
  release(canvas: HTMLCanvasElement): void
  /** Lets go of the document and its worker. */
  destroy(): Promise<void>
}

/** About the most pixels one canvas can hold everywhere (iOS Safari caps near 16.7M). */
export const MAX_CANVAS_PIXELS = 16_000_000

/** Canvas pixels per point for a page: as asked, unless that's more than a browser will draw. */
export function drawScale(size: { width: number; height: number }, scale: number, ratio: number) {
  const s = scale * ratio
  const most = Math.sqrt(MAX_CANVAS_PIXELS / (size.width * size.height))
  return Math.min(s, most)
}

export async function loadPdf(file: Blob): Promise<LoadedPdf> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const data = new Uint8Array(await file.arrayBuffer())
  const task = pdfjs.getDocument({ data, enableXfa: false })
  const doc = await task.promise.catch((err: Error) => {
    void task.destroy()
    if (err?.name === 'PasswordException')
      throw new Error('this PDF has a password; take it off first')
    throw new Error("this file couldn't be read as a PDF")
  })
  // ponytail: every page is read up front, for its size (the layout needs them all);
  // slow near the 5000-page cap. Assume page 1's size and read the rest lazily if that bites.
  const pages = await Promise.all(
    Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1)),
  ).catch(() => {
    // Opened, but a page won't load (a damaged page tree, say).
    void task.destroy()
    throw new Error("this file couldn't be read as a PDF")
  })
  const sizes = pages.map((p) => p.getViewport({ scale: 1 }))
  // One drawing per canvas: a newer one (after zooming) cancels the old.
  const drawing = new WeakMap<HTMLCanvasElement, { cancel(): void }>()
  return {
    pageCount: doc.numPages,
    release(canvas) {
      drawing.get(canvas)?.cancel()
      drawing.delete(canvas)
      canvas.width = canvas.height = 0
    },
    destroy: () => task.destroy(),
    size: (n) => ({ width: sizes[n - 1].width, height: sizes[n - 1].height }),
    async render(n, canvas, scale) {
      drawing.get(canvas)?.cancel()
      const s = drawScale(sizes[n - 1], scale, window.devicePixelRatio || 1)
      // Past the cap the page is drawn smaller and stretched to fit: softer, not blank.
      const viewport = pages[n - 1].getViewport({ scale: s })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const task = pages[n - 1].render({ canvas, viewport })
      drawing.set(canvas, task)
      await task.promise.catch((err: Error) => {
        if (err?.name !== 'RenderingCancelledException') throw err
      })
    },
  }
}
