
import { each, Content, File, Folder } from 'jostraca'
import { cmp } from '../helpers/component'
import { fact } from '../helpers/facts'
import { generatedOps } from '../helpers/opShape'

import { claudePointer, regenerationStatement } from './AgentGuideContent'


function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}


// Per-feature agent guide, co-located with the feature's generated runtime.
// Invoked from AgentGuide inside the ambient target folder, so it lands at
// `<lang>/src/feature/<name>/AGENTS.md`.
const AgentGuideFeature = cmp(function AgentGuideFeature(props: any) {
  const { target, feature, ctx$ } = props

  const name = feature.name
  const Name = feature.Name || cap(name)
  const title = feature.title || `${Name} feature`
  const version = feature.version || '0.0.1'
  const lang = target.name

  // Active hook stages (feature.hook.<Stage>.active === true).
  const hooks = each(feature.hook || {})
    .filter((h: any) => h && h.active)
    .map((h: any) => h.name || h.key$)
    .filter(Boolean)

  const defaultOn = fact(feature, 'on')
  const ops = generatedOps(ctx$.model)

  Folder({ name: 'src/feature/' + name }, () => {

    File({ name: 'AGENTS.md' }, () => {
      Content(`# ${Name}Feature — Agent Guide

${title} (v${version}).

A **feature** is a pipeline extension: an object of hooks that fire at named
stages of every entity operation${0 < ops.length ? ' (' + ops.join(', ') + ')' : ''} and of
the SDK/entity lifecycle. Features are how you inspect or modify the request
pipeline without forking the SDK. This directory holds the **generated**
runtime for the \`${name}\` feature in the ${fact(target, 'title')} target — do
not edit it by hand; change its template/model in \`.sdk/\` and regenerate.

Active by default: **${defaultOn ? 'yes' : 'no'}** (\`config.options.active\`
in the model). ${defaultOn
  ? 'It runs unless disabled.'
  : 'It only runs when explicitly enabled (e.g. the `test` feature is switched on for test mode).'}

`)

      if (0 < hooks.length) {
        Content(`## Hooks it fires

${hooks.map((h: string) => `- \`${h}\``).join('\n')}

Each active hook runs at its pipeline stage in feature-registration order, so a
later feature can override an earlier one.

`)
      }

      Content(`## Where it is defined

| Part | Path |
| --- | --- |
| Model definition | \`.sdk/model/feature/${name}.aontu\` (name, title, version, \`config.options.active\`, the \`hook\` map, per-language \`deps\`) |
| Registered in | \`.sdk/model/feature/feature-index.aontu\` (\`@"${name}.aontu"\`) |
| Runtime template | \`.sdk/tm/${lang}/src/feature/${name}/\` (copied here on \`generate\`; \`FEATURE_Name\`/\`FEATURE_VERSION\` substituted) |

(Paths are relative to the **project root** — four levels up from here.)

## Customising this feature

- **Turn hooks on/off**: edit the \`hook\` map in
  \`.sdk/model/feature/${name}.aontu\` (\`<Stage>: active: true|false\`).
- **Change default activation**: set \`config.options.active\` in the same file.
- **Dependencies**: edit \`deps.<lang>\` in the same file.
- **Behaviour**: edit the runtime template under
  \`.sdk/tm/${lang}/src/feature/${name}/\`, then regenerate.

After any change: \`cd ../../../../.sdk && npm run generate\` (add
\`npm run build\` first if you changed a component).
${regenerationStatement()}

To author a **new** feature, copy this one's model + template shape — see the
[project guide](../../../../AGENTS.md) and the
[${fact(target, 'title')} guide](../../../AGENTS.md).
`)
    })

    File({ name: 'CLAUDE.md' }, () => {
      Content(claudePointer(`${Name}Feature (${lang})`))
    })
  })

  ctx$.log?.info?.({
    point: 'generate-agentguide-feature', target, feature,
    note: 'target:' + lang + ', feature:' + name,
  })
})


export {
  AgentGuideFeature
}
