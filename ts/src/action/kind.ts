import { kindCollection } from '../helpers/kindCollection'


import Path from 'node:path'

import { File, Copy, Content, template } from 'jostraca'

import { KIT } from '../types'

import { SdkGenError } from '../utility'

import { provenanceReplace } from '../helpers/stdrep'

import { resolveSource, recordedRef, isBare } from './resolve'
import type { Source } from './resolve'

import { UpdateIndex } from './action'


type KindDef = {
  name: string

  alias: boolean

  // Rewrite the definition's own text when it is installed under a different
  // name (targets rewrite their `main: kit: target: <name>:` key). Only
  // reached when `alias` is true.
  rename?: (src: string, origname: string, name: string) => string

  // Is the copied definition PROJECT-OWNED once written? An alias exists to
  // be differentiated, so its model file is created and then never
  // overwritten; everything else is toolchain-owned and resyncs.
  ownedWhenAliased?: boolean

  trees?: TreeDef[]
}


// One tree an item of this kind owns, `{name}`-templated and relative to the
// `.sdk` folder.
type TreeDef = {
  path: string

  // What the copy substitutes on the way in — and therefore what doctor must
  // re-apply before comparing, or every templated file reads as edited.
  //   none     — copied verbatim, so a byte compare is the truth
  //   template — through jostraca's template() with ProjectName et al
  replace: 'none' | 'template'

  // Must it be there for the item to be installable? A missing REQUIRED tree
  // fails manifest validation before anything is written; a missing optional
  // one is simply not copied.
  required: boolean
}


const BARE_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function aliasModelKey(kind: string) {
  return function aliasModelText(
    src: string, origname: string, name: string,
  ): string {
    const mustQuote = !BARE_KEY_RE.test(name)

    return src.replace(
      new RegExp(kind + ":(\\s*)('?)" + escapeRe(origname) + "\\2:", 'g'),
      (_m: string, gap: string, quote: string) => {
        const q = ('' !== quote || mustQuote) ? "'" : ''
        return kind + ':' + gap + q + name + q + ':'
      })
  }
}


function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}


const KINDS: Record<string, KindDef> = Object.assign(Object.create(null), {
  target: {
    name: 'target', alias: true, ownedWhenAliased: true,
    rename: aliasModelKey('target'),
    // Components are dispatched by the convention `cmp/<t>/Main_<t>`, and the
    // template tree is what `target add` copies — a target missing either is
    // not installable, however complete its model file looks.
    trees: [
      { path: 'src/cmp/{name}', replace: 'none', required: true },
      { path: 'tm/{name}', replace: 'template', required: true },
    ],
  },

  feature: { name: 'feature', alias: false },

  edition: {
    name: 'edition', alias: true, ownedWhenAliased: true,
    rename: aliasModelKey('edition'),
    trees: [
      { path: 'src/cmp/edition/{name}', replace: 'none', required: true },
      { path: 'tm/edition/{name}', replace: 'template', required: false },
    ],
  },
})


function kindTrees(kind: string, name: string): TreeDef[] {
  return (kindDef(kind).trees ?? []).map((t: TreeDef) => ({
    ...t,
    path: t.path.split('{name}').join(name),
  }))
}


function kindDef(kind: string): KindDef {
  const def = KINDS[kind]
  if (null == def) {
    throw new SdkGenError('Unknown kind: ' + kind)
  }
  return def
}


function resolveKind(ref: string, kind: string, ctx$: any): Source {
  const def = kindDef(kind)
  const source = resolveSource(ref, kind, ctx$)

  if (!def.alias && source.name !== source.origname) {
    throw new SdkGenError(
      capitalise(kind) + ' aliasing is not supported: ' + ref +
      '\n  A ' + kind + ' name is part of the generated config ' +
      '(options.' + kind + '.<name>) and of the hook wiring in every target, ' +
      'so it cannot be renamed at install time.')
  }

  if (!ctx$.fs().existsSync(source.model)) {
    throw new Error(
      capitalise(kind) + ' definition not found: ' + source.model)
  }

  return source
}


function kindModel(props: {
  ctx$: any,
  kind: string,
  source: Source,
  names: string[],
  content: string,
}) {
  const { ctx$, kind, source } = props
  const def = kindDef(kind)
  const fs = ctx$.fs()
  const log = ctx$.log

  const aliased = source.name !== source.origname

  const replace = provenanceReplace({
    base: source.base,
    origname: source.origname,
    name: source.name,
    package: source.package,
  })

  if (aliased) {
    const owned = true === def.ownedWhenAliased

    if (owned) {
      const dest = Path.join(
        ctx$.folder ?? '.', 'model', kind, source.name + '.aontu')

      if (fs.existsSync(dest)) {
        log.info({
          point: kind + '-alias-model-kept', [kind]: source.name, file: dest,
          note: source.name + ': keeping the existing aliased ' + kind +
            ' model (project-owned — an alias is differentiated by editing it)'
        })
      }
    }

    const src = fs.readFileSync(source.model, 'utf8')
    const text = null == def.rename ? src :
      def.rename(src, source.origname, source.name)

    File({ name: source.name + '.aontu', exclude: owned }, () =>
      Content(template(text, ctx$.model, { replace })))
  }
  else {
    Copy({ from: source.model, replace })
  }

}


function kindIndex(props: {
  kind: string,
  names: string[],
  content: string,
}) {
  const { kind, names, content } = props
  File({ name: kindDef(kind).name + '-index.aontu' }, () => UpdateIndex({
    content,
    names,
  }))
}


function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


export type {
  KindDef,
  TreeDef,
}

export {
  KINDS,
  recordedRef,
  aliasModelKey,
  kindTrees,
  escapeRe,
  kindDef,
  resolveKind,
  kindModel,
  kindIndex,
  isBare,
}
