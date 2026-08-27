
import { cmp } from 'jostraca'

import { requirePath } from '../utility'


// Per-language REFERENCE.md generator lives in
// `project/.sdk/src/cmp/<lang>/ReadmeRef_<lang>.ts`. Each language emits
// its own constructor signature, op spelling, and code-block fence — a
// shared template would have to inline-switch on every line.
const ReadmeRef = cmp(function ReadmeRef(props: any) {
  const { target, ctx$ } = props

  const ReadmeRef_sdk =
    requirePath(ctx$, `./cmp/${target.name}/ReadmeRef_${target.name}`, { ignore: true })

  if (ReadmeRef_sdk) {
    // The per-language component owns the REFERENCE.md File, so anything
    // appended out here lands outside it and silently vanishes. The shared
    // feature reference is therefore called from INSIDE each
    // ReadmeRef_<lang>.ts, at the end of its own features section.
    ReadmeRef_sdk['ReadmeRef']({ target })
  }
})


export {
  ReadmeRef
}
