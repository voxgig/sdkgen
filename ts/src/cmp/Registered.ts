
import { cmp } from 'jostraca'

import { requirePath } from '../utility'

import { ensureStdrep } from '../helpers/stdrep'


type RegisterOptions = {
  // Exported member to call. Defaults to the component name, matching every
  // built-in (`Main_go.ts` exports `Main`).
  export?: string

  // Whether a target without the component is skipped (the default, matching
  // ReadmeTop's optional per-target parts) or is an error.
  optional?: boolean
}


function registerComponent(name: string, options: RegisterOptions = {}) {
  const member = options.export || name
  const optional = false !== options.optional

  return cmp(function Registered(props: any) {
    const { target, ctx$ } = props
    const { model, log } = ctx$

    const stdrep = ensureStdrep(ctx$)

    const mod: any = requirePath(
      ctx$, `./cmp/${target.name}/${name}_${target.name}`, { ignore: optional })

    if (null == mod) {
      log.debug({
        point: 'generate-registered-absent', component: name, target: target.name,
        note: name + ': not implemented for ' + target.name
      })
      return
    }

    const fn = mod[member]

    if ('function' !== typeof fn) {
      log.warn({
        point: 'generate-registered-noexport', component: name,
        target: target.name, member,
        note: name + '_' + target.name + ' does not export ' + member
      })
      return
    }

    // Same call shape as the built-ins, plus whatever the caller passed —
    // so a registered component is written exactly like Main_<lang>.
    fn({ ...props, model, target, stdrep })

    log.info({
      point: 'generate-registered', component: name, target: target.name,
      note: name + ': target:' + target.name
    })
  })
}


export type {
  RegisterOptions,
}

export {
  registerComponent,
}
