
import Path from 'node:path'

import {
  Jostraca,
  Project,
  Folder,
  Copy,
  File,
  Content,
  cmp,
  each,
} from 'jostraca'

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
  console.log('ARGS', args)

  const targets_arg = args[2]
  const targets: string[] =
    'string' === typeof targets_arg ? targets_arg.split(',') : targets_arg

  console.log('TARGETS', targets)

  return target_add(targets, actx)
}


// Code API
async function target_add(targets: string[], actx: ActionContext): Promise<ActionResult> {
  const jostraca = Jostraca()

  const opts = {
    fs: actx.fs,
    folder: actx.folder,
    log: actx.log.child({ cmp: 'jostraca' }),
    meta: {
      model: actx.model,
      tree: actx.tree,
      content: loadContent(actx, 'target')
    },
    model: actx.model
  }

  const jres = await jostraca.generate(opts, () => TargetRoot({ targets }))

  const features = Object.keys(actx.model.main.sdk.feature)

  feature_add(features, actx)

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

      log.info({ point: 'target-start', target: tref, note: tref })

      const { tname, tfolder, torigname, base } = resolveTarget(tref, ctx$)

      log.info({
        point: 'target-name', name: tname, folder: tfolder,
        note: tname + (tname != torigname ? 'original' + torigname : '') + ' from:' + tfolder
      })


      // TODO: validate target name is a-z0-9-_. only
      // const tname = tref

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
        point: 'target-end', target: tref, note: tname +
          (tname != tref ? ' ref:' + tref : '')
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

  console.log('resolveTarget', tref, out)
  return out
}


export {
  action_target,
  target_add,
}
