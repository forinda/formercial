// Signing documents, kept on this machine until deleted: the PDF as it was
// opened, what's been placed on it, copies of the signature pictures it uses,
// and every signed copy made from it, numbered. Under _signing/<id>/ in the
// projects' storage, beside _memes/ and _signatures/. Certificates and their
// passwords are never kept.
import { randomBytes } from 'node:crypto'
import { HttpException, Inject, Service } from '@forinda/kickjs'
import { checkKey, type Storage } from '@forinda/kickjs-storage'
import { STORAGE } from '@forinda/kickjs-storage/adapter'
import { z } from 'zod'
import { placedItems } from '@/core/tools/sign-items'
import { sniff } from '@/core/tools/sniff'

const ROOT = '_signing'
const ID = /^[0-9a-f]{16}$/
const PICTURES = ['signature', 'initials'] as const
export const MAX_SIGNING_PDF = 50 * 1024 * 1024
const MAX_PICTURE = 2 * 1024 * 1024

const version = z.object({
  n: z.number().int().min(1),
  createdAt: z.string(),
  digital: z.boolean(),
})
const doc = z.object({
  id: z.string().regex(ID),
  name: z.string(),
  pages: z.number().int().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: placedItems.default([]),
  pictures: z.array(z.enum(PICTURES)).default([]),
  versions: z.array(version).default([]),
})
export type SigningDoc = z.infer<typeof doc>
export type SigningVersion = z.infer<typeof version>
export type SigningSummary = Pick<
  SigningDoc,
  'id' | 'name' | 'pages' | 'createdAt' | 'updatedAt'
> & { versions: number }

const notFound = () => HttpException.notFound('no such document')
/** A file name to show and download under: no folders, no odd characters, not too long. */
const cleanName = (name: unknown) =>
  (typeof name === 'string' ? name : '')
    .split(/[\\/]/)
    .pop()!
    .replace(/[^\w .,()-]+/g, '_')
    .trim()
    .slice(0, 120) || 'document.pdf'

@Service()
export class SigningStore {
  constructor(@Inject(STORAGE) private readonly storage: Storage) {}

  // One change at a time per document, so two saves never read the same
  // doc.json and the second overwrite the first.
  private locks = new Map<string, Promise<unknown>>()
  private locked<T>(id: string, change: () => Promise<T>): Promise<T> {
    const run = (this.locks.get(id) ?? Promise.resolve()).then(change, change)
    const tail = run.catch(() => {})
    this.locks.set(id, tail)
    void tail.then(() => this.locks.get(id) === tail && this.locks.delete(id))
    return run
  }

  private key(id: string, file: string) {
    if (!ID.test(id)) throw notFound()
    return checkKey(`${ROOT}/${id}/${file}`)
  }

  private async write(value: SigningDoc) {
    await this.storage.put(this.key(value.id, 'doc.json'), `${JSON.stringify(value, null, 2)}\n`)
  }

  async read(id: string): Promise<SigningDoc> {
    const bytes = await this.storage.get(this.key(id, 'doc.json'))
    if (!bytes) throw notFound()
    return doc.parse(JSON.parse(new TextDecoder().decode(bytes)))
  }

