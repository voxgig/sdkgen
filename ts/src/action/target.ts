
import Path from 'node:path'

import {
  Project,
  Folder,
  Copy,
  File,
  Content,
  cmp,
  each,
  template,
} from 'jostraca'

import { showChanges } from '@voxgig/util'

import { showDryrun } from '../helpers/dryrun'

import { templateReplacements } from '../helpers/stdrep'

import { getelem } from '@voxgig/struct'

import { Aontu } from 'aontu'

import {
  KIT
} from '../types'

import type {
  ActionContext,
  ActionResult,
} from '../types'

import { SdkGenError } from '../utility'

import {
  availableFeatures,
  findFeatureSources,
  featureExcludes,
  fullsetExcludes,
} from '../helpers/featureSource'

import {
  feature_add
} from './feature'

import {
  UpdateIndex,
  parseAddNames,
  loadContent,
} from './action'


const CMD_MAP: any = {
  add: cmd_target_add
}



async function action_target(args: string[], actx: ActionContext): Promise<ActionResult> {
  const cmdname = args[1]

  const cmd = CMD_MAP[cmdname]

  if (null == cmd) {
    throw new SdkGenError('Unknown target cmd: ' + cmdname)
  }

  return await cmd(args, actx)
}


async function cmd_target_add(args: string[], actx: ActionContext): Promise<ActionResult> {
  return target_add(parseAddNames(args), actx)
}


// Code API
async function target_add(targets: string[], actx: ActionContext): Promise<ActionResult> {
  // const jostraca = Jostraca()
  const jostraca = actx.jostraca

  const opts = {
    fs: actx.fs,
    folder: actx.folder,
    log: actx.log.child({ cmp: 'jostraca' }),
    meta: {
      // model: actx.model,
      // tree: actx.tree,
      url: actx.url,
      content: loadContent(actx, 'target')
    },
    model: actx.model,
    // Dry run must be passed per-call, not left to the Jostraca instance.
    // jostraca's `generate` runs its own options through OptionsShape FIRST,
    // which fills in `control.dryrun: false`, and only then merges
    // `deep({}, gOpts.control, opts.control)` — so the shape default silently
    // OVERRIDES the instance-level flag. `-y target add ts` printed
    // ** DRY RUN ** and wrote every file. (Same trap as the `existing` FIX
    // note in jostraca.js.)
    control: {
      dryrun: !!actx.opts.dryrun
    },
  }

  opts.log.info({
    point: 'target-start',
    note: (actx.opts.dryrun ? '** DRY RUN **' : '')
  })


  // The `test` feature is required by every generated target (SDK.test()
  // depends on it), so ensure it is added even if the model does not yet
  // declare it.
  //
  // Everything else has to be BOTH declared and active: `active` defaults to
  // false in the schema, and a feature the model has switched off should not
  // have its source land in the project. This used to be a plain
  // Object.keys(), so `retry: { active: false }` still shipped every retry
  // source file.
  const featuremodel: any = actx.model.main[KIT]?.feature ?? {}
  const features = Array.from(new Set([
    'test',
    ...Object.keys(featuremodel).filter((n: string) => false !== featuremodel[n]?.active),
  ]))

  const jres = await jostraca.generate(opts, () =>
    TargetRoot({ targets, features, actx }))

  showChanges(opts.log, 'target-result', jres)

  if (actx.opts.dryrun) {
    showDryrun(opts.log, 'target-result', jres, actx.folder)
  }

  // feature_add copies feature templates for targets already registered in
  // the model. The targets added above are not in the in-memory model yet,
  // so TargetRoot copies their feature templates itself.
  await feature_add(features, actx)

  opts.log.info({
    point: 'target-end',
    note: (actx.opts.dryrun ? '** DRY RUN **' : '')
  })

  return {
    jres
  }
}


