
import { loadOptional } from '../utility'


const DOCS = 'https://github.com/voxgig/sdkgen/blob/main/docs/how-to/' +
  'author-a-new-language.md#optional-readme-components'


// What a target's documentation goes without when the target does not supply
// the component. Null where a shared default renders in its place.
const OPTIONAL_COMPONENTS = {
  AgentGuide: null,
  ReadmeFeatures: null,
  ReadmeModel: null,

  ReadmeIntro: (t: string) => t + '/README.md has no title or introduction',
  ReadmeInstall: (t: string) => t + "/README.md's install section is empty",
  ReadmeQuick: (t: string) => t + "/README.md's tutorial is empty",
  ReadmeHowto: (t: string) => t + "/README.md's how-to section is empty",
  ReadmeOptions: (t: string) => t + '/README.md has no options section',
  ReadmeEntity: (t: string) => t + '/README.md has no entities section',
  ReadmeExplanation: (t: string) =>
    t + "/README.md's advanced section has nothing specific to " + t,
  ReadmeRef: (t: string) =>
    t + '/REFERENCE.md is not written, though ' + t + '/README.md links to it',
  ReadmeTopQuick: (t: string) =>
    "the top-level README.md's quickstart has no " + t + ' example',
  ReadmeTopTest: (t: string) =>
    "the top-level README.md's offline testing section has no " + t + ' example',
  ReadmeTopHowto: (t: string) =>
    "the top-level README.md's direct call guide has no " + t + ' example',
}


type OptionalComponent = keyof typeof OPTIONAL_COMPONENTS


function optionalComponent(ctx$: any, target: any, name: OptionalComponent): any {
  const t = target.name
  const found = loadOptional(ctx$, `./cmp/${t}/${name}_${t}`)

  if (undefined !== found) {
    return found
  }

  const lacks = OPTIONAL_COMPONENTS[name]
  const file = `.sdk/src/cmp/${t}/${name}_${t}.ts`

  if (null == lacks) {
    ctx$.log?.debug?.({
      point: 'optional-component-default', target: t, component: name,
      note: t + ': no ' + name + '_' + t + ' component, so the shared default is used',
    })
    return undefined
  }

  ctx$.log.warn({
    point: 'optional-component-missing', target: t, component: name, file,
    note: t + ': no ' + name + '_' + t + ' component, so ' + lacks(t) +
      '. The SDK code is complete; only this documentation is affected. ' +
      'To add it, write ' + file + ' (for a target from a package, in that ' +
      'package) and run npm run generate. See ' + DOCS,
  })

  return undefined
}


export type {
  OptionalComponent,
}

export {
  OPTIONAL_COMPONENTS,
  optionalComponent,
}
