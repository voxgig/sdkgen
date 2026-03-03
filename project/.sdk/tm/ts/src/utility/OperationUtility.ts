
import { Operation } from '../types'


function makeOperation(opmap: Record<string, any>) {
  return new Operation(opmap)
}



export {
  makeOperation,
}
