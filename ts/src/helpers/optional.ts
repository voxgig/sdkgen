
import { loadOptional } from '../utility'
import { serveSyntax } from './syntaxversion'
import { componentModule, componentSource, parseComponent } from './cmpfile'


const DOCS = 'https://github.com/voxgig/sdkgen/blob/main/docs/how-to/' +
  'author-a-new-language.md#optional-readme-components'


// What a target's documentation goes without when the target does not supply
// the component. Null where a shared default renders in its place.
const OPTIONAL_COMPONENTS = {
  AgentGuide: null,
  ReadmeFeatures: null,
  ReadmeModel: null,
  // A syntax provider: without one, the target writes its own sections.
  Syntax: null,
  // The names the generated code uses: without one, generic names.
  Naming: null,

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


// The sections a shared component writes from the target's syntax provider
// when the target has no component of its own by that name.
const SYNTAX_SECTIONS: string[] = ['ReadmeQuick', 'ReadmeRef', 'ReadmeTopQuick']


// The sections a shared component writes in place of a target's own
// component: the three it writes from the provider, and every optional
// component the source's retired list names. A release that retires one
// lists it there, so the set follows what is retired and is never extended by
// hand (test/retire.test.ts checks the list against the release tags).
function sharedSections(retired?: Record<string, unknown>): string[] {
  const out = new Set(SYNTAX_SECTIONS)
  for (const rel of Object.keys(retired || {})) {
    const name = parseComponent(rel)?.name
    if (null != name && Object.prototype.hasOwnProperty.call(OPTIONAL_COMPONENTS, name)) out.add(name)
  }
  return [...out]
}

// The model names this component as the project's choice, under
// `main.kit.target.<t>.override.<Name>`.
function declaredOverride(model: any, file: string): boolean {
  const own = parseComponent(file)
  return null != own && true === model?.main?.kit?.target?.[own.target]?.override?.[own.name]
}

// A target's own copy of a section a shared component writes, which the
// model does not declare.
function undeclaredOverride(model: any, file: string, retired?: Record<string, unknown>): boolean {
  const own = parseComponent(file)
  return null != own && sharedSections(retired).includes(own.name) && !declaredOverride(model, file)
}


function optionalComponent(ctx$: any, target: any, name: OptionalComponent): any {
  const t = target.name
  const found = loadOptional(ctx$, componentModule(t, name))

  if (undefined !== found) {
    return 'Syntax' === name ? serveSyntax(t, found, ctx$.log) : found
  }

  const lacks = OPTIONAL_COMPONENTS[name]
  const file = '.sdk/' + componentSource(t, name)

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
  SYNTAX_SECTIONS,
  optionalComponent,
  undeclaredOverride,
  declaredOverride,
  sharedSections,
}
