import { cmp, Content } from 'jostraca'

import { featureDocs, honoursActivationOrder } from './FeatureDocs'
import type { FeatureDoc } from './FeatureDocs'


const ReadmeRefFeatures = cmp(function ReadmeRefFeatures(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const features: FeatureDoc[] = featureDocs(model, target)

  if (0 === features.length) {
    return
  }

  // Emitted INSIDE the per-language `## Features` section, after its summary
  // table and activation snippet, so these are subsections of it rather than
  // a competing heading.
  Content(`
### Configuring features

Each feature is inactive until switched on, and an SDK with no feature
configured does no feature work at all. Every option below keeps its default
unless you name it.

${honoursActivationOrder(target) ?
  'The array form of \\`feature\\` is significant: several features wrap the\ntransport, and the order you list them in is the order they nest.' :
  'This SDK takes \\`feature\\` as a map and composes the transport-wrapping\nfeatures in a fixed catalog order, so activation order does not change\nnesting here.'}

`)

  const wrapping = features.filter((f) => f.wraps)
  const hooked = features.filter((f) => !f.wraps)

  if (0 < wrapping.length) {
    Content(`#### Ordering

${wrapping.map((f) => '`' + f.name + '`').join(', ')} wrap the transport. Each
wraps whatever is already installed${honoursActivationOrder(target) ?
  ', so **activation order is nesting order**:\na feature activated later sits OUTSIDE one activated earlier, and sees the call\nfirst.' :
  '. This SDK fixes that order in its own\ncatalog rather than taking it from the caller.'}

${(features.some((f) => 'cost' === f.name) && features.some((f) => 'cache' === f.name)) ?
`That decides behaviour, not just sequence. \\\`cost\\\` activated before \\\`cache\\\`
sits inside it, so a response served from the cache never reaches \\\`cost\\\` and is
correctly charged nothing; reverse them and every cache hit is billed for money
that was never spent.
` : `That decides behaviour, not just sequence: a feature that short-circuits the
call, such as a cache serving a hit, stops every feature nested inside it from
ever seeing that call.
`}
${hooked.map((f) => '`' + f.name + '`').join(', ')} attach to pipeline hooks
rather than the transport, so their order does not affect what they observe.

`)
  }

  for (const f of features) {
    Content(`#### \`${f.name}\`

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
    else if (0 === f.extras.length) {
      Content(`\`active\` only — this feature takes no further options.

`)
    }

    if (0 < f.extras.length) {
      Content(`| Option | Type |
|---|---|
`)
      for (const o of f.extras) {
        Content(`| \`${o.name}\` | ${o.type} |
`)
      }
      Content(`
These take no default: the feature behaves one way when you supply them and
another when you do not.

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
