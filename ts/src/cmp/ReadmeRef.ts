
import { cmp } from 'jostraca'

import { requirePath } from '../utility'
import { ReadmeRefFeatures } from './ReadmeRefFeatures'


// Per-language REFERENCE.md generator lives in
// `project/.sdk/src/cmp/<lang>/ReadmeRef_<lang>.ts`. Each language emits
// its own constructor signature, op spelling, and code-block fence — a
// shared template would have to inline-switch on every line.
const ReadmeRef = cmp(function ReadmeRef(props: any) {
  const { target, ctx$ } = props

  const ReadmeRef_sdk =
    requirePath(ctx$, `./cmp/${target.name}/ReadmeRef_${target.name}`, { ignore: true })

  if (ReadmeRef_sdk) {
    ReadmeRef_sdk['ReadmeRef']({ target })

    // Appended to the per-language reference: feature configuration is a
    // model fact, identical in every target, so it is written once here.
    ReadmeRefFeatures({ target })
  }
})


export {
  ReadmeRef
}
