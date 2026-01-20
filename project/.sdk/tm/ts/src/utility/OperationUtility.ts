
import { Operation } from '../types'

import { getprop } from './StructUtility'


function makeOperation(opmap: Record<string, any>) {

  const op: Operation = {
    name: getprop(opmap, 'name', '_'),
    entity: getprop(opmap, 'entity', '_'),
    select: getprop(opmap, 'select', '_'),
    alts: getprop(opmap, 'alts', []),
  }

  return op
}



export {
  makeOperation,
}