const TargetRoot = cmp(function TargetRoot(props: any) {
  const { ctx$, targets, features, actx } = props
  const { model, log } = ctx$

  const fs = ctx$.fs()

  // The prune below writes through `fs` directly rather than through
  // jostraca, so it has to be told about the dry run itself.
  const dryrun = !!actx?.opts?.dryrun

  // TODO: jostraca - make from value easier to specify 
  // const tfolder = 'node_modules/@voxgig/sdkgen/project/.sdk'

  Project({}, () => {
    // Resolved names of every target in this run. The index File is
    // re-rendered per target and the last render wins, so each render must
    // carry all names seen so far, not just its own.
    const tnames: string[] = []

    each(targets, (n) => {
      const tref = n.val$

      log.info({
        point: 'target-build',
        target: tref,
        note: tref
      })

      const { tname, tfolder, torigname, base } = resolveTarget(tref, ctx$)
      tnames.push(tname)
      const targetNote = tname + (tname != tref ? ' ref:' + tref : '')

      log.info({
        point: 'target-name', name: tname, folder: tfolder,
        target: tref,
        tname,
        note: tname + (tname != torigname ? 'original' + torigname : '') + ' from:' + tfolder
      })

      // An ALIASED add (`target add go~go2`) installs the target under a new
      // name, and every one of the three trees has to agree about that name.
      // Only the two FOLDER names used to change; see aliasRename below for
      // what that left broken.
      const aliased = tname !== torigname

      const modelFrom = tfolder + '/model/target/' + torigname + '.aontu'
      const baseReplace = { "'BASE'": "'" + base + "'" }

      Folder({ name: 'model/target' }, () => {
        if (aliased) {
          // The copy has to land under the INSTALLED name AND declare it.
          // Left alone it kept the origin basename (jostraca defaults a
          // single-file Copy's destination to the source's), so
          // `target add go~go2` wrote model/target/go.aontu while
          // target-index.aontu gained `@"go2.aontu"` — an include of a file
          // that does not exist, which fails the whole model compile, not
          // just the alias. The declaration inside stayed `target: go:` too,
          // so the alias either collided with its origin or named a target
          // nothing referenced.
          //
          // `exclude: true` — CREATE, never overwrite. This is the one target
          // model a project OWNS: an alias exists to be differentiated (a
          // second Go module needs its own module name and deps), which is
          // why doctor exempts it from the model comparison and why
          // add-a-target tells the project to edit it. Overwriting it on
          // every resync would silently revert exactly the edits the alias
          // was created to hold. The origin's own model file is unaffected
          // and stays overwrite, as for every other target.
          const dest = Path.join(
            ctx$.folder ?? '.', 'model', 'target', tname + '.aontu')

          if (fs.existsSync(dest)) {
            log.info({
              point: 'target-alias-model-kept', target: tname, file: dest,
              note: tname + ': keeping the existing aliased target model ' +
                '(project-owned — an alias is differentiated by editing it)'
            })
          }

          const src = fs.readFileSync(modelFrom, 'utf8')
          File({ name: tname + '.aontu', exclude: true }, () => Content(
            template(aliasModelText(src, torigname, tname),
              ctx$.model, { replace: baseReplace })))
        }
        else {
          Copy({
            from: modelFrom,
            // exclude: true
            replace: baseReplace,
          })
        }
        File({ name: 'target-index.aontu' }, () => UpdateIndex({
          content: ctx$.meta.content.target_index,
          names: tnames,
        }))
      })

      if (aliased) {
        // Components are dispatched by CONVENTION — `cmp/<t>/Main_<t>` — so
        // an aliased tree whose files keep the origin suffix resolves
        // nothing: `src/cmp/go2/Main_go.ts` is invisible to a lookup for
        // `cmp/go2/Main_go2`. jostraca's tree Copy has no per-entry rename
        // hook, so an aliased tree is emitted file by file instead.
        aliasCmpTree(ctx$, tfolder + '/src/cmp/' + torigname,
          'src/cmp/' + tname, torigname, tname)
      }
      else {
        Folder({ name: 'src/cmp/' + tname }, () => {
          Copy({
            from: tfolder + '/src/cmp/' + torigname,
            // exclude: true
          })
        })
      }

      // Copy the whole template tree MINUS the source of every feature the
      // model did not ask for. Which files those are is discovered from the
      // tree rather than assumed (see helpers/featureSource), because each
      // language puts feature source somewhere different.
      const trim = trimFeatures(ctx$, tfolder, torigname, tname, features)

      // Copy only ADDS and overwrites — it never removes, and it never even
      // looks at a file the trim excludes. So a template that this SDK should
      // NOT have lived on at whatever revision it was first copied at, and
      // kept being generated from.
      //
      // That is how 30 cedar repos ended up with tm/go/test/feature_test.go
      // still declaring the nine fh* harness helpers after upstream moved them
      // into feature_harness_test.go: feature_test.go is feature-source, so it
      // is trimmed for an SDK without those features, so Copy skipped it, so
      // the pre-move revision survived every `target add go` those repos ever
      // ran. Generation then emitted it alongside the new harness and the go
      // package failed to compile — "fhHasFeature redeclared in this block".
      //
      // The invariant this restores: tm/<target> == source tree MINUS trim.
      pruneStaleTemplates(
        ctx$, tfolder + '/tm/' + torigname, 'tm/' + tname, trim, dryrun)

      Folder({ name: 'tm/' + tname }, () => {
        Copy({
          from: tfolder + '/tm/' + torigname,
          exclude: trim,
          // Shared with doctor, which re-applies them before comparing.
          replace: templateReplacements(model, tname),
        })
      })

      log.info({
        point: 'target-done', target: tref, note: targetNote
      })

    })
  })
})


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


