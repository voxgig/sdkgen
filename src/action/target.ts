
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


  const { model } = ctx$

  // TODO: jostraca - make from value easier to specify 
  const sdkfolder = 'node_modules/@voxgig/sdkgen/project/.sdk'

  Project({}, () => {
    each(targets, (n) => {
      // TODO: validate target is a-z0-9-_. only
      const name = n.val$

      Folder({ name: 'model/target' }, () => {
        Copy({
          from: sdkfolder + '/model/target/' + name + '.jsonic',
          // exclude: true
        })
        File({ name: 'target-index.jsonic' }, () => UpdateIndex({
          content: ctx$.meta.content.target_index,
          names: targets,
        }))
      })

      Folder({ name: 'src/cmp/' + name }, () => {
        Copy({
          from: sdkfolder + '/src/cmp/' + name,
          // exclude: true
        })
      })

      Folder({ name: 'tm/' + name }, () => {
        Copy({
          from: sdkfolder + '/tm/' + name,
          exclude: [/src\/feature/],
          replace: {

            // TODO: standard replacements
            ProjectName: model.const.Name,
          }
        })
        Folder({ name: 'src/feature' }, () => {
          Copy({ from: sdkfolder + '/tm/' + name + '/src/feature/README.md' })

          Folder({ name: 'base' }, () => {
            Copy({ from: sdkfolder + '/tm/' + name + '/src/feature/base' })
          })
        })
      })
    })
  })
})


export {
  action_target,
  target_add,
}
