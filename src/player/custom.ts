// A custom scene's script: module-style source exporting draw(t, ctx). It's
// compiled with new Function so drawing stays synchronous; `import` isn't
// supported, so a scene uses what the page has.
export type DrawCtx = {
  root: ShadowRoot
  theme: unknown
  format: string
  width: number
  height: number
  length: number
  scene: unknown
}
export type Draw = (t: number, ctx: DrawCtx) => void

export function compileDraw(script: string): Draw {
  const body = script
    .replace(/^(\s*)export\s+default\s+/gm, '$1const __default = ')
    .replace(/^(\s*)export\s+(?=(?:async\s+)?function\b|const\b|let\b|var\b|class\b)/gm, '$1')
  const draw = new Function(
    `${body}\n;return typeof draw === 'function' ? draw : typeof __default === 'function' ? __default : undefined`,
  )()
  if (typeof draw !== 'function')
    throw new Error('custom scene has no draw function: export function draw(t, ctx) { … }')
  return draw
}