// Emit an aliased `src/cmp` tree: every file renamed from the origin suffix
// to the installed one, and its CONTENT rewritten to match.
//
// Renaming alone would break the tree, because a component names its origin
// twice over: sibling imports (`from './Package_go'`) and the fragment
// directory it reads through `__dirname` (`/../../../src/cmp/go/fragment/`,
// in 67 of the shipped components). Both are rewritten here — the fragment
// path because the fragments are copied to the ALIAS's folder, so the origin
// path would either miss or, worse, silently read the origin target's
// fragments if that target is also installed.
//
// Files are emitted through jostraca (`File`/`Content`) rather than copied
// with `fs`, so a dry run reports them and writes nothing, exactly as the
// tree Copy on the unaliased path does.
function aliasCmpTree(
  ctx$: any,
  fromDir: string,
  toRel: string,
  torigname: string,
  tname: string,
) {
  const fs = ctx$.fs()

  const orig = escapeRe(torigname)

  // Rewritten HERE rather than through jostraca's `replace` map, because that
  // map canonicalises each key into a regex group NAME — `_go'` and `_go"`
  // both reduce to the same name, so the later entry silently won and every
  // single-quoted import came out as `from './Package_go2"`. One explicit
  // regex keeps the quote it matched.
  const aliasText = (src: string): string => src
    // The fragment directory, read relative to __dirname. The fragments are
    // copied into the ALIAS's folder, so leaving the origin path would miss —
    // or, if the origin target is also installed, silently read ITS fragments.
    .replace(new RegExp('src/cmp/' + orig + '/', 'g'), 'src/cmp/' + tname + '/')
    // Sibling imports: `'./Package_go'` -> `'./Package_go2'`. Anchored on the
    // closing quote (captured, so the style is preserved) to keep it off file
    // EXTENSIONS — `Main.fragment.go` must not become `Main.fragment.go2`.
    .replace(new RegExp('_' + orig + '([\'"])', 'g'), '_' + tname + '$1')

  const emit = (dir: string, rel: string) => {
    let entries: any[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    }
    catch (e: any) {
      return
    }

    // Sorted, so an aliased tree is emitted in the same byte-stable order
    // everything else in this toolchain is.
    const names = entries.map((ent: any) => ent.name).sort()

    for (const name of names) {
      const child = Path.join(dir, name)
      const ent = entries.find((e: any) => e.name === name)

      if (ent.isDirectory()) {
        Folder({ name }, () => emit(child, rel + '/' + name))
        continue
      }

      // `<Cmp>_<origname>.<ext>` -> `<Cmp>_<tname>.<ext>`. Anything not
      // carrying the suffix (tsconfig.json, the fragment sources) keeps its
      // name.
      const renamed = name.replace(
        new RegExp('_' + escapeRe(torigname) + '(\\.[^.]+)$'), '_' + tname + '$1')

      // `template` against the model with no replace map, matching what Copy
      // does for the unaliased tree — jostraca's Copy always interpolates
      // `$$ref$$` against the model, so an aliased tree must too.
      const src = fs.readFileSync(child, 'utf8')

      File({ name: renamed }, () => Content(template(aliasText(src), ctx$.model)))
    }
  }

  Folder({ name: toRel }, () => emit(fromDir, toRel))
}


