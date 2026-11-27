
import { getprop } from './utility/StructUtility'


class Control {
  throw?: boolean
  err?: any
  explain?: any
  // Cancels the request in flight, which ts and js alone do so far.
  signal?: AbortSignal
  // Set by an entity's binary handle: the slot and the direction its bytes move.
  transfer?: { slot: string, direction: 'read' | 'write', bytes?: Uint8Array }

  constructor(ctrlmap: Record<string, any>) {
    this.throw = getprop(ctrlmap, 'throw')
    this.err = getprop(ctrlmap, 'err')
    this.explain = getprop(ctrlmap, 'explain')
    this.signal = getprop(ctrlmap, 'signal')
    this.transfer = getprop(ctrlmap, 'transfer')
  }
}


export {
  Control,
}
