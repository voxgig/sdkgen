import { createHash } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { buildApp, type BuildOptions, type PodcastApp } from '../src/server.js'
import { DEFAULT_TOKEN } from '../src/config.js'

export const TOKEN = DEFAULT_TOKEN

type Init = Omit<RequestInit, 'body'> & { body?: BodyInit | Buffer | null }

export interface Running extends PodcastApp {
  base: string
  call(path: string, init?: Init): Promise<Response>
  close(): Promise<void>
}

// Each suite listens on an ephemeral loopback port of its own.
export async function start(options: BuildOptions = {}): Promise<Running> {
  const app = await buildApp(options)
  await app.fastify.listen({ host: '127.0.0.1', port: 0 })
  const { port } = app.fastify.server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`
  return {
    ...app,
    base,
    call(path, init = {}) {
      const headers = new Headers(init.headers)
      if (!headers.has('authorization')) headers.set('authorization', `Bearer ${TOKEN}`)
      const body = Buffer.isBuffer(init.body) ? new Uint8Array(init.body) : init.body
      return fetch(base + path, { ...init, body, headers })
    },
    close: () => app.fastify.close(),
  }
}

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest()

export const reprOf = (bytes: Uint8Array) => `sha-256=:${sha256(bytes).toString('base64')}:`

export async function bytesOf(res: Response): Promise<Buffer> {
  return Buffer.from(await res.arrayBuffer())
}

export function wavFile(size: number, fill = 7): Buffer {
  const bytes = Buffer.alloc(size, fill)
  bytes.write('RIFF', 0, 'ascii')
  return bytes
}

// A multipart body written by hand, so a part's headers can be awkward.
export function multipart(
  parts: { headers: string[]; body: Buffer | string }[],
  boundary = 'b0und4ry-' + Math.random().toString(16).slice(2),
) {
  const chunks: Buffer[] = []
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n${part.headers.join('\r\n')}\r\n\r\n`, 'utf-8'))
    chunks.push(Buffer.isBuffer(part.body) ? part.body : Buffer.from(part.body, 'utf-8'))
    chunks.push(Buffer.from('\r\n'))
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}