  /** Newest change first. */
  async list(): Promise<SigningSummary[]> {
    const out: SigningSummary[] = []
    let cursor: string | undefined
    do {
      const page = await this.storage.list({ prefix: `${ROOT}/`, delimiter: '/', cursor })
      for (const prefix of page.prefixes ?? []) {
        const id = prefix.slice(ROOT.length + 1, -1)
        if (!ID.test(id)) continue
        const d = await this.read(id).catch(() => null)
        if (!d) continue
        const { name, pages, createdAt, updatedAt } = d
        out.push({ id, name, pages, createdAt, updatedAt, versions: d.versions.length })
      }
      cursor = page.cursor
    } while (cursor)
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async create(name: unknown, pages: unknown, bytes: Uint8Array): Promise<SigningDoc> {
    if (sniff(bytes) !== 'pdf') throw HttpException.badRequest('that is not a PDF')
    const count = Number(pages)
    if (!Number.isInteger(count) || count < 1 || count > 5000)
      throw HttpException.badRequest('pages is the number of pages, 1 to 5000')
    const now = new Date().toISOString()
    const value: SigningDoc = {
      id: randomBytes(8).toString('hex'),
      name: cleanName(name),
      pages: count,
      createdAt: now,
      updatedAt: now,
      items: [],
      pictures: [],
      versions: [],
    }
    await this.storage.put(this.key(value.id, 'original.pdf'), bytes)
    await this.write(value)
    return value
  }

  saveItems(id: string, items: unknown): Promise<SigningDoc> {
    const parsed = placedItems.safeParse(items)
    if (!parsed.success) throw HttpException.badRequest('those items are not right')
    return this.locked(id, async () => {
      const current = await this.read(id)
      if (parsed.data.some((i) => i.pages.some((p) => p > current.pages)))
        throw HttpException.badRequest(`it has only ${current.pages} pages`)
      const value = { ...current, items: parsed.data, updatedAt: new Date().toISOString() }
      await this.write(value)
      return value
    })
  }

  async original(id: string): Promise<Uint8Array> {
    await this.read(id)
    const bytes = await this.storage.get(this.key(id, 'original.pdf'))
    if (!bytes) throw notFound()
    return bytes
  }

  private label(label: string) {
    const ok = PICTURES.find((p) => p === label)
    if (!ok) throw HttpException.badRequest('a picture is the signature or the initials')
    return ok
  }

  async putPicture(id: string, label: string, bytes: Uint8Array): Promise<SigningDoc> {
    const which = this.label(label)
    if (bytes.length > MAX_PICTURE) throw new HttpException(413, 'larger than 2 MB')
    if (sniff(bytes) !== 'png') throw HttpException.badRequest('a picture is kept as a PNG')
    return this.locked(id, async () => {
      const current = await this.read(id)
      await this.storage.put(this.key(id, `pictures/${which}.png`), bytes)
      const pictures = current.pictures.includes(which)
        ? current.pictures
        : current.pictures.concat([which])
      const value = { ...current, pictures, updatedAt: new Date().toISOString() }
      await this.write(value)
      return value
    })
  }

  async picture(id: string, label: string): Promise<Uint8Array> {
    const which = this.label(label)
    if (!(await this.read(id)).pictures.includes(which)) throw notFound()
    const bytes = await this.storage.get(this.key(id, `pictures/${which}.png`))
    if (!bytes) throw notFound()
    return bytes
  }

  /** A signed copy, kept as the next version. Digitally signed only if it carries a signature. */
  addVersion(id: string, bytes: Uint8Array, digital: boolean): Promise<SigningVersion> {
    if (sniff(bytes) !== 'pdf') throw HttpException.badRequest('that is not a PDF')
    // ponytail: looks for a signature dictionary's byte range, not a verified signature.
    const signed = digital && Buffer.from(bytes).includes('/ByteRange')
    return this.locked(id, async () => {
      const current = await this.read(id)
      const n = Math.max(0, ...current.versions.map((v) => v.n)) + 1
      const made: SigningVersion = { n, createdAt: new Date().toISOString(), digital: signed }
      await this.storage.put(this.key(id, `v${n}.pdf`), bytes)
      const versions = current.versions.concat([made])
      await this.write({ ...current, versions, updatedAt: made.createdAt })
      return made
    })
  }

  async version(id: string, n: number): Promise<{ bytes: Uint8Array; name: string }> {
    const current = await this.read(id)
    if (!current.versions.some((v) => v.n === n)) throw notFound()
    const bytes = await this.storage.get(this.key(id, `v${n}.pdf`))
    if (!bytes) throw notFound()
    return { bytes, name: `${current.name.replace(/\.pdf$/i, '')}-v${n}.pdf` }
  }

  remove(id: string): Promise<void> {
    return this.locked(id, async () => {
      await this.read(id)
      const keys: string[] = []
      let cursor: string | undefined
      do {
        const page = await this.storage.list({ prefix: `${ROOT}/${id}/`, cursor })
        keys.push(...page.files.map((f) => f.key))
        cursor = page.cursor
      } while (cursor)
      // doc.json last: if a delete fails part way, the document is still listed and can be deleted again.
      const meta = this.key(id, 'doc.json')
      for (const key of keys) if (key !== meta) await this.storage.delete(key)
      await this.storage.delete(meta)
    })
  }
}
