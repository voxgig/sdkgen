// `docs add <ref>` — the third kind. See docs/design/sdkgen-packages.md §20.
//
// WHAT A DOCS ITEM IS
//
// A generation target whose destination is a DOCUMENTATION SYSTEM rather than
// a language: a static site, a developer-portal catalogue, a hosted service's
// config. sdkgen ships the kind and no items; the items live in packages
// (`@voxgig/docgen` first), which is what makes the destinations someone
// else's business rather than a list this repo has to guess at.
//
// WHY IT IS NOT A TARGET
//
// Three reasons, argued in §20.2 and worth restating where the code is:
//
//   - a docs item's INPUT is the target collection — a page per SDK, the
//     package table, per-language tabs — so a docs item inside
//     `main.kit.target` would enumerate itself;
//   - `action/feature.ts` fans out with `each(target, …)` and warns
//     `feature-source-missing` per target with no source, so a docs item in
//     that collection would collect one warning per feature, forever
//     (`srcfeature: false` does not help — that flag is read at generate time
//     and never by the add-time fan-out);
//   - `ext`, `comment: line` and `module: name` are required, non-defaulted
//     strings in the target spread, and a site emitting `.md`, `.yml`, `.css`
//     and `.svg` at once has no honest value for `comment.line`.
//
// WHAT THIS ACTION DOES, AND WHAT IT DELIBERATELY DOES NOT
//
// It installs the definition — through the shared spine, so provenance,
// aliasing and the index come along unchanged — and the kind's trees, whose
// paths come from the registry rather than being spelled here.
//
// It does NOT fan out over targets, trim, or prune. A docs item reads the
// target collection at GENERATE time, not at add time: the opposite direction
// and the opposite moment from a feature's fan-out, so sharing that machinery
// would have been a false economy.

import { cmp, each, Copy, Folder, Project } from 'jostraca'

import type {
  ActionContext,
  ActionResult,
} from '../types'

import { SdkGenError } from '../utility'

import { templateReplacements } from '../helpers/stdrep'

import { resolveKind, kindModel, kindTrees } from './kind'
import type { TreeDef } from './kind'

import { registerInstalled } from './resolve'

import { aliasCmpTree } from './target'

import { parseAddNames, loadContent } from './action'


const CMD_MAP: any = Object.assign(Object.create(null), {
  add: cmd_docs_add,
})


async function action_docs(
  args: string[], actx: ActionContext,
): Promise<ActionResult> {
  const cmdname = args[1]
  const cmd = CMD_MAP[cmdname]

  if (null == cmd) {
    throw new SdkGenError(
      'Unknown docs cmd: ' + cmdname + ' (expected: ' +
      Object.keys(CMD_MAP).sort().join(', ') + ')')
  }

  return await cmd(args, actx)
}


async function cmd_docs_add(
  args: string[], actx: ActionContext,
): Promise<ActionResult> {
  return docs_add(parseAddNames(args), actx)
}


// Code API.
async function docs_add(
  docs: string[], actx: ActionContext,
): Promise<ActionResult> {
  const jostraca = actx.jostraca

  const opts = {
    fs: actx.fs,
    folder: actx.folder,
    log: actx.log.child({ cmp: 'jostraca' }),
    meta: {
      url: actx.url,
      // Seeded: no project scaffolded before the docs kind existed has a
      // docs index, and every project alive today is in that position.
      content: loadContent(actx, 'docs', { docs: '# Docs\n' }),
    },
    model: actx.model,
    // Per-call, never left to the Jostraca instance: `generate` runs its own
    // options through OptionsShape first, which fills `control.dryrun: false`
    // and would override the instance flag. The same trap target_add
    // documents.
    control: {
      dryrun: !!actx.opts.dryrun
    },
  }

  opts.log.info({
    point: 'docs-start',
    note: (actx.opts.dryrun ? '** DRY RUN **' : '')
  })

  // Into the IN-MEMORY model before anything reads it. Nothing recompiles
  // `model/sdk.aontu` mid-process, so without this a second docs item in the
  // same command — and anything else later in it — behaves as if the first
  // was never installed. One definition of what gets recorded, shared with
  // `target add` and `package add`.
  registerInstalled('docs', docs, actx)

  const jres = await jostraca.generate(opts, () =>
    DocsRoot({ docs, actx }))

  return { jres }
}


const DocsRoot = cmp(function DocsRoot(props: any) {
  const { ctx$, docs } = props
  const { log } = ctx$

  Project({}, () => {
    // Every installed name seen so far in this run: the index File is
    // re-rendered per item and the last render wins, so each render has to
    // carry all of them.
    const dnames: string[] = []

    each(docs, (n: any) => {
      const dref = n.val$

      log.info({ point: 'docs-build', docs: dref, note: dref })

      // The shared spine: a BARE name resolves against what the model
      // RECORDS, so a docs item installed from a package resolves back to
      // that package on its next add rather than to the bundled scaffold.
      const source = resolveKind(dref, 'docs', ctx$)

      dnames.push(source.name)

      log.info({
        point: 'docs-name', docs: source.name, folder: source.folder, ref: dref,
        note: source.name +
          (source.name !== source.origname ?
            ' (from ' + source.origname + ')' : '') +
          ' from:' + source.folder
      })

      Folder({ name: 'model/docs' }, () => kindModel({
        ctx$, kind: 'docs', source, names: dnames,
        content: ctx$.meta.content.docs_index,
      }))

      // Both ends of every tree come from the registry's ONE declaration,
      // resolved twice: the source carries the ORIGIN name, the destination
      // the installed one. Deriving the source path by substituting inside
      // the destination path would corrupt any item whose name also appears
      // in the fixed part of the path.
      const dest = kindTrees('docs', source.name)
      const from = kindTrees('docs', source.origname)

      dest.forEach((tree: TreeDef, i: number) => {
        copyTree(ctx$, source, tree, from[i].path)
      })

      log.info({ point: 'docs-done', docs: source.name, note: source.name })
    })
  })
})


// One tree, copied from the origin path to the installed one.
//
// An optional tree the source does not ship is simply not copied — that is
// what `required: false` means, and a docs item whose every byte is generated
// legitimately has no template tree.
function copyTree(ctx$: any, source: any, tree: TreeDef, frompath: string) {
  const fs = ctx$.fs()
  const from = source.folder + '/' + frompath

  if (!fs.existsSync(from)) {
    if (tree.required) {
      throw new SdkGenError(
        'Docs ' + source.name + ': required tree not found: ' + from)
    }

    ctx$.log.info({
      point: 'docs-tree-absent', docs: source.name, tree: tree.path, from,
      note: source.name + ': the source ships no ' + frompath +
        ', nothing to copy'
    })
    return
  }

  // An ALIASED component tree cannot be copied verbatim: components are
  // dispatched by the convention `cmp/docs/<n>/Main_<n>`, so files keeping
  // the origin suffix resolve nothing — `Main_apidocs.ts` is invisible to a
  // lookup for `Main_portal`. Same rule as a target's, so the same function
  // does it; jostraca's tree Copy has no per-entry rename hook, which is why
  // an aliased tree is emitted file by file.
  if (source.name !== source.origname && 'none' === tree.replace) {
    aliasCmpTree(ctx$, from, tree.path, source.origname, source.name)
    return
  }

  Folder({ name: tree.path }, () => {
    Copy({
      from,
      // Shared with doctor, which re-applies them before comparing.
      ...('template' === tree.replace ?
        { replace: templateReplacements(ctx$.model, source.name) } : {}),
    })
  })
}


export {
  action_docs,
  docs_add,
}
