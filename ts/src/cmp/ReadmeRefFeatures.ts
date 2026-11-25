import { Content } from 'jostraca'
import { cmp } from '../helpers/component'

import { featureDocs, codeList, honoursActivationOrder } from './FeatureDocs'
import type { FeatureDoc } from './FeatureDocs'
import { originName } from '../helpers/packageMeta'


const ReadmeRefFeatures = cmp(function ReadmeRefFeatures(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const features: FeatureDoc[] = featureDocs(model, target)

  if (0 === features.length) {
    return
  }

  const on = features.filter((f: FeatureDoc) => f.on).map((f: FeatureDoc) => f.name)
  const ordered = honoursActivationOrder({ name: originName(model, target.name) })
  const wrapping = features.filter((f) => f.wraps)
  const hooked = features.filter((f) => 'none' === f.transport)
  // Order decides nothing until one wrapping feature sits inside another.
  const nests = 1 < wrapping.length

  // Emitted INSIDE the per-language `## Features` section, after its summary
  // table and activation snippet, so these are subsections of it rather than
  // a competing heading.
  Content(`
### Configuring features

${0 === on.length ? `Each feature is inactive until switched on, and an SDK with no feature
configured does no feature work at all.` : `${codeList(on)} ${1 === on.length ? 'is' : 'are'} active by default${
  on.length < features.length ? '; every other feature is inactive until switched on' : ''}.`}
Every option below keeps its default unless you name it.

${!nests ? '' : (ordered ?
  'The array form of `feature` is significant: several features wrap the\ntransport, and the order you list them in is the order they nest.' :
  'This SDK takes `feature` as a map and composes the transport-wrapping\nfeatures in a fixed catalog order, so activation order does not change\nnesting here.') + '\n\n'}`)

  if (nests) {
    const hookedNames = hooked.map((f) => '`' + f.name + '`').join(', ')
    const hookedLine = 0 === hooked.length ? '' : '\n' + hookedNames + (1 === hooked.length ?
      ' attaches to pipeline hooks\nrather than the transport, so its order does not affect what it observes.\n' :
      ' attach to pipeline hooks\nrather than the transport, so their order does not affect what they observe.\n')
    Content(`#### Ordering

${wrapping.map((f) => '`' + f.name + '`').join(', ')} wrap the transport. Each
wraps whatever is already installed${ordered ?
  ', so **activation order is nesting order**:\na feature activated later sits OUTSIDE one activated earlier, and sees the call\nfirst.' :
  '. This SDK fixes that order in its own\ncatalog rather than taking it from the caller.'}

${(features.some((f) => 'cost' === f.name) && features.some((f) => 'cache' === f.name)) ?
`That decides behaviour, not just sequence. \\\`cost\\\` activated before \\\`cache\\\`
sits inside it, so a response served from the cache never reaches \\\`cost\\\` and is
correctly charged nothing; reverse them and every cache hit is billed for money
that was never spent.
` : `That decides behaviour, not just sequence: a feature that short-circuits the
call${features.some((f) => 'cache' === f.name) ? ', such as a cache serving a hit,' : ''} stops every feature nested inside it from
ever seeing that call.
`}${hookedLine}
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
        Content(`| \`${o.name}\` | ${o.code} |
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
      Content(nests ? `- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
` : `- Wraps the transport.
`)
    }

    if ('base' === f.transport) {
      Content(`- Installs the BASE transport that the wrapping features wrap, so it must be
  activated before them.
`)
    }

    if ('none' === f.transport) {
      Content(`- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
`)
    }
    else if (0 < f.hooks.length) {
      Content(`- Also attaches to pipeline hooks.
`)
    }

    Content(`- ${f.on ? `Active by default: set \`feature.${f.name}.active\` to false to switch it off.` :
      'Inactive by default: leaving it out costs nothing at runtime.'}

`)
  }
})


export {
  ReadmeRefFeatures
}
