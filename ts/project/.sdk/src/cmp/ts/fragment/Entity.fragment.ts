
import { inspect } from 'node:util'

import { ProjectNameEntityBase } from '../ProjectNameEntityBase'

import type {
  ProjectNameSDK,
} from '../ProjectNameSDK'


import type {
  Operation,
  Context,
  Control,
} from '../types'

// #TypeImports

// #BinaryImport


class EntyClass extends ProjectNameEntityBase<EntityDataType> {

  constructor(client: ProjectNameSDK, entopts: any) {
    super(client, entopts)
    this.name = 'entityname'
    this.name_ = 'entityname'
    this.Name = 'EntityName'
  }


  make(this: EntyClass) {
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


export {
  EntyClass
}
