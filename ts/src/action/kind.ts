// KINDS: the things an `add` can install.
//
// `target` and `feature` are two of them, `docs` and others are meant to
// follow (docs/design/sdkgen-packages.md §8). They were two hand-written
// pipelines that had already drifted apart — only one took path refs, only
// one applied a replace map, only one recorded provenance — and a third kind
// would have been a third copy of the same drift.
//
// What every kind shares is declared here and executed once:
//
//   - the ref grammar and resolution, including the fallback to what the
//     model already records for a bare name;
//   - whether the kind may be installed under a different name (`~alias`);
//   - the definition file: `model/<kind>/<name>.aontu`, stamped with
//     provenance and landing under the INSTALLED name;
//   - the include list: `model/<kind>/<kind>-index.aontu`.
//
// What a kind adds on top — a target's component and template trees, a
// feature's per-target source fan-out — stays in that kind's own action. Those
// are genuinely different work, not the same work with different strings, and
// pretending otherwise would buy generality nobody can use.

import Path from 'node:path'

import { File, Copy, Content, template } from 'jostraca'

import { KIT } from '../types'

import { SdkGenError } from '../utility'

import { provenanceReplace } from '../helpers/stdrep'

import { resolveSource } from './resolve'
import type { Source } from './resolve'

import { UpdateIndex } from './action'


type KindDef = {
  // The kind's name, which is also its model subdirectory and the prefix of
  // its index file.
  name: string

  // May it be installed under a different name? Targets yes — that is how a
  // project gets two Go modules from one target. Features no: a feature's
  // name is part of the generated `options.feature.<name>` config key and of
  // the hook wiring in every target, so renaming one at install time is real
  // work with no customer.
  alias: boolean

  // Rewrite the definition's own text when it is installed under a different
  // name (targets rewrite their `main: kit: target: <name>:` key). Only
  // reached when `alias` is true.
  rename?: (src: string, origname: string, name: string) => string

  // Is the copied definition PROJECT-OWNED once written? An alias exists to
  // be differentiated, so its model file is created and then never
  // overwritten; everything else is toolchain-owned and resyncs.
  ownedWhenAliased?: boolean
}


// Rewrite the target KEY in a copied model file, for an aliased install.
//
// Two forms are in use across the shipped models — bare (`target: go:`) and
// quoted (`target: 'go-cli':`) — and two paths carry the key: the target
// block itself (`main: kit: target: <t>:`) and the per-target feature-deps
// slot every model declares (`main: kit: feature: &: target: <t>: deps: &:`).
// Both belong to the installed target, so both move. Matching on `target: `
// rather than on the bare name is what keeps the rewrite off the target's
// own values — `ext: go` and `module: name: '$$name$$'` must not change.
//
// ONE regex, with the quote optional and captured, rather than two entries in
// jostraca's `replace` map: that map canonicalises each key into a regex
// group NAME, and the bare and quoted spellings of the same key reduce to the
// same name — so one silently overwrote the other and `go-cli~cli2` came out
// as the BARE `target: cli2:`, losing the quoting a hyphenated key needs.
//
// The alias may also NEED quoting when the origin did not: aontu rejects a
// bare key containing a hyphen (`unexpected character(s): -`), so
// `target add go~go-alt` emitting the origin's unquoted style produced a
// model that could not compile at all. Quote when the origin was quoted OR
// the alias is not a bare identifier.
const BARE_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function aliasModelText(src: string, torigname: string, tname: string): string {
  const mustQuote = !BARE_KEY_RE.test(tname)

  return src.replace(
    new RegExp("target:(\\s*)('?)" + escapeRe(torigname) + "\\2:", 'g'),
    (_m: string, gap: string, quote: string) => {
      const q = ('' !== quote || mustQuote) ? "'" : ''
      return 'target:' + gap + q + tname + q + ':'
    })
}


function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}


const KINDS: Record<string, KindDef> = Object.assign(Object.create(null), {
  target: {
    name: 'target', alias: true, ownedWhenAliased: true,
    rename: aliasModelText,
  },
  feature: { name: 'feature', alias: false },
})


