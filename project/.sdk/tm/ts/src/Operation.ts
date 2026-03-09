
import { getprop } from './utility/StructUtility'

import { Target } from './Target'


class Operation {
  entity: string
  name: string
  select: string
  targets: Target[]

  constructor(opmap: Record<string, any>) {
    this.entity = getprop(opmap, 'entity', '_')
    this.name = getprop(opmap, 'name', '_')
    this.select = getprop(opmap, 'select', '_')
    this.targets = getprop(opmap, 'targets', [])
  }
}


export {
  Operation,
}
