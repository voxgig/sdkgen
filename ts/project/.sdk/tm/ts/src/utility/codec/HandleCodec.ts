import { RAW_BODY } from '../MediaUtility'


// A slot the entity component derived from the model: the action whose
// points move its bytes ('' for the entity's own), and the operations that
// read and write them.
type BinarySlotDef = {
  action: string
  read?: string
  write?: string
}


type HandleControl = Record<string, any>


// An entity's named bytes. Each call is one run of the entity's own
// operation on the slot's point; in core only whole, in-memory bodies move.
class BinaryHandle<E = any> {
  #entity: any
  #slot: string
  #def?: BinarySlotDef

  constructor(entity: E, slots: Record<string, BinarySlotDef>, slot?: string) {
    this.#entity = entity
    this.#slot = null == slot ? '' : String(slot)
    this.#def = Object.prototype.hasOwnProperty.call(slots, this.#slot) ?
      slots[this.#slot] : undefined
  }

  get name(): string {
    return this.#slot
  }

  // The whole body, within maxBuffer.
  async bytes(opts?: { range?: any }, ctrl?: HandleControl): Promise<Uint8Array> {
    if (null != opts?.range) {
      throw this.#inactive('a range')
    }
    const def = this.#direction('read')
    const transfer: Record<string, any> = { slot: this.#slot, direction: 'read' }
    await this.#entity[def.read as string](this.#select(def), { ...(ctrl || {}), transfer })
    return transfer.bytes ?? new Uint8Array(0)
  }

  // Sends in-memory content as the slot's body; resolves to the entity.
  async put(source: any, ctrl?: HandleControl): Promise<E> {
    const def = this.#direction('write')
    const transfer = { slot: this.#slot, direction: 'write' }
    await this.#entity[def.write as string]({ ...this.#select(def), [RAW_BODY]: source },
      { ...(ctrl || {}), transfer })
    return this.#entity
  }

  async save(..._args: any[]): Promise<never> {
    throw this.#inactive('save')
  }

  stream(..._args: any[]): never {
    throw this.#inactive('stream')
  }

  async open(..._args: any[]): Promise<never> {
    throw this.#inactive('open')
  }

  #select(def: BinarySlotDef): Record<string, any> {
    return '' === def.action ? {} : { $action: def.action }
  }

  #direction(way: 'read' | 'write'): BinarySlotDef {
    const def = this.#def
    if (null == def) {
      throw this.#error('binary_slot_unknown', 'Entity "' + this.#entity.name +
        '" has no binary slot "' + this.#slot + '".')
    }
    if (null == def[way]) {
      throw this.#error('binary_slot_direction', 'The binary slot "' + this.#slot +
        '" of entity "' + this.#entity.name + '" cannot be ' +
        ('read' === way ? 'read' : 'written') + '.')
    }
    return def
  }

  #inactive(what: string): Error {
    return this.#error('binary_feature_inactive', 'The binary slot "' + this.#slot +
      '" of entity "' + this.#entity.name + '" cannot ' +
      ('a range' === what ? 'read a range' : what) +
      ' without the binary feature; in core it answers bytes() and put().')
  }

  #error(code: string, msg: string): Error {
    return this.#entity._entctx.error(code, msg)
  }
}


export {
  BinaryHandle,
}

export type {
  BinarySlotDef,
}
