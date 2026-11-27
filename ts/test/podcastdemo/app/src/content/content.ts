import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'

export interface Content {
  readonly size: number
  readonly type: string
  // Bytes [start, end), end exclusive.
  read(start: number, end: number): Readable
  sha256(): Promise<Buffer>
}

export class BufferContent implements Content {
  private hash?: Buffer

  constructor(
    readonly bytes: Buffer,
    readonly type: string,
  ) {}

  get size() {
    return this.bytes.length
  }

  read(start: number, end: number): Readable {
    return Readable.from([this.bytes.subarray(start, end)], { objectMode: false })
  }

  async sha256(): Promise<Buffer> {
    if (!this.hash) {
      this.hash = createHash('sha256').update(this.bytes).digest()
    }
    return this.hash
  }
}

export async function hashStream(stream: Readable, algorithm = 'sha256'): Promise<Buffer> {
  const hash = createHash(algorithm)
  for await (const chunk of stream) {
    hash.update(chunk as Buffer)
  }
  return hash.digest()
}

export async function collect(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}
