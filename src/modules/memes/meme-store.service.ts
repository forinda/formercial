// Memes live in the same storage as projects, under _memes/<id>/: a leading
// underscore is never a project slug, so the projects list doesn't see them.
import { HttpException, Inject, Service } from '@forinda/kickjs'
import { checkKey, type Storage } from '@forinda/kickjs-storage'
import { STORAGE } from '@forinda/kickjs-storage/adapter'
import { SLUG, slugFrom } from '@/core/project/project'
import { blankMeme, parseMeme, type Meme } from '@/core/meme/meme'

const ROOT = '_memes'
const MEDIA = /^media\/[\w.-]+\.(png|jpe?g|webp|gif)$/
const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

export type MemeSummary = { id: string; name: string; size: Meme['size']; media?: string }

@Service()
export class MemeStore {
  constructor(@Inject(STORAGE) private readonly storage: Storage) {}

  private key(id: string) {
    if (!SLUG.test(id)) throw HttpException.badRequest(`invalid meme id "${id}"`)
    return checkKey(`${ROOT}/${id}/meme.json`)
  }

  /** Only pictures, only under media/: an upload can never replace meme.json. */
  private mediaKey(id: string, path: string) {
    if (!SLUG.test(id)) throw HttpException.badRequest(`invalid meme id "${id}"`)
    if (!MEDIA.test(path) || path.includes('..'))
      throw HttpException.badRequest('a picture goes under media/ as .png, .jpg, .webp or .gif')
    return checkKey(`${ROOT}/${id}/${path}`)
  }

  async list(): Promise<MemeSummary[]> {
    const out: MemeSummary[] = []
    let cursor: string | undefined
    do {
      const page = await this.storage.list({ prefix: `${ROOT}/`, delimiter: '/', cursor })
      for (const prefix of page.prefixes ?? []) {
        const id = prefix.slice(ROOT.length + 1, -1)
        if (!SLUG.test(id)) continue
        try {
          const { name, size, media } = await this.read(id)
          out.push({ id, name, size, media })
        } catch {
          out.push({ id, name: `${id} (unreadable)`, size: '1:1' })
        }
      }
      cursor = page.cursor
    } while (cursor)
    return out.sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'en', { numeric: true }) ||
        a.id.localeCompare(b.id, 'en', { numeric: true }),
    )
  }

  async read(id: string): Promise<Meme> {
    const bytes = await this.storage.get(this.key(id))
    if (!bytes) throw HttpException.notFound(`no meme "${id}"`)
    return parseMeme(JSON.parse(new TextDecoder().decode(bytes)))
  }

  async create(name: string): Promise<{ id: string }> {
    const clean = name.trim()
    if (!clean) throw HttpException.badRequest('name is required')
    const base = slugFrom(clean)
    if (!SLUG.test(base)) throw HttpException.badRequest(`can't make a meme name from "${clean}"`)
    const taken = new Set((await this.list()).map((m) => m.id))
    let id = base
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
    await this.write(id, blankMeme(clean))
    return { id }
  }

  async write(id: string, value: unknown): Promise<Meme> {
    let meme: Meme
    try {
      meme = parseMeme(value)
    } catch (err) {
      throw HttpException.badRequest((err as Error).message)
    }
    await this.storage.put(this.key(id), `${JSON.stringify(meme, null, 2)}\n`)
    return meme
  }

  async remove(id: string): Promise<void> {
    this.key(id)
    const prefix = `${ROOT}/${id}/`
    let cursor: string | undefined
    do {
      const page = await this.storage.list({ prefix, cursor })
      for (const f of page.files) await this.storage.delete(f.key)
      cursor = page.cursor
    } while (cursor)
  }

  async putFile(id: string, path: string, bytes: Uint8Array): Promise<void> {
    const key = this.mediaKey(id, path)
    await this.read(id)
    await this.storage.put(key, bytes)
  }

  async getFile(id: string, path: string): Promise<{ bytes: Uint8Array; type: string }> {
    const bytes = await this.storage.get(this.mediaKey(id, path))
    if (!bytes) throw HttpException.notFound(`no ${path} in meme "${id}"`)
    return { bytes, type: TYPES[path.split('.').pop()!.toLowerCase()] }
  }
}
