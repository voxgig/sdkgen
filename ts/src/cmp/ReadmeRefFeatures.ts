import { Content } from 'jostraca'
import { cmp } from '../helpers/component'
import { mdCell, mdCodeCell } from '../helpers/markdown'

import { activeByDefault, featureDocs, honoursActivationOrder } from './FeatureDocs'
import type { FeatureDoc } from './FeatureDocs'


const ReadmeRefFeatures = cmp(function ReadmeRefFeatures(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const features: FeatureDoc[] = featureDocs(model, target)

  if (0 === features.length) {
    return
  }

  const onByDefault = activeByDefault
  const on = features.filter(onByDefault).map((f) => '`' + f.name + '`')

  // By the transport each declares: a wrapper, the base transport the
  // wrappers wrap, or none; only the last are order-free hook features.
  const has = (name: string): boolean => features.some((f) => name === f.name)
  const wrapping = features.filter((f) => f.wraps)
  const hooked = features.filter((f) => 'none' === f.transport && 0 < f.hooks.length)
  const names = (fs: FeatureDoc[]): string => fs.map((f) => '`' + f.name + '`').join(', ')
  // Nesting needs two wrappers; with one there is no order to speak of.
  const nests = 1 < wrapping.length
  const ordered = honoursActivationOrder(target)

  // Emitted INSIDE the per-language `## Features` section, after its summary
  // table and activation snippet, so these are subsections of it rather than
  // a competing heading.
  Content(`
### Configuring features

${0 === on.length ? `Each feature is inactive until switched on, and an SDK with no feature
configured does no feature work at all.` : `Each feature is inactive until switched on, except ${on.join(', ')}, which
${1 === on.length ? 'runs' : 'run'} unless disabled.`} Every option below keeps its default
unless you name it.

${!nests ? '' : ordered ?
  'The array form of `feature` is significant: several features wrap the\ntransport, and the order you list them in is the order they nest.\n\n' :
  'This SDK takes `feature` as a map and composes the transport-wrapping\nfeatures in a fixed catalog order, so activation order does not change\nnesting here.\n\n'}`)

  if (0 < wrapping.length) {
    Content(`#### Ordering

${nests ? `${names(wrapping)} wrap the transport. Each
wraps whatever is already installed${ordered ?
  ', so **activation order is nesting order**:\na feature activated later sits OUTSIDE one activated earlier, and sees the call\nfirst.' :
  '. This SDK fixes that order in its own\ncatalog rather than taking it from the caller.'}

${(has('cost') && has('cache')) ?
`That decides behaviour, not just sequence. \`cost\` activated before \`cache\`
sits inside it, so a response served from the cache never reaches \`cost\` and is
correctly charged nothing; reverse them and every cache hit is billed for money
that was never spent.
` : `That decides behaviour, not just sequence: a feature that short-circuits the
call${has('cache') ? ', such as a cache serving a hit,' : ''} stops every feature nested inside it from
ever seeing that call.
`}` : `${names(wrapping)} is the one feature that wraps the transport: it wraps
whatever transport is installed.
`}
${0 === hooked.length ? '' : 1 === hooked.length ?
  `${names(hooked)} attaches to pipeline hooks\nrather than the transport, so its order does not affect what it observes.\n\n` :
  `${names(hooked)} attach to pipeline hooks\nrather than the transport, so their order does not affect what they observe.\n\n`}`)
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
        Content(`| ${mdCodeCell(o.name)} | ${mdCodeCell(o.value)} |
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
        Content(`| ${mdCodeCell(o.name)} | ${mdCell(o.type)} |
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
      if (0 < f.hooks.length) {
        Content(`- Also attaches to pipeline hooks.
`)
      }
    }
    else if ('none' === f.transport && 0 < f.hooks.length) {
      Content(`- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
`)
    }

    if ('base' === f.transport) {
      Content(`- Installs the BASE transport that the wrapping features wrap, so it must be
  activated before them.
`)
    }

    Content(onByDefault(f)
      ? '- Active by default: set `active: false` to switch it off.\n\n'
      : '- Inactive by default: leaving it out costs nothing at runtime.\n\n')
  }
})


export {
  ReadmeRefFeatures
}
