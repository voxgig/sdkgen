// The Root for a target that generates OUTSIDE the SDK repo
// (`main: kit: target: <t>: output: path`).
//
// WHY THIS EXISTS, rather than a folder name
//
// A target's files normally land in `<sdk-repo>/<target>/`, which the
// consumer's own `Root.ts` arranges with `Folder({ name: target.name })`.
// Two things stop that reaching a sibling repo:
//
//   - jostraca REFUSES a `..` segment in a Folder name (FileHandler.validName
//     throws). Escaping the output root through a folder name is not an
//     oversight to work around; it is the guard that keeps generation inside
//     the tree it was pointed at.
//   - the output root is `jopts.folder`, per generate() CALL. So writing
//     somewhere else means another call, not another folder.
//
// So an out-of-tree target gets its own generate() pass, rooted at its
// output path, with this as the Root. It renders ONE target and nothing
// else: the consumer Root also emits the SDK repo's own furniture (its
// README, AGENTS.md, the build scaffold), and none of that belongs in a
// separate package's repo.
//
// No Folder wraps the target here — the destination IS the package, so its
// files go at the root of the output path.
//
// The phase gate mirrors the consumer Root exactly, so `output.path` is not
// a consumer-target feature: point a language target at another repo and it
// generates there the same way it would in-tree.

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
  const { model, target, cmpfolder } = props
  const ctx$ = props.ctx$

  ctx$.model = model

  // Components live in the PROJECT, not in the repo being written to. This
  // pass has retargeted jostraca's output folder, which is what requirePath
  // otherwise resolves against — see utility.resolvePath.
  ctx$.cmpfolder = cmpfolder

  // The same model preamble the consumer's Root.ts performs before it renders
  // anything: the case-variant name constants (`Name`, `NAME`, ...) and the
  // ProjectName replacement map that every template substitution reads.
  //
  // Done HERE rather than relied upon, because this pass gets the model the
  // in-tree pass never touched — Root mutates the filtered copy it is handed,
  // not this one — and because an SDK project with only out-of-tree targets
  // must generate the same way as one with both.
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
      each(entity, (entity: any) => {
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
