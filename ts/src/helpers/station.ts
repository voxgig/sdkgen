
import { each } from 'jostraca'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { SdkGenError } from '../utility'

import type { SdkModel, ModelFeature } from '../types'


function stationLibrary(model: SdkModel, targetName: string): string | undefined {
  const feature = getModelPath(model, `main.${KIT}.feature`,
    { required: false }) || {}

  const station: ModelFeature | undefined = feature.station
  if (null == station) { return undefined }

  const deps = station.deps?.[targetName]
  if (null == deps) { return undefined }

  // Feature deps count only when explicitly active — collectDeps semantics,
  // so the require target is exactly the set the manifest carries.
  const names = each(deps)
    .filter((dep: any) => true === dep?.active)
    .map((dep: any) => dep?.key$)
    .filter((name: any) => null != name && '' !== name)

  if (0 === names.length) { return undefined }

  if (1 < names.length) {
    throw new SdkGenError(
      'station: feature `station` declares ' + names.length + ' active ' +
      'dependencies for target `' + targetName + '` (' +
      names.map(String).sort().join(', ') + '), so the station library to ' +
      'register with is ambiguous. Declare exactly one active dep per ' +
      'target in the feature model, or mark which one is the library.')
  }

  return String(names[0])
}


export {
  stationLibrary,
}
