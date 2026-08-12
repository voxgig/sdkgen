// `registerComponent` — add a per-target component of your own.
//
// WHY THIS EXISTS
//
// Every built-in resolves its per-language half by convention:
// `Main` loads `cmp/<target>/Main_<target>`, `Test` loads
// `cmp/<target>/Test_<target>`, and `ReadmeTop` loads
// `cmp/<target>/ReadmeTopQuick_<target>` with `{ ignore: true }` so a target
// that has not implemented it is simply skipped.
//
// A PROJECT had no way into that mechanism. voxgig-solardemo-sdk wanted a
// per-target `AGENTS.md` and had to hand-wire the dispatch in its own
// `Root.ts`:
//
//   if ('ts' === target.name) { AgentsTs({ target }) }
//   else if ('go' === target.name) { AgentsGo({ target }) }
//
// which duplicates the internal dispatch, does not scale past a couple of
// targets, and — because the branches live inline in Root.ts — is exactly
// what stops a project's root wiring from being resynced with the scaffold.
//
// With this, the same thing is one line and target-agnostic:
//
//   const Agents = registerComponent('Agents')
//   ...
//   Agents({ target })
//
// resolving `cmp/<target>/Agents_<target>` and doing nothing for a target
// that has no such file. `doctor` reports those files as ADDITIVE — the
// project's own work — rather than as drift.

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
