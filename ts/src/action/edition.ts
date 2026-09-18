import { kindCollection } from '../helpers/kindCollection'

import { cmp, each, Copy, Folder, Project } from 'jostraca'

import type {
  ActionContext,
  ActionResult,
} from '../types'

import { SdkGenError } from '../utility'

import { templateReplacements } from '../helpers/stdrep'

import { copyOpts } from '../helpers/junk'

import { resolveKind, kindModel, kindIndex, kindTrees } from './kind'
import type { TreeDef } from './kind'

import { registerInstalled } from './resolve'

import { aliasCmpTree, pruneStaleTemplates } from './target'

import { parseAddNames, loadContent, ensureModelInclude } from './action'


// The PREFIX of a edition item's component tree (`src/cmp/edition/`), for the
// alias rewrite. Derived from the registry's declaration rather than written
// out a second time, so the two cannot disagree about where edition components
// live.
const NAME_MARK = '\u0001name\u0001'

function cmpBase(): string {
  const cmp = kindTrees('edition', NAME_MARK)
    .find((t: TreeDef) => 'none' === t.replace)

  return null == cmp ? 'src/cmp/edition/' : cmp.path.split(NAME_MARK)[0]
}


const CMD_MAP: any = Object.assign(Object.create(null), {
  add: cmd_edition_add,
})


async function action_edition(
  args: string[], actx: ActionContext,
): Promise<ActionResult> {
  const cmdname = args[1]
  const cmd = CMD_MAP[cmdname]

  if (null == cmd) {
    throw new SdkGenError(
      'Unknown edition cmd: ' + cmdname + ' (expected: ' +
      Object.keys(CMD_MAP).sort().join(', ') + ')')
  }

  return await cmd(args, actx)
}


async function cmd_edition_add(
  args: string[], actx: ActionContext,
): Promise<ActionResult> {
  return edition_add(parseAddNames(args), actx)
}


async function edition_add(
  edition: string[], actx: ActionContext,
): Promise<ActionResult> {
  edition = edition.map(ref => !ref.includes('/') && !ref.includes('\\') &&
    !kindCollection(actx.model, 'edition')[ref.split('~')[0]] ? '@voxgig/docgen/project/' + ref : ref)
  const jostraca = actx.jostraca

  const opts = {
    fs: actx.fs,
    folder: actx.folder,
    log: actx.log.child({ cmp: 'jostraca' }),
    meta: {
      url: actx.url,
      content: loadContent(actx, 'edition', { edition: '# Docs\n' }),
    },
    model: actx.model,
    control: {
      dryrun: !!actx.opts.dryrun
    },
    cmp: copyOpts(),
  }

  opts.log.info({
    point: 'edition-start',
    note: (actx.opts.dryrun ? '** DRY RUN **' : '')
  })

  preflight(edition, actx)

  ensureModelInclude(actx, 'edition')

  // Later items in the command read this in-memory registration.
  registerInstalled('edition', edition, actx)

  const jres = await jostraca.generate(opts, () =>
    EditionRoot({ edition, actx }))

  return { jres }
}


function preflight(edition: string[], actx: ActionContext) {
  const fs = actx.fs()

  for (const ref of edition) {
    const source = resolveKind(ref, 'edition', actx as any)

    for (const tree of kindTrees('edition', source.origname)) {
      if (!tree.required) {
        continue
      }

      const from = source.folder + '/' + tree.path

      if (!fs.existsSync(from)) {
        throw new SdkGenError(
          'Docs ' + source.name + ': required tree not found: ' + from +
          '\n  a edition item needs its components (' + tree.path +
          '); nothing has been written')
      }
    }
  }
}


const EditionRoot = cmp(function EditionRoot(props: any) {
  const { ctx$, edition } = props
  const { log } = ctx$

  Project({}, () => {
    const dnames: string[] = []

    each(edition, (n: any) => {
      const dref = n.val$

      log.info({ point: 'edition-build', edition: dref, note: dref })

      const source = resolveKind(dref, 'edition', ctx$)

      dnames.push(source.name)

      log.info({
        point: 'edition-name', edition: source.name, folder: source.folder, ref: dref,
        note: source.name +
          (source.name !== source.origname ?
            ' (from ' + source.origname + ')' : '') +
          ' from:' + source.folder
      })

      Folder({ name: 'model/edition' }, () => kindModel({
        ctx$, kind: 'edition', source, names: dnames,
        content: ctx$.meta.content.edition_index,
      }))

      // Both ends of every tree come from the registry's ONE declaration,
      // resolved twice: the source carries the ORIGIN name, the destination
      // the installed one. Deriving the source path by substituting inside
      // the destination path would corrupt any item whose name also appears
      // in the fixed part of the path.
      const dest = kindTrees('edition', source.name)
      const from = kindTrees('edition', source.origname)

      dest.forEach((tree: TreeDef, i: number) => {
        if ('template' === tree.replace) {
          pruneStaleTemplates(
            ctx$, source.folder + '/' + from[i].path, tree.path, [],
            !!props.actx?.opts?.dryrun)
        }

        copyTree(ctx$, source, tree, from[i].path)
      })

      log.info({ point: 'edition-done', edition: source.name, note: source.name })
    })

    if (0 < dnames.length) {
      Folder({ name: 'model/edition' }, () => kindIndex({
        kind: 'edition', names: dnames,
        content: ctx$.meta.content.edition_index,
      }))
    }
  })
})


// One tree, copied from the origin path to the installed one.
//
// An optional tree the source does not ship is simply not copied — that is
// what `required: false` means, and a edition item whose every byte is generated
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
      point: 'edition-tree-absent', edition: source.name, tree: tree.path, from,
      note: source.name + ': the source ships no ' + frompath +
        ', nothing to copy'
    })
    return
  }

  if (source.name !== source.origname && 'none' === tree.replace) {
    aliasCmpTree(ctx$, from, tree.path, source.origname, source.name,
      cmpBase())
    return
  }

  Folder({ name: tree.path }, () => {
    Copy({
      from,
      ...('template' === tree.replace ?
        { replace: templateReplacements(ctx$.model, source.name) } : {}),
    })
  })
}


export {
  action_edition,
  edition_add,
}
