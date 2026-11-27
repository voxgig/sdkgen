
const { getprop } = require('./utility/StructUtility')


class Control {
  constructor(ctrlmap) {
    this.throw = getprop(ctrlmap, 'throw')
    this.err = getprop(ctrlmap, 'err')
    this.explain = getprop(ctrlmap, 'explain')
    this.signal = getprop(ctrlmap, 'signal')
    // Set by an entity's binary handle: the slot and the direction its bytes move.
    this.transfer = getprop(ctrlmap, 'transfer')
  }
}


module.exports = {
  Control,
}
