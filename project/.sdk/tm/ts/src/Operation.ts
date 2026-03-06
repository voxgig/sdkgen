
import { getprop } from './utility/StructUtility'

import { Alt } from './Alt'


class Operation {
  entity: string
  name: string
  select: string
  alts: Alt[]

  constructor(opmap: Record<string, any>) {
    this.entity = getprop(opmap, 'entity', '_')
    this.name = getprop(opmap, 'name', '_')
    this.select = getprop(opmap, 'select', '_')
    this.alts = getprop(opmap, 'alts', [])
  }
}


export {
  Operation,
}