function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}


// Path patterns that keep a target's unwanted feature source out of the
// project: the source of every AVAILABLE feature the model did not select,
// plus the templates that only compile with the complete feature set.
//
// Returns an empty list — copy the whole tree, as before — when the target
// opts out with `feature: { trim: false }`, or when its model cannot be
// read. Trimming a target whose templates are not ready for it produces a
// project that does not build, so an unreadable declaration must fail safe
// rather than fail tidy.
// Bring the consumer's `tm/<target>` back to the invariant that Copy alone
// cannot maintain: it must contain EXACTLY the source tree minus the files
// this SDK's feature set trims away.
//
// Copy adds and overwrites. It does not remove, and it does not touch an
// excluded file at all — so both of these persist silently forever:
//
//   - a template the toolchain has RETIRED (absent from the source tree);
//   - a template this SDK should not have (present in source, but trimmed),
//     frozen at whatever revision it was first copied at.
//
// The second is the one that bit: tm/go/test/feature_test.go is feature
// source, so it is trimmed for an SDK without those features, so it was never
// refreshed after upstream moved the fh* harness helpers out of it.
//
// tm/ is toolchain-owned — the scaffold rewrites it on every add-target, and
// model/guide/guide.aontu is the one file a user owns (merged separately by
// create-sdkgen) — so removing what the toolchain says should not be there is
// consistent with how the rest of that tree is already treated.
function pruneStaleTemplates(
  ctx$: any,
  fromDir: string,
  toRel: string,
  trim: RegExp[],
  dryrun?: boolean,
) {
  const { log } = ctx$
  const fs = ctx$.fs()
  const folder = ctx$.folder ?? '.'
  const destDir = Path.join(folder, toRel)

  const listRel = (root: string): string[] => {
    const out: string[] = []
    const walk = (dir: string, rel: string) => {
      let entries: any[]
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      }
      catch (e: any) {
        return
      }
      for (const ent of entries) {
        const child = Path.join(dir, ent.name)
        const childRel = '' === rel ? ent.name : rel + '/' + ent.name
        if (ent.isDirectory()) {
          walk(child, childRel)
        }
        else {
          out.push(childRel)
        }
      }
    }
    walk(root, '')
    return out
  }

  const sourceFiles = listRel(fromDir)

  // An unreadable source tree must not be read as "everything is stale" — that
  // would empty the destination.
  if (0 === sourceFiles.length) {
    return
  }

  // What SHOULD be present: source, minus anything the trim excludes. The trim
  // patterns are matched against the source-relative path, the same way Copy
  // applies them.
  const trimmed = (rel: string) => trim.some((re) => re.test(rel))
  const want = new Set(sourceFiles.filter((rel) => !trimmed(rel)))

  const stale = listRel(destDir).filter((rel) => !want.has(rel))
  if (0 === stale.length) {
    return
  }

  // A DRY RUN must not delete. This prune calls `fs.unlinkSync` directly, and
  // jostraca enforces `control.dryrun` only inside its own write layer — so
  // `-y target add <t>` previewed the copies and then really removed every
  // stale template, which is the opposite of what the flag promises and
  // exactly the blast radius a maintainer runs `-y` to inspect. Report the
  // deletions instead, in the same shape the copies are reported.
  if (dryrun) {
    log.info({
      point: 'target-template-prune', target: toRel, count: stale.length,
      files: stale, dryrun: true,
      note: toRel + ': would remove ' + stale.length +
        ' stale template(s) — ** DRY RUN **, nothing was written'
    })
    for (const rel of stale) {
      log.info({
        point: 'target-template-prune-file', target: toRel,
        file: toRel + '/' + rel, dryrun: true,
        note: 'would remove ' + toRel + '/' + rel
      })
    }
    return
  }

  const removed: string[] = []
  for (const rel of stale) {
    try {
      fs.unlinkSync(Path.join(destDir, rel))
      removed.push(rel)
    }
    catch (e: any) {
      log.warn({
        point: 'target-template-prune', target: toRel, file: rel,
        note: 'could not remove stale template ' + rel + ': ' + e.message
      })
    }
  }

  if (0 < removed.length) {
    log.info({
      point: 'target-template-prune', target: toRel, count: removed.length,
      files: removed,
      note: toRel + ': removed ' + removed.length +
        ' stale template(s) the toolchain no longer provides for this SDK'
    })
  }
}


