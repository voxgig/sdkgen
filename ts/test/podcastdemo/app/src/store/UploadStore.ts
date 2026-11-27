import type { Upload } from '../types.js'
import { newId } from './RecordStore.js'

interface Session extends Upload {
  chunks: Buffer[]
}

export type AppendResult =
  | { kind: 'appended'; upload: Upload }
  | { kind: 'complete'; upload: Upload; bytes: Buffer }
  | { kind: 'conflict'; offset: number }
  | { kind: 'too-large' }

export class UploadStore {
  private sessions = new Map<string, Session>()

  constructor(private readonly ttlMs: number) {}

  private sweep(now: number) {
    for (const [id, s] of this.sessions) {
      if (Date.parse(s.expires) <= now) this.sessions.delete(id)
    }
  }

  count(now = Date.now()): number {
    this.sweep(now)
    return this.sessions.size
  }

  create(
    spec: Omit<Upload, 'id' | 'offset' | 'complete' | 'expires'>,
    now = Date.now(),
  ): Upload {
    const session: Session = {
      ...spec,
      id: newId(),
      offset: 0,
      complete: false,
      expires: new Date(now + this.ttlMs).toISOString(),
      chunks: [],
    }
    this.sessions.set(session.id, session)
    return view(session)
  }

  get(id: string, now = Date.now()): Upload | undefined {
    this.sweep(now)
    const session = this.sessions.get(id)
    return session ? view(session) : undefined
  }

  append(id: string, offset: number, bytes: Buffer): AppendResult | undefined {
    const session = this.sessions.get(id)
    if (!session) return undefined
    if (offset !== session.offset) return { kind: 'conflict', offset: session.offset }
    if (session.offset + bytes.length > session.size) return { kind: 'too-large' }
    if (0 < bytes.length) session.chunks.push(Buffer.from(bytes))
    session.offset += bytes.length
    if (session.offset === session.size && !session.complete) {
      session.complete = true
      const whole = Buffer.concat(session.chunks)
      session.chunks = []
      return { kind: 'complete', upload: view(session), bytes: whole }
    }
    return { kind: 'appended', upload: view(session) }
  }

  // After a failed integrity check the session starts again from zero.
  restart(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      session.chunks = []
      session.offset = 0
      session.complete = false
    }
  }

  delete(id: string): boolean {
    return this.sessions.delete(id)
  }

  deleteWhere(test: (u: Upload) => boolean): void {
    for (const [id, s] of this.sessions) {
      if (test(s)) this.sessions.delete(id)
    }
  }
}

function view(session: Session): Upload {
  const { chunks: _chunks, ...upload } = session
  return upload
}
