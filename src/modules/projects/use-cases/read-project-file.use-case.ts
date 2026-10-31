import { HttpException, Service } from '@forinda/kickjs'
import { checkRange } from '@forinda/kickjs-storage'
import { Studio } from '../services/studio.service'

const TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  srt: 'application/x-subrip',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  woff2: 'font/woff2',
  txt: 'text/plain; charset=utf-8',
}
const typeOf = (path: string) =>
  TYPES[path.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream'

/** A file from a project as a streamed response, honoring a Range header. */
@Service()
export class ReadProjectFileUseCase {
  constructor(private readonly studio: Studio) {}

  async execute(slug: string, path: string, range?: string): Promise<Response> {
    const { storage, ws } = this.studio
    const key = ws.key(slug, path)
    const info = await storage.stat(key)
    if (!info) throw HttpException.notFound()
    const headers: Record<string, string> = {
      'content-type': typeOf(path),
      'accept-ranges': 'bytes',
      // Uploaded files (an SVG logo, say) can hold script: served sandboxed,
      // so opening one directly can't act as the app. <img>, <audio> and
      // fonts are unaffected.
      'content-security-policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'",
      'x-content-type-options': 'nosniff',
    }
    const m = /^bytes=(\d*)-(\d*)$/.exec(range ?? '')
    if (m && (m[1] || m[2])) {
      const start = m[1] ? Number(m[1]) : Math.max(0, info.size - Number(m[2]))
      const end = m[1] && m[2] ? Math.min(Number(m[2]), info.size - 1) : info.size - 1
      if (start > end || start >= info.size) {
        return new Response(null, {
          status: 416,
          headers: { 'content-range': `bytes */${info.size}` },
        })
      }
      const stream = await storage.getStream(key, checkRange({ start, end }) ?? undefined)
      headers['content-range'] = `bytes ${start}-${end}/${info.size}`
      headers['content-length'] = String(end - start + 1)
      return new Response(stream, { status: 206, headers })
    }
    headers['content-length'] = String(info.size)
    return new Response(await storage.getStream(key), { status: 200, headers })
  }
}
