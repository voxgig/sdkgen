
import Path from 'node:path'

import {
  Jostraca,
  Project,
  File,
  Folder,
  Copy,
  cmp,
  each,
} from 'jostraca'

import { showChanges } from '@voxgig/util'

import type {
  ActionContext,
  ActionResult,
} from '../types'

import { SdkGenError } from '../utility'


import {
  UpdateIndex,
  loadContent,
} from './action'


const CMD_MAP: any = {
  add: cmd_feature_add
}

const BASE = 'node_modules/@voxgig/sdkgen'


async function action_feature(args: string[], actx: ActionContext): Promise<ActionResult> {

  const cmdname = args[1]

  const cmd = CMD_MAP[cmdname]

  if (null == cmd) {
    throw new SdkGenError('Unknown feature cmd: ' + cmdname)
  }

  return await cmd(args, actx)
}


async function cmd_feature_add(args: string[], actx: ActionContext): Promise<ActionResult> {

  const features_arg = args[2]
  const features: string[] =
    'string' === typeof features_arg ? features_arg.split(',') : features_arg

  return feature_add(features, actx)
}


async function feature_add(features: string[], actx: ActionContext): Promise<ActionResult> {

  const jostraca = Jostraca()

  const opts = {
    fs: actx.fs,
    folder: actx.folder,
    log: actx.log.child({ cmp: 'jostraca' }),
    meta: {
      // model: actx.model,
      tree: actx.tree,
      content: loadContent(actx, 'feature')
    },
    model: actx.model
  }

  opts.log.info({
    point: 'feature-start',
    note: (actx.opts.dryrun ? '** DRY RUN **' : '')
  })

  const jres = await jostraca.generate(opts, () => FeatureRoot({ features }))

  showChanges(opts.log, 'feature-result', jres)

  opts.log.info({
    point: 'feature-end',
    note: (actx.opts.dryrun ? '** DRY RUN **' : '')
  })

  return {
    jres
  }
}


const FeatureRoot = cmp(function FeatureRoot(props: any) {
  const { ctx$, features } = props
  const { model, log } = ctx$

  const target = model.main.sdk.target

  Project({}, () => {
    each(features, (n) => {
      const fname = n.val$
      // TODO: validate feature is a-z0-9-_. only

      log.info({
        point: 'feature-build',
        feature: fname,
        note: fname
      })


      Folder({ name: 'model/feature' }, () => {
        Copy({
          // TODO: these paths needs to be parameterised
          from: BASE + '/project/.sdk/model/feature/' + fname + '.jsonic',
          exclude: true
        })
        File({ name: 'feature-index.jsonic' }, () => UpdateIndex({
          content: ctx$.meta.content.feature_index,
          names: features,
        }))
      })

      each(target, (target) =>
        Folder({ name: 'tm/' + target.name + '/src/feature/' + fname }, () => {
          const from = Path.join(
            (target.base || Path.join(BASE, '/project/.sdk')),
            'tm',
            target.name,
            '/src/feature/',
            fname
          )

          Copy({
            // from: BASE + '/project/.sdk/tm/' + target.name + '/src/feature/' + name,
            from,
            exclude: true
          })
        }))

      log.info({
        point: 'feature-done', feature: fname,
        note: fname
      })
    })
  })

})


export {
  feature_add,
  action_feature,
}