function kindDef(kind: string): KindDef {
  const def = KINDS[kind]
  if (null == def) {
    throw new SdkGenError('Unknown kind: ' + kind)
  }
  return def
}


// Resolve one ref for a kind, applying that kind's alias policy.
//
// A BARE name resolves against what the model already RECORDS. Without that,
// provenance would be write-only: the add actions re-run with the model's own
// keys (`circuitbreaker`, not the ref it was installed from), a bare name
// falls back to the bundled scaffold — whose `.sdk` folder exists, so
// resolution SUCCEEDS — and the copy then throws on a definition that is not
// there. An explicit ref always wins: that is how something is moved to a new
// source.
function resolveKind(ref: string, kind: string, ctx$: any): Source {
  const def = kindDef(kind)
  const model = ctx$.model

  const declared: any = model?.main?.[KIT]?.[kind]?.[ref]
  const recorded = (isBare(ref) && recordedRef(declared, ref)) || ref

  const source = resolveSource(recorded, kind, ctx$)

  // Asked of the RESOLVER rather than by re-reading the ref. `~` separates an
  // alias only in the last segment, and a check that looked for one anywhere
  // rejected every ref whose PATH contains a tilde — a Windows 8.3 short name
  // like `C:\Users\RUNNER~1\...` is one. Parsing the ref in two places is what
  // let that defect come back after it was fixed.
  if (!def.alias && source.name !== source.origname) {
    throw new SdkGenError(
      capitalise(kind) + ' aliasing is not supported: ' + ref +
      '\n  A ' + kind + ' name is part of the generated config ' +
      '(options.' + kind + '.<name>) and of the hook wiring in every target, ' +
      'so it cannot be renamed at install time.')
  }

  return source
}


// Emit the kind's definition file and its index entry.
//
// Called inside a `Folder({ name: 'model/<kind>' })`, so both land together.
// `names` is every INSTALLED name seen so far in this run: the index File is
// re-rendered per item and the last render wins, so each render has to carry
// all of them.
function kindModel(props: {
  ctx$: any,
  kind: string,
  source: Source,
  names: string[],
  content: string,
}) {
  const { ctx$, kind, source, names, content } = props
  const def = kindDef(kind)
  const fs = ctx$.fs()
  const log = ctx$.log

  const aliased = source.name !== source.origname

  const replace = provenanceReplace({
    base: source.base,
    origname: source.origname,
    name: source.name,
  })

  if (aliased) {
    // The copy lands under the INSTALLED name AND declares it. Left alone it
    // kept the origin basename (jostraca defaults a single-file Copy's
    // destination to the source's), so the index named a file that does not
    // exist — which fails the whole model compile, not just the alias.
    //
    // `exclude: true` — CREATE, never overwrite, for a kind whose aliased
    // definition is project-owned: an alias exists to be differentiated,
    // which is why doctor reports its diffs as informational and why
    // add-a-target tells the project to edit it.
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

  File({ name: def.name + '-index.aontu' }, () => UpdateIndex({
    content,
    names,
  }))
}


// The ref that reinstalls what the model already records — `base` says which
// `.sdk` folder, `origname` says what it is called there.
//
// The ALIAS has to be carried back through. Rebuilding only `<base>/../<orig>`
// resolves to the ORIGIN name, so `target add go2` (after installing
// `go~go2`) would refresh and index a new `go` target and leave `go2` stale —
// losing the differentiated identity the alias exists for, and the
// project-owned model file with it.
//
// ONE definition, used by the add actions and by doctor. This reconstruction
// was written twice and the two copies had already diverged on exactly this
// point, which is the drift the kind spine exists to end.
function recordedRef(declared: any, name: string): string | undefined {
  if (null == declared?.base || '' === declared.base) {
    return undefined
  }

  const origname = declared.origname || name

  return Path.join(declared.base, '..', origname) +
    (origname === name ? '' : '~' + name)
}


// A bare NAME, as opposed to a ref that locates a source.
function isBare(ref: string): boolean {
  return !ref.includes('/') && !ref.includes(Path.sep)
}


function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


export type {
  KindDef,
}

export {
  KINDS,
  recordedRef,
  aliasModelText,
  escapeRe,
  kindDef,
  resolveKind,
  kindModel,
  isBare,
}
