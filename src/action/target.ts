
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
  add: cmd_target_add
}

async function action_target(args: any[], ctx: any) {

  const cmdname = args[1]

  const cmd = CMD_MAP[cmdname]

  if (null == cmd) {
    throw new SdkGenError('Unknown target cmd: ' + cmdname)
  }

  await cmd(args, ctx)
}


async function cmd_target_add(args: any[], ctx: any) {

  let targets = args[2]
  targets = 'string' === typeof targets ? targets.split(',') : targets

  const jostraca = Jostraca()

  const opts = {
    fs: ctx.fs,
    folder: ctx.folder,
    log: ctx.log.child({ cmp: 'jostraca' }),
    meta: { model: ctx.model, tree: ctx.tree },
    model: ctx.model
  }

  await jostraca.generate(opts, () => TargetRoot({ targets }))

}


const TargetRoot = cmp(function TargetRoot(props: any) {
  const { ctx$, targets } = props

  // TODO: model should be a top level ctx property
  // ctx$.model = ctx$.meta.model

  // console.log('MODEL')
  // console.dir(ctx$.model, { depth: null })

  const { model } = ctx$

  Project({}, () => {
    each(targets, (n) => {
      // TODO: validate target is a-z0-9-_. only
      const name = n.val$

      Folder({ name: 'model/target' }, () => {
        Copy({
          from: 'node_modules/@voxgig/sdkgen/project/.sdk/model/target/' + name + '.jsonic',
          // exclude: true
        })
      })

      Folder({ name: 'src/cmp/' + name }, () => {
        Copy({
          from: 'node_modules/@voxgig/sdkgen/project/.sdk/src/cmp/' + name,
          // exclude: true
        })
      })

      Folder({ name: 'tm/' + name }, () => {
        Copy({
          from: 'node_modules/@voxgig/sdkgen/project/.sdk/tm/' + name,
          exclude: [/src\/feature/],
          replace: {
            Name: model.const.Name,
          }
        })
      })


    })
  })

  modifyModel({
    targets,
    model: ctx$.meta.model,
    tree: ctx$.meta.tree,
    fs: ctx$.fs
  })

})


async function modifyModel({ targets, model, tree, fs }: any) {
  // TODO: This is a kludge.
  // Aontu should provide option for as-is AST so that can be used
  // to find injection point more reliably

  const path = tree.url
  let src = fs().readFileSync(path, 'utf8')

  // Inject target file references into model
  targets.sort().map((target: string) => {
    const lineRE =
      new RegExp(`@"target/${target}.jsonic"`)
    if (!src.match(lineRE)) {
      src = src.replace(/(main:\s+sdk:\s+target:\s+\{\s*\}\n)/, '$1' +
        `@"target/${target}.jsonic"\n`)
    }
  })

  fs().writeFileSync(path, src)
}


export {
  action_target
}
