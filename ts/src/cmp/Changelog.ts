import { Content, File, each } from 'jostraca'
import { cmp } from '../helpers/component'
import { fact } from '../helpers/facts'
import { packageVersion } from '../helpers/packageMeta'
import { SURFACE_WORD, documentOrder, surfaceOf } from '../helpers/surface'
import { seriesList } from '../helpers/text'
import { KIT, getModelPath } from '../types'


// "TypeScript and Python, plus CLI and MCP surfaces": the SDK languages, then
// every other surface the project generates.
function releaseScope(targets: any[]): string {
  const langs = targets.filter((t: any) => 'sdk' === surfaceOf(t))
    .map((t: any) => fact(t, 'title'))
  const others = [...new Set(targets.map((t: any) => surfaceOf(t))
    .filter((surface: string) => '' !== surface && 'sdk' !== surface))]
    .map((surface: string) => SURFACE_WORD[surface])

  const surfaces = 0 === others.length ? '' : 1 === others.length ?
    'the ' + others[0] + ' surface' : seriesList(others) + ' surfaces'

  return 0 === langs.length ? surfaces :
    seriesList(langs) + ('' === surfaces ? '' : ', plus ' + surfaces)
}


// Breaks a list item at the width of the rest of the file.
function listItem(text: string, width = 76): string {
  const lines: string[] = []
  let line = '-'
  for (const word of text.split(' ')) {
    if (2 < line.length && width < line.length + 1 + word.length) {
      lines.push(line)
      line = ' '
    }
    line += ' ' + word
  }
  return [...lines, line].join('\n')
}


const Changelog = cmp(function Changelog(props: any) {
  const { ctx$ } = props
  const { model } = ctx$

  const name = model.Name || model.name

  const targets = documentOrder(model,
    each(getModelPath(model, `main.${KIT}.target`, { required: false }) || {})
      .filter((t: any) => false !== t.active))

  // Written once, so the first entry is the version the targets start at; a
  // heading with no number when they start at different ones.
  const versions = new Set<string>()
  targets.forEach((t: any) => versions.add(packageVersion(model, t.name)))
  const first = 1 < versions.size ? 'Initial release' :
    `[${[...versions][0] || packageVersion(model, '')}]`

  const scope = releaseScope(targets)

  File({ name: 'CHANGELOG.md', exclude: true }, () => {
    Content(`# Changelog

All notable changes to the generated ${name} SDK are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

## ${first}

${listItem('Initial generated release of the ' + name + ' SDK' +
  ('' === scope ? '' : ' (' + scope + ')') +
  ', generated from the upstream OpenAPI specification by @voxgig/sdkgen.')}
`)
  })
})


export {
  Changelog
}
