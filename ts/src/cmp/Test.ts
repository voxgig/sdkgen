
import {
  cmp, File, Content,
} from 'jostraca'

import { requirePath } from '../utility'

import { ensureStdrep } from '../helpers/stdrep'


import {
  KIT,
  getModelPath
} from '../types'


const Test = cmp(function Test(props: any) {
  const { target, ctx$ } = props
  const { model, log } = ctx$
  const stdrep = ensureStdrep(ctx$)

  const points = Object.values(model.main.kit.entity || {}).flatMap((entity: any) =>
    Object.values(entity.op || {}).flatMap((op: any) => op.points || [])) as any[]
  if (points.some(point => point.contract && JSON.parse(point.contract.json).live)) {
    const supported = ['ts', 'js'].includes(target.name)
    File({ name: 'live-coverage.json' }, () => Content(JSON.stringify({
      version: 1, target: target.name, scenarios: supported ? 'supported' : 'unsupported',
      points: points.map(point => point.contract?.id || point.method + ' ' + point.orig),
      ...(!supported ? { reason: 'This target does not yet execute declarative live recipes. Its existing tests do not establish full operation coverage.' } : {}),
    }, null, 2)))
    if (!supported) log.warn({ point: 'live-scenarios-unsupported', note: 'Declarative live recipes are not executed by target ' + target.name })
  }

  const Test_sdk = requirePath(ctx$, `./cmp/${target.name}/Test_${target.name}`)
  Test_sdk['Test']({ model, target, stdrep })

  log.info({
    point: 'generate-test', target,
    note: 'target:' + target.name
  })
})


export {
  Test
}
