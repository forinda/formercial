// Signatures and initials kept on this machine, so they needn't be made again
// for every document: PNGs under _signatures/ in the projects' storage (a
// leading underscore is never a project slug), with a small index beside them.
import { randomBytes } from 'node:crypto'
import { HttpException, Inject, Service } from '@forinda/kickjs'
import { checkKey, type Storage } from '@forinda/kickjs-storage'
import { STORAGE } from '@forinda/kickjs-storage/adapter'
import { z } from 'zod'
import { sniff } from '@/core/tools/sniff'

const ROOT = '_signatures'
const ID = /^[0-9a-f]{16}$/
export const MAX_SIGNATURE = 2 * 1024 * 1024

const saved = z.object({
  id: z.string().regex(ID),
  kind: z.enum(['signature', 'initials']),
  made: z.enum(['drawn', 'uploaded', 'typed']),
  createdAt: z.string(),
})
export type SavedSignature = z.infer<typeof saved>
const index = z.object({ signatures: z.array(saved).default([]), name: z.string().default('') })
type Index = z.infer<typeof index>

@Service()
export class SignatureStore {
  constructor(@Inject(STORAGE) private readonly storage: Storage) {}

  private picture(id: string) {
    if (!ID.test(id)) throw HttpException.notFound('no such signature')
    return checkKey(`${ROOT}/${id}.png`)
  }

  // ponytail: read, change, write the index; one person on one machine, so no lock.
  private async index(): Promise<Index> {
    const bytes = await this.storage.get(checkKey(`${ROOT}/index.json`))
    if (!bytes) return { signatures: [], name: '' }
    const parsed = index.safeParse(JSON.parse(new TextDecoder().decode(bytes)))
    return parsed.success ? parsed.data : { signatures: [], name: '' }
  }

  private save(value: Index) {
    return this.storage.put(checkKey(`${ROOT}/index.json`), `${JSON.stringify(value, null, 2)}\n`)
  }

  /** Newest first, and the remembered name. */
  list(): Promise<Index> {
    return this.index()
  }

  async add(kind: unknown, made: unknown, bytes: Uint8Array): Promise<SavedSignature> {
    const meta = saved.pick({ kind: true, made: true }).safeParse({ kind, made })
    if (!meta.success)
      throw HttpException.badRequest(
        'kind is signature or initials; made is drawn, uploaded or typed',
      )
    if (sniff(bytes) !== 'png') throw HttpException.badRequest('a signature is kept as a PNG')
    const item: SavedSignature = {
      id: randomBytes(8).toString('hex'),
      ...meta.data,
      createdAt: new Date().toISOString(),
    }
    await this.storage.put(this.picture(item.id), bytes)
    const current = await this.index()
    await this.save({ ...current, signatures: [item].concat(current.signatures) })
    return item
  }

  async read(id: string): Promise<Uint8Array> {
    const known = ID.test(id) && (await this.index()).signatures.some((s) => s.id === id)
    const bytes = known ? await this.storage.get(this.picture(id)) : null
    if (!bytes) throw HttpException.notFound('no such signature')
    return bytes
  }

  async remove(id: string): Promise<void> {
    const current = await this.index()
    if (!ID.test(id) || !current.signatures.some((s) => s.id === id))
      throw HttpException.notFound('no such signature')
    await this.storage.delete(this.picture(id))
    await this.save({ ...current, signatures: current.signatures.filter((s) => s.id !== id) })
  }

  async setName(name: unknown): Promise<string> {
    const clean = typeof name === 'string' ? name.trim() : ''
    if (clean.length > 100) throw HttpException.badRequest('a name is at most 100 characters')
    await this.save({ ...(await this.index()), name: clean })
    return clean
  }
}
