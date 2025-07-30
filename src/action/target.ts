
import Path from 'node:path'

import {
  Project,
  Folder,
  Copy,
  File,
  cmp,
  each,
} from 'jostraca'

import { showChanges } from '@voxgig/util'

import { getelem } from '@voxgig/struct'

import type {
  ActionContext,
  ActionResult,
} from '../types'

import { SdkGenError } from '../utility'

import {
  feature_add
} from './feature'

import {
  UpdateIndex,
  loadContent,
} from './action'


const CMD_MAP: any = {
  add: cmd_target_add
}


type Target = {
  origin: string
  name: string
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
  const targets_arg = args[2]
  const targets: string[] =
    'string' === typeof targets_arg ? targets_arg.split(',') : targets_arg

  return target_add(targets, actx)
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
      tree: actx.tree,
      content: loadContent(actx, 'target')
    },
    model: actx.model,
  }

  opts.log.info({
    point: 'target-start',
    note: (actx.opts.dryrun ? '** DRY RUN **' : '')
  })


  const jres = await jostraca.generate(opts, () => TargetRoot({ targets, actx }))

  showChanges(opts.log, 'target-result', jres)

  const features = Object.keys(actx.model.main.sdk.feature)
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
  const { ctx$, targets } = props
  const { model, log } = ctx$

  // TODO: jostraca - make from value easier to specify 
  // const tfolder = 'node_modules/@voxgig/sdkgen/project/.sdk'

  Project({}, () => {
    each(targets, (n) => {
      const tref = n.val$

      log.info({
        point: 'target-build',
        target: tref,
        note: tref
      })

      const { tname, tfolder, torigname, base } = resolveTarget(tref, ctx$)
      const targetNote = tname + (tname != tref ? ' ref:' + tref : '')

      log.info({
        point: 'target-name', name: tname, folder: tfolder,
        target: tref,
        tname,
        note: tname + (tname != torigname ? 'original' + torigname : '') + ' from:' + tfolder
      })

      Folder({ name: 'model/target' }, () => {
        Copy({
          from: tfolder + '/model/target/' + torigname + '.jsonic',
          // exclude: true
          replace: {
            "'BASE'": "'" + base + "'"
          }
        })
        File({ name: 'target-index.jsonic' }, () => UpdateIndex({
          content: ctx$.meta.content.target_index,
          // names: targets,
          names: [tname]
        }))
      })

      Folder({ name: 'src/cmp/' + tname }, () => {
        Copy({
          from: tfolder + '/src/cmp/' + torigname,
          // exclude: true
        })
      })

      Folder({ name: 'tm/' + tname }, () => {
        Copy({
          from: tfolder + '/tm/' + torigname,
          exclude: [/src\/feature/],
          replace: {

            // TODO: standard replacements
            ProjectName: model.const.Name,
          }
        })

        Folder({ name: 'src/feature' }, () => {
          Copy({ from: tfolder + '/tm/' + torigname + '/src/feature/README.md' })

          Folder({ name: 'base' }, () => {
            Copy({ from: tfolder + '/tm/' + torigname + '/src/feature/base' })
          })
        })
      })

      log.info({
        point: 'target-done', target: tref, note: targetNote
      })

    })
  })
})


function resolveTarget(tref: string, ctx$: any) {
  let tname = tref
  let torigname = tref
  let tfolder = 'node_modules/@voxgig/sdkgen/project/.sdk'

  const root = ctx$.folder
  const fs = ctx$.fs()

  let fulltfolder = Path.normalize(Path.join(root, tfolder))
  tname = getelem(tref.split('/'), -1)

  let aliasref = tref
  torigname = getelem(aliasref.split('/'), -1)
  const aliasing = tref.split('~')
  if (1 < aliasing.length) {
    aliasref = aliasing[0]
    tname = aliasing.slice(1).join('~')
    torigname = getelem(aliasref.split('/'), -1)
  }

  const search: string[] = []
  let found = false
  if (aliasref.includes('/')) {
    // NOTE: the last path element of the ref is the target name, not a folder.
    const aliasbase = Path.dirname(aliasref)

    if (!aliasref.startsWith('/')) {
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

  const rootslash = root.endsWith('/') ? root : root + '/'
  const out = {
    tname,
    tfolder: fulltfolder,
    torigname,
    base: fulltfolder.replace(rootslash, '')
  }

  return out
}


export {
  action_target,
  target_add,
}
