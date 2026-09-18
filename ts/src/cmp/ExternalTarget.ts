
import { cmp, each, names } from 'jostraca'

import { Project } from 'jostraca'

import { KIT } from '@voxgig/apidef'

import { Main } from './Main'
import { Entity } from './Entity'
import { Feature } from './Feature'
import { Readme } from './Readme'
import { Test } from './Test'
import { AgentGuide } from './AgentGuide'


const ExternalTarget = cmp(function ExternalTarget(props: any) {
  const { model, target, cmpfolder, sdkrelpath } = props
  const ctx$ = props.ctx$

  ctx$.model = model

  // Components live in the PROJECT, not in the repo being written to. This
  // pass has retargeted jostraca's output folder, which is what requirePath
  // otherwise resolves against — see utility.resolvePath.
  ctx$.cmpfolder = cmpfolder

  // The path from the destination back to the SDK project, for a target whose
  // output sits beside the SDK in a known layout.
  ctx$.sdkrelpath = sdkrelpath

  model.const = model.const || { name: model.name }
  names(model.const, model.name)
  if (null == model.const.year) {
    model.const.year = new Date().getFullYear()
  }
  names(model, model.name)

  ctx$.stdrep = ctx$.stdrep || {}
  names(ctx$.stdrep, model.Name, 'Project' + 'Name')

  const entity = model.main[KIT].entity || {}
  const feature = model.main[KIT].feature || {}

  // Defaults are inclusive: a phase runs unless the target's model turns it
  // off. Consumer targets (go-cli, go-mcp, py-data, seneca-provider) switch
  // every phase off and emit everything from Main.
  const phase = target.phase || {}
  const phaseActive = (name: string): boolean =>
    false !== (phase[name] && phase[name].active)

  Project({}, () => {
    names(target, target.name)

    if (phaseActive('entity')) {
      each(entity).filter((entity: any) => entity.active).map((entity: any) => {
        names(entity, entity.name)
        Entity({ target, entity })
      })
    }

    if (phaseActive('feature')) {
      each(feature)
        .filter((feature: any) => feature.active)
        .map((feature: any) => {
          names(feature, feature.name)
          Feature({ target, feature })
        })
    }

    Main({ target })

    if (phaseActive('readme')) {
      Readme({ target })
    }

    if (phaseActive('agentguide')) {
      AgentGuide({ target })
    }

    if (phaseActive('test')) {
      Test({ target })
    }
  })
})


export {
  ExternalTarget,
}
