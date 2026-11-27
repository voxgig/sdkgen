const { RAW_BODY } = require('../MediaUtility')


// An entity's named bytes. Each call is one run of the entity's own
// operation on the slot's point; in core only whole, in-memory bodies move.
// A slot, as the entity component derived it from the model, is the action
// whose points move its bytes ('' for the entity's own) and the operations
// that read and write them: `{ action, read?, write? }`.
class BinaryHandle {
  #entity
  #slot
  #def

  constructor(entity, slots, slot) {
    this.#entity = entity
    this.#slot = null == slot ? '' : String(slot)
    this.#def = Object.prototype.hasOwnProperty.call(slots, this.#slot) ?
      slots[this.#slot] : undefined
  }

  get name() {
    return this.#slot
  }

  // The whole body, within maxBuffer.
  async bytes(opts, ctrl) {
    if (null != opts?.range) {
      throw this.#inactive('a range')
    }
    const def = this.#direction('read')
    const transfer = { slot: this.#slot, direction: 'read' }
    await this.#entity[def.read](this.#select(def), { ...(ctrl || {}), transfer })
    return transfer.bytes ?? new Uint8Array(0)
  }

  // Sends in-memory content as the slot's body; resolves to the entity.
  async put(source, ctrl) {
    const def = this.#direction('write')
    const transfer = { slot: this.#slot, direction: 'write' }
    await this.#entity[def.write]({ ...this.#select(def), [RAW_BODY]: source },
      { ...(ctrl || {}), transfer })
    return this.#entity
  }

  async save(..._args) {
    throw this.#inactive('save')
  }

  stream(..._args) {
    throw this.#inactive('stream')
  }

  async open(..._args) {
    throw this.#inactive('open')
  }

  #select(def) {
    return '' === def.action ? {} : { $action: def.action }
  }

  #direction(way) {
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

  #inactive(what) {
    return this.#error('binary_feature_inactive', 'The binary slot "' + this.#slot +
      '" of entity "' + this.#entity.name + '" cannot ' +
      ('a range' === what ? 'read a range' : what) +
      ' without the binary feature; in core it answers bytes() and put().')
  }

  #error(code, msg) {
    return this.#entity._entctx.error(code, msg)
  }
}


module.exports = {
  BinaryHandle,
}
