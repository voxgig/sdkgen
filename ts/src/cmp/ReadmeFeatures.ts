import { cmp, Content } from 'jostraca'

import { requirePath } from '../utility'
import { featureDocs, honoursActivationOrder } from './FeatureDocs'
import type { FeatureDoc } from './FeatureDocs'


// The `## Features` section of a target README: one subsection per feature
// the SDK actually ships.
//
// WHY IT IS SHARED AND NOT PER-LANGUAGE. Every target activates features the
// same way — a `feature` entry in the client options — and the options and
// their defaults come from the model, so the substance is identical in all
// twenty-five languages. Only the literal syntax of the options map differs,
// and that is already shown once, in the Options section above. A per-target
// `ReadmeFeatures_<lang>.ts` may override this to add idiomatic snippets;
// none is required for the section to be correct.
const ReadmeFeatures = cmp(function ReadmeFeatures(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const override =
    requirePath(ctx$, `./cmp/${target.name}/ReadmeFeatures_${target.name}`, { ignore: true })

  if (override) {
    override['ReadmeFeatures']({ target })
    return
  }

  const features: FeatureDoc[] = featureDocs(model, target)

  if (0 === features.length) {
    return
  }

  Content(`## Features

This SDK ships ${features.length} optional features. Each is **inactive until you
switch it on**, so an SDK you have not configured behaves exactly as if none of
them existed — no retries, no cache, no logging, no measurable overhead.

Activate a feature by name in the client options, alongside the options shown
above:

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
