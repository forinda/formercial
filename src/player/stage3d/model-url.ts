/**
 * Whether a model may load this URL. A .glb can point at other files, and projects
 * get shared, so a model may load only itself and what's embedded in it. Otherwise,
 * opening or rendering a project could send requests anywhere.
 */
export function modelMayLoad(url: string, model: string, page: string): boolean {
  try {
    const target = new URL(url, page)
    if (target.protocol === 'data:' || target.protocol === 'blob:') return true
    return target.href === new URL(model, page).href
  } catch {
    return false
  }
}
