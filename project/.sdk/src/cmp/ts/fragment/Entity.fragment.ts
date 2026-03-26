
import { inspect } from 'node:util'

import {
  ProjectNameSDK,
  ProjectNameEntityBase,
} from '../ProjectNameSDK'


import type {
  Operation,
  Context,
  Control,
} from '../types'


// TODO: needs Entity superclass
class EntityNameEntity extends ProjectNameEntityBase {

  constructor(client: ProjectNameSDK, entopts: any) {
    super(client, entopts)
  }


  make(this: EntityNameEntity) {
    return new EntityNameEntity(this._client, this.entopts())
  }


  // #LoadOp

  // #ListOp

  // #CreateOp

  // #UpdateOp

  // #RemoveOp

}


export {
  EntityNameEntity
}
