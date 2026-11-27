
const { inspect } = require('node:util')

const { ProjectNameEntityBase } = require('../ProjectNameEntityBase')

// #BinaryImport


// TODO: needs Entity superclass
class EntyClass extends ProjectNameEntityBase {

  constructor(client, entopts) {
    super(client, entopts)
    this.name = 'entityname'
    this.name_ = 'entityname'
    this.Name = 'EntityName'
  }


  make() {
    return new EntyClass(this._client, this.entopts())
  }

  // #BinarySlot


  // #LoadOp

  // #ListOp

  // #CreateOp

  // #UpdateOp

  // #PatchOp

  // #RemoveOp

}


module.exports = {
  EntyClass
}
