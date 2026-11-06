// A PDF opened in the browser with PDF.js: its pages' sizes as they're seen
// (rotation applied, within the crop box), and drawing any page onto a canvas.
// Loaded only in the browser, so the server-side render never touches it.

export type LoadedPdf = {
  pageCount: number
  /** In points, as the page is seen. */
  size(page: number): { width: number; height: number }
  /** Draws `page` at `scale` pixels per point (times the screen's pixel ratio). */
  render(page: number, canvas: HTMLCanvasElement, scale: number): Promise<void>
}

export async function loadPdf(file: Blob): Promise<LoadedPdf> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data, enableXfa: false }).promise.catch((err: Error) => {
    if (err?.name === 'PasswordException')
      throw new Error('this PDF has a password; take it off first')
    throw new Error("this file couldn't be read as a PDF")
  })
  const pages = await Promise.all(
    Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1)),
  )
  const sizes = pages.map((p) => p.getViewport({ scale: 1 }))
  // One drawing per canvas: a newer one (after zooming) cancels the old.
  const drawing = new WeakMap<HTMLCanvasElement, { cancel(): void }>()
  return {
    pageCount: doc.numPages,
    size: (n) => ({ width: sizes[n - 1].width, height: sizes[n - 1].height }),
    async render(n, canvas, scale) {
      drawing.get(canvas)?.cancel()
      const ratio = window.devicePixelRatio || 1
      const viewport = pages[n - 1].getViewport({ scale: scale * ratio })
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