function trimFeatures(
  ctx$: any,
  tfolder: string,
  torigname: string,
  tname: string,
  features: string[],
): RegExp[] {
  const { log } = ctx$
  const fs = ctx$.fs()

  const cfg = readTargetFeature(ctx$, tfolder, torigname, tname)

  if (false === cfg.trim) {
    log.info({
      point: 'target-feature-trim', target: tname, trim: false,
      note: tname + ': feature trim disabled, copying all feature source'
    })
    return []
  }

  // `base` is not a declared feature — it is the always-present foundation
  // every other feature builds on — so it is never a trim candidate.
  const selected = new Set(['base', ...(features ?? [])])

  const available = availableFeatures(fs, tfolder)
  const drop = findFeatureSources(fs, tfolder + '/tm/' + torigname, available)
    .filter((s) => !selected.has(s.name))

  const trimmed = 0 < drop.length

  log.info({
    point: 'target-feature-trim', target: tname, trim: true,
    drop: drop.map((s) => s.name),
    note: tname + ': ' + (trimmed ?
      ('dropping ' + drop.length + ' unselected feature source entries') :
      'all available features selected')
  })

  return [
    ...featureExcludes(drop),
    // The cross-feature test suite is only excluded when something WAS
    // trimmed; a project carrying the full set keeps its feature tests.
    ...(trimmed ? fullsetExcludes(cfg.fullset) : []),
  ]
}


// Load a target's `feature` declaration from its own model file.
//
// The target being added is not in the in-memory model yet (that is what
// `target add` is for), so this reads the very file that is about to be
// copied into `model/target/`. Each shipped target model is self-contained,
// so Aontu can resolve it on its own.
function readTargetFeature(
  ctx$: any,
  tfolder: string,
  torigname: string,
  tname: string,
): { trim: boolean, fullset: string[] } {
  const { log } = ctx$
  const fs = ctx$.fs()

  const path = tfolder + '/model/target/' + torigname + '.aontu'

  try {
    const errs: any[] = []
    const model = new Aontu().generate(fs.readFileSync(path, 'utf8'), { path, errs })

    if (0 < errs.length) {
      throw new Error(errs.map((e: any) => e.msg || String(e)).join('\n'))
    }

    const feature = model?.main?.[KIT]?.target?.[torigname]?.feature ?? {}

    return {
      trim: false !== feature.trim,
      fullset: Array.isArray(feature.fullset) ? feature.fullset : [],
    }
  }
  catch (err: any) {
    log.warn({
      point: 'target-feature-model', target: tname, path,
      err: err.message,
      note: tname + ': cannot read target model (' + err.message +
        '); copying all feature source'
    })
    return { trim: false, fullset: [] }
  }
}


