
import * as Path from 'node:path'

import {
  cmp, each, camelify,
  File, Content, Folder, Fragment, Line, FeatureHook,
} from '@voxgig/sdkgen'



const Operation = cmp(function Operation(props: any) {
  // console.log('OP', props)

  const { ff, opname, indent, entity } = props

  const entop = entity.op[opname]
  const path = entop.path
  // console.log('ENTOP', entop)

  // TODO: move up to to common Entity
  const params = JSON.stringify(path
    .match(/\{[^}]+\}/g)
    .map((p: string) => p.substring(1, p.length - 1))
    .filter((p: string) => null != p && '' !== p))

  const hasp = '' != entop.place

  Fragment({
    from: ff + '/Entity' + camelify(opname) + 'Op.fragment.js',
    indent,
    replace: {
      Name: entity.Name,
      PATH: entop.path,
      "['PARAM']": params,
      "'INWARD'":
        entop.inward ||
        'ctx.result.body' + ('' === entop.place ? '' : '.' + entop.place),
      "'OUTWARD'":
        entop.outward ||
        (hasp ? '({' + entop.place + ': ' : '') + 'ctx.op.data' + (hasp ? '})' : ''),

      'class EntityOperation { // REMOVED': '',
      '} // REMOVED': '',

      '#Feature-Hook': ({ name, indent }: any) =>
        FeatureHook({ name }, (f: any) =>
          Line({ indent },
            `${f.await ? 'await ' : ''}this.#features.${f.name}.${name}(ctx)`)),
    }
  })
})



const Entity = cmp(function Entity(props: any) {
  const { target, entity } = props
  // const { model } = props.ctx$

  const ff = Path.normalize(__dirname + '/../../../src/cmp/js/fragment')

  Folder({ name: 'src/entity' }, () => {

    File({ name: entity.Name + 'Entity.' + target.name }, () => {

      const opnames = Object.keys(entity.op)

      const opfrags =
        (['load', 'list', 'create', 'update', 'remove']
          .reduce((a: any, opname: string) =>
          (a['#' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ? '' : ({ indent }: any) => {
              Operation({ ff, opname, indent, entity })
            }, a), {}))

      Fragment({
        from: ff + '/Entity.fragment.js',
        replace: {
          Name: entity.Name,

          ...opfrags,
        }
      })

    })
  })
})


export {
  Entity
}
