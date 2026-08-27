import { cmp, Content } from 'jostraca'

import { featureDocs } from './FeatureDocs'
import type { FeatureDoc } from './FeatureDocs'


// The feature reference, appended to every REFERENCE.md.
//
// REFERENCE.md is otherwise generated per-language, because the constructor
// signature, op spelling and code fence differ. Feature CONFIGURATION does
// not: the option names and defaults are model facts, identical in every
// target. So this section is written once and appended to all of them, rather
// than copied into twenty-five ReadmeRef_<lang>.ts files where it would drift.
//
// Covers what a reference has to cover and a README does not: every option
// with its default, what the feature does at runtime, and the considerations
// — ordering, interaction, and cost — that decide whether to switch it on.
const ReadmeRefFeatures = cmp(function ReadmeRefFeatures(props: any) {
  const { ctx$ } = props
  const { model } = ctx$

  const features: FeatureDoc[] = featureDocs(model)

  if (0 === features.length) {
    return
  }

  Content(`
## Features

Features are opt-in behaviour attached to the client. Each is inactive until
switched on, and an SDK with no feature configured does no feature work at all.

Activate them in the client options. The array form is significant: several
features wrap the transport, and the order you list them in is the order they
nest.

`)

  const wrapping = features.filter((f) => f.wraps)
  const hooked = features.filter((f) => !f.wraps)

  if (0 < wrapping.length) {
    Content(`### Ordering

${wrapping.map((f) => '`' + f.name + '`').join(', ')} wrap the transport. Each
wraps whatever is already installed, so **activation order is nesting order**:
a feature activated later sits OUTSIDE one activated earlier, and sees the call
first.

That decides behaviour, not just sequence. \`cost\` activated before \`cache\`
sits inside it, so a response served from the cache never reaches \`cost\` and is
correctly charged nothing; reverse them and every cache hit is billed for money
that was never spent.

${hooked.map((f) => '`' + f.name + '`').join(', ')} attach to pipeline hooks
rather than the transport, so their order does not affect what they observe.

`)
  }

  for (const f of features) {
    Content(`### \`${f.name}\`

${f.title}.

`)

    Content(`**Configuration**

`)

    if (0 < f.options.length) {
      Content(`| Option | Default |
|---|---|
`)
      for (const o of f.options) {
        Content(`| \`${o.name}\` | \`${o.value}\` |
`)
      }
      Content(`
`)
    }
    else {
      Content(`\`active\` only — this feature takes no further options.

`)
    }

    Content(`**Usage**

Set \`feature.${f.name}.active\` to true in the client options${
  0 < f.options.length ?
    ', and override any option above in the same entry' : ''}. Every option keeps
its default unless you name it.

**Considerations**

`)

    if (f.wraps) {
      Content(`- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
`)
    }
    else {
      Content(`- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
`)
    }

    if ('base' === f.transport) {
      Content(`- Installs the BASE transport that the wrapping features wrap, so it must be
  activated before them.
`)
    }

    Content(`- Inactive by default: leaving it out costs nothing at runtime.

`)
  }
})


export {
  ReadmeRefFeatures
}
