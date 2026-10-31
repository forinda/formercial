import { HttpException, type RequestContext } from '@forinda/kickjs'

const tooLarge = (limit: number) => new HttpException(413, `larger than ${limit / 1024 / 1024} MB`)

/** Read a request body as bytes, refusing more than `limit`. */
export async function readBody(ctx: RequestContext, limit: number): Promise<Uint8Array> {
  const declared = Number(ctx.headers['content-length'] ?? 0)
  if (declared > limit) throw tooLarge(limit)
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of ctx.req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > limit) throw tooLarge(limit)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