// Last path segment of a ref. A ref may be a bare target name ('go'), a
// package-relative path ('@acme/kit/go'), or an ABSOLUTE path — and on Windows
// an absolute path is separated by `\`, so splitting on '/' alone hands back
// the whole path as the target name and every tree lookup below then misses.
// On POSIX Path.sep IS '/', so this is the same split it always was.
function lastSegment(ref: string): string {
  return getelem(ref.split('/').flatMap((p: string) => p.split(Path.sep)), -1)
}


function resolveTarget(tref: string, ctx$: any) {
  let tname = tref
  let torigname = tref
  let tfolder = 'node_modules/@voxgig/sdkgen/project/.sdk'

  const root = ctx$.folder
  const fs = ctx$.fs()

  let fulltfolder = Path.normalize(Path.join(root, tfolder))
  tname = lastSegment(tref)

  let aliasref = tref
  torigname = lastSegment(aliasref)
  const aliasing = tref.split('~')
  if (1 < aliasing.length) {
    aliasref = aliasing[0]
    tname = aliasing.slice(1).join('~')
    torigname = lastSegment(aliasref)
  }

  const search: string[] = []
  let found = false
  // Windows: an absolute ref is `D:\a\...` or `D:/a/...`, and a Path.join'd
  // one carries backslashes, so neither `includes('/')` nor `startsWith('/')`
  // recognises it. Path.isAbsolute and Path.sep are platform-correct and
  // reduce to the same answers on POSIX.
  if (aliasref.includes('/') || aliasref.includes(Path.sep)) {
    // NOTE: the last path element of the ref is the target name, not a folder.
    const aliasbase = Path.dirname(aliasref)

    if (!Path.isAbsolute(aliasref)) {
      fulltfolder = Path.normalize(Path.join(root, 'node_modules', aliasbase, '.sdk'))
      search.push(fulltfolder)
      found = fs.existsSync(fulltfolder)

      if (!found) {
        fulltfolder = Path.normalize(Path.join(root, aliasbase, '.sdk'))
        search.push(fulltfolder)
        found = fs.existsSync(fulltfolder)
      }
    }
    else {
      fulltfolder = Path.normalize(Path.join(aliasbase, '.sdk'))
      search.push(fulltfolder)
      found = fs.existsSync(fulltfolder)
    }
  }
  else {
    search.push(fulltfolder)
    found = fs.existsSync(fulltfolder)
  }

  if (!found) {
    throw new Error('Target folder not found in:\n' + search.join('\n  '))
  }

  // `base` is the target folder relative to the project root. Compare with the
  // PLATFORM separator: on Windows `root + '/'` never prefixes a normalised
  // absolute path, so the root would not be stripped and `base` would stay
  // absolute. Normalise both sides first for the same reason.
  const nroot = Path.normalize(root)
  const rootslash = nroot.endsWith(Path.sep) ? nroot : nroot + Path.sep
  const out = {
    tname,
    tfolder: fulltfolder,
    torigname,
    // `/`-normalised, unlike `tfolder`. `base` is the one value here that
    // gets WRITTEN INTO A COMMITTED FILE (the `'BASE'` substitution in the
    // copied target model), so it must not depend on the OS that ran the
    // add: on Windows Path.join yields
    // `node_modules\@voxgig\sdkgen\project\.sdk`, so the same project
    // resynced on Linux and on Windows produced two different model files
    // and each churned the other's. Forward slashes are accepted by every
    // Node path API on Windows, so the readers (feature_add's fan-out,
    // doctor's re-resolution) are unaffected.
    base: (fulltfolder.startsWith(rootslash)
      ? fulltfolder.slice(rootslash.length)
      : fulltfolder).split(Path.sep).join('/')
  }

  return out
}


export {
  action_target,
  target_add,
  resolveTarget,
  trimFeatures,
  readTargetFeature,
}
