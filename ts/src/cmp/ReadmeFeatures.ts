import { Content } from 'jostraca'
import { cmp } from '../helpers/component'

import { optionalComponent } from '../helpers/optional'
import { featureDocs, codeList, honoursActivationOrder } from './FeatureDocs'
import type { FeatureDoc } from './FeatureDocs'


const ReadmeFeatures = cmp(function ReadmeFeatures(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const override =
    optionalComponent(ctx$, target, 'ReadmeFeatures')

  if (override) {
    override['ReadmeFeatures']({ target })
    return
  }

  const features: FeatureDoc[] = featureDocs(model, target)

  if (0 === features.length) {
    return
  }

  const on = features.filter((f: FeatureDoc) => f.on).map((f: FeatureDoc) => f.name)
  const off = features.length - on.length
  const one = 1 === features.length
  const state = 0 === on.length ?
    `${one ? 'It is' : 'Each is'} **inactive until you switch it on**, so an SDK you have not
configured behaves exactly as if ${one ? 'it did not exist' : 'none of them existed'}, with no measurable overhead.` :
    `${codeList(on)} ${1 === on.length ?
      'is **on by default** and runs until you switch it off.' :
      'are **on by default** and run until you switch them off.'}${0 === off ? '' : 1 === off ?
        '\nThe other is **inactive until you switch it on**.' :
        '\nThe others are **inactive until you switch them on**.'}`

  Content(`## Features

This SDK ships ${features.length} optional feature${one ? '' : 's'}.
${state}

Activate a feature by name in the \`feature\` client option:

| Feature | What it does |
|---|---|
`)

  for (const f of features) {
    Content(`| [\`${f.name}\`](#${f.name}) | ${f.title} |
`)
  }

  Content(`
`)

  const wrapping = features.filter((f) => f.wraps).map((f) => '`' + f.name + '`')
  if (1 < wrapping.length) {
    if (honoursActivationOrder(target)) {
      Content(`> **Order matters for ${wrapping.join(', ')}.** These wrap the
> transport, so each one wraps whatever is already installed: the order you
> activate them in IS the nesting order. Activating them as an ordered list
> rather than a map is what fixes that order.

`)
    }
    else {
      Content(`> **${wrapping.join(', ')} wrap the transport**, so each one wraps
> whatever is already installed. This SDK composes them in a fixed catalog
> order, not the order you activate them in, and takes \`feature\` as a map.

`)
    }
  }

  for (const f of features) {
    Content(`### ${f.name}

${f.title}.

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

    Content(`Set \`feature.${f.name}.active\` to enable it${
      0 < f.options.length ? ', then override any of the options above' : ''}.

`)

    if (f.wraps) {
      Content(`\`${f.name}\` wraps the transport, so its position among the other
transport features decides what it sees. A feature activated later wraps one
activated earlier.

`)
    }
  }
})


export {
  ReadmeFeatures
}
