import Path from 'node:path'

import { KIT } from '@voxgig/apidef'

import { fact } from './facts'
import { SdkGenError } from '../utility'


type Consumed = {
  name: string
  path: string
  dir: string
  away: boolean
  url: string
}


// The installed target a consumer builds on. `path` leads to it from the
// consumer's folder, given `sdkrel`, the way back from there to the project.
// `dir` is its folder when both share a repository, else ''. `away` says it
// is generated into a repository of its own, whose address the model may give
// as `url`.
function consumedTarget(model: any, target: any, sdkrel: string): Consumed {
  const kit = model.main[KIT]
  const name: string = fact(target, 'consumes')

  if ('' === name) {
    const wraps: string = fact(target, 'wraps')
    throw new SdkGenError('Target "' + target.name + '" builds on the `' + wraps +
      '` target, and the model has none. Run `voxgig-sdkgen target add ' + wraps +
      '`, then regenerate.')
  }

  const local = kit.target?.[name]
  const away = (fact(kit, 'external') as any[]).find((ext: any) => name === ext.name)

  if (null == away && (null == local || false === local.active)) {
    throw new SdkGenError('Target "' + target.name + '" builds on the `' + name +
      '` target, which the model switches off. Remove its `active: false`, or ' +
      'switch "' + target.name + '" off too.')
  }

  const dir = String(null == away ? fact(local, 'dir') : away.dir)
  const shared = null == away && 'external' !== fact(target, 'place')

  return {
    name,
    path: Path.posix.isAbsolute(dir) ? dir : Path.posix.join(sdkrel, dir),
    dir: shared ? dir : '',
    away: null != away,
    url: null == away ? '' : away.url,
  }
}


export type {
  Consumed,
}

export {
  consumedTarget,
}
