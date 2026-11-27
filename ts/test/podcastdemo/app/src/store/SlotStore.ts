import type { Content } from '../content/content.js'
import { etagOf, reprDigest } from '../content/digest.js'
import type { FileInfo } from '../types.js'

export interface Slot {
  content: Content
  info: FileInfo
}

export function slotKey(kind: 'show' | 'episode', id: string, slot: string): string {
  return `${kind}/${id}/${slot}`
}

// File bytes, by slot; a record carries only the FileInfo read from here.
export class SlotStore {
  private slots = new Map<string, Slot>()

  async put(key: string, content: Content, now = new Date()): Promise<FileInfo> {
    const sha256 = await content.sha256()
    const info: FileInfo = {
      size: content.size,
      type: content.type,
      etag: etagOf(sha256),
      digest: reprDigest(sha256),
      modified: now.toISOString(),
    }
    this.slots.set(key, { content, info })
    return info
  }

  get(key: string): Slot | undefined {
    return this.slots.get(key)
  }

  info(key: string): FileInfo | undefined {
    return this.slots.get(key)?.info
  }

  deletePrefix(prefix: string): number {
    let count = 0
    for (const key of [...this.slots.keys()]) {
      if (key.startsWith(prefix)) {
        this.slots.delete(key)
        count++
      }
    }
    return count
  }

  get count() {
    return this.slots.size
  }
}
