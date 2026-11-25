
import { Content, File } from 'jostraca'
import { cmp } from '../helpers/component'

import { optionalComponent } from '../helpers/optional'
import { fact } from '../helpers/facts'
import { apiName } from '../helpers/packageMeta'

import {
  activeFeatures,
  projectName,
  langCmd,
  langCommandsBlock,
  claudePointer,
  featuresEnabled,
  isDirLayout,
  featureTemplates,
  writesFeatureGuides,
  featureHooks,
  regenerationStatement,
  copiesStatement,
} from './AgentGuideContent'

import { AgentGuideFeature } from './AgentGuideFeature'


// Per-language agent guide. Emitted inside the ambient target folder (the Root
// enters `Folder({ name: target.name })` before calling this, exactly as for
// Readme), so it lands at `<lang>/AGENTS.md`. Then it drives the co-located
// per-feature guides for this target.
const AgentGuide = cmp(function AgentGuide(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const Name = projectName(model)
  const lang = target.name
  const title = fact(target, 'title')
  const surface = langCmd(lang, model).note

  const features = activeFeatures(model, target)
  const featuresOn = featuresEnabled(target)
  const dirLayout = isDirLayout(target)

  const place = fact(target, 'place')
  const guide = fact(target, 'link').agents
  const sdk = 'folder' === place ? '../.sdk' : 'root' === place ? '.sdk' :
    null == ctx$.sdkrelpath ? '' : ctx$.sdkrelpath + '/.sdk'
  const pathNote = 'folder' === place ?
    `> Paths below (\`.sdk/…\`) are relative to the **project root** — one level up
> from this \`${lang}/\` directory.

` : 'external' === place ? `> Paths below (\`.sdk/…\`) are relative to the SDK project that generates
> this package.

` : ''

  File({ name: 'AGENTS.md' }, () => {
    Content(`# ${Name} ${title} — Agent Guide

${surface
  ? surface + '\n\nGenerated from the shared model' +
    ('' === guide ? '.' : `; see the [project guide](${guide}) for the full workflow.`)
  : `The ${title} client for the ${apiName(model)} API. This directory is **generated** — do not edit it by hand; change the model/template/component in \`.sdk/\` and regenerate.` +
    ('' === guide ? '' : ` See the [project guide](${guide}) for the full workflow and the aontu model language.`)}

${pathNote}## Regenerate this target

${'' === sdk ? 'From the SDK project\'s `.sdk/` directory:\n\n' : ''}\`\`\`bash
${'' === sdk ? '' : 'cd ' + sdk + '\n'}npm run build        # only if you changed a component
npm run generate     # refreshes this ${'folder' === place ? lang + '/ directory' : 'target'}
\`\`\`

${regenerationStatement()}

Then build and test the generated output:

${langCommandsBlock(lang, model)}

## What generates this target

| Source | Path | Edit when… |
| --- | --- | --- |
| Target definition | \`.sdk/model/target/${lang}.aontu\` | deps, module, extension, phases change |
| Templates | \`.sdk/tm/${lang}/\` | the file is the **same for every API** (runtime, transport, base classes) — copied verbatim with placeholder substitution |
| Components | \`.sdk/src/cmp/${lang}/\` | the file's shape **depends on the API** (entities, constructor, README, tests) — TypeScript that walks the model |

Decision rule: *same for every API → template; depends on the API →
component.* After editing a component run \`npm run build\` before
\`npm run generate\`; template-only edits just need \`npm run generate\`.
${copiesStatement(model)}

`)

    if (featuresOn && 0 < features.length) {
      Content(`## Features in this target

`)
      if (dirLayout) {
        features.forEach((f: any) => {
          const t = f.title ? ' — ' + f.title : ''
          Content(`- [\`${f.name}\`](./src/feature/${f.name}/AGENTS.md)${t}
`)
        })
        Content(`
Each feature's runtime and its own guide live in \`src/feature/<name>/\`.

`)
      }
      else {
        const templates = featureTemplates(ctx$.fs(), target, features)
        const shared = 0 === Object.keys(templates).length
        Content(`Each feature's hooks and default activation come from
\`.sdk/model/feature/<name>.aontu\`. ${shared
  ? `This target has no template per
feature: customise its features in the runtime under \`.sdk/tm/${lang}/\`
and regenerate.`
  : `Its runtime is generated from the template
listed here: customise that and regenerate.`}

| Feature | ${shared ? '' : 'Template | '}Active hooks |
| --- | ${shared ? '' : '--- | '}--- |
`)
        features.forEach((f: any) => {
          const template = templates[f.name]
          const hooks = featureHooks(f)
          const hookList = hooks.length ? hooks.map((h: string) => '\`' + h + '\`').join(', ') : '—'
          const label = f.title ? `**${f.name}** — ${f.title}` : `**${f.name}**`
          const where = shared ? '' :
            (null == template ? '—' : '\`.sdk/tm/' + lang + '/' + template + '\`') + ' | '
          Content(`| ${label} | ${where}${hookList} |
`)
        })
        Content(`
`)
      }
    }

    const AgentGuide_sdk =
      optionalComponent(ctx$, target, 'AgentGuide')
    if (AgentGuide_sdk) {
      AgentGuide_sdk['AgentGuide']({ target })
    }

    Content(`---

Generated by [@voxgig/sdkgen](https://github.com/voxgig/sdkgen).${'' === guide ? '' : ` See the
[project guide](${guide}).`}
`)
  })

  File({ name: 'CLAUDE.md' }, () => {
    Content(claudePointer(`${Name} ${title}`))
  })

  // Co-located per-feature guide files — only for dir-layout targets (ts/js),
  // where each feature has its own directory to hold the guide. Flat-layout
  // targets document features inline above; phase-disabled targets
  // (go-cli/go-mcp) get no feature docs at all.
  if (writesFeatureGuides(model, target)) {
    features.forEach((feature: any) => {
      AgentGuideFeature({ target, feature })
    })
  }

  ctx$.log?.info?.({ point: 'generate-agentguide', target, note: 'target:' + lang })
})


export {
  AgentGuide
}
