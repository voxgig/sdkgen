
import {
  Jostraca,
  Project,
  File,
  Folder,
  Content,
  Copy,
  cmp,
  each,
} from 'jostraca'


import { SdkGenError } from '../utility'


const CMD_MAP: any = {
  add: cmd_feature_add
}

const BASE = 'node_modules/@voxgig/sdkgen'

async function action_feature(args: any[], ctx: any) {

  const cmdname = args[1]

  const cmd = CMD_MAP[cmdname]

  if (null == cmd) {
    throw new SdkGenError('Unknown feature cmd: ' + cmdname)
  }

  await cmd(args, ctx)
}


async function cmd_feature_add(args: any[], ctx: any) {

  let features = args[2]
  features = 'string' === typeof features ? features.split(',') : features

  const jostraca = Jostraca()

  const opts = {
    fs: ctx.fs,
    folder: ctx.folder,
    log: ctx.log.child({ cmp: 'jostraca' }),
    meta: { model: ctx.model, tree: ctx.tree }
  }

  await jostraca.generate(opts, () => FeatureRoot({ features }))

}


const FeatureRoot = cmp(function FeatureRoot(props: any) {
  const { ctx$, features } = props

  // TODO: model should be a top level ctx property
  const model = ctx$.model = ctx$.meta.model
  const target = model.main.sdk.target

  Project({}, () => {
    each(features, (n) => {
      const name = n.val$
      // TODO: validate feature is a-z0-9-_. only

      Folder({ name: 'model/feature' }, () => {
        Copy({
          from: BASE + '/tm/generate/model/feature/' + name + '.jsonic',
          exclude: true
        })
      })

      each(target, (target) =>
        Folder({ name: 'tm/' + target.name + '/src/feature/' + name }, () => {
          Copy({
            from: BASE + '/tm/generate/tm/' + target.name + '/src/feature/' + name,
            exclude: true
          })
        }))

    })
  })

  modifyModel({
    features,
    model: ctx$.meta.model,
    tree: ctx$.meta.tree,
    fs: ctx$.fs
  })

})


async function modifyModel({ features, model, tree, fs }: any) {
  // TODO: This is a kludge.
  // Aontu should provide option for as-is AST so that can be used
  // to find injection point more reliably

  const path = tree.url
  let src = fs().readFileSync(path, 'utf8')

  // Inject feature file references into model
  features.sort().map((feature: string) => {
    const lineRE =
      new RegExp(`main:\\s+sdk:\\s+feature:\\s+${feature}:\\s+@"feature/${feature}.jsonic"`)
    if (!src.match(lineRE)) {
      src = src.replace(/(main:\s+sdk:\s+feature:\s+\{\s*\}\n)/, '$1' +
        `main: sdk: feature: ${feature}: @"feature/${feature}.jsonic"\n`)
    }
  })

  fs().writeFileSync(path, src)
}


export {
  action_feature
}
