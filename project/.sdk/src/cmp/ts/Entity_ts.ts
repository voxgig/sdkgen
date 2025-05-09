
import * as Path from 'node:path'

import {
  cmp, each, camelify,
  File, Content, Folder, Fragment, Line, FeatureHook,
} from '@voxgig/sdkgen'



const Operation = cmp(function Operation(props: any) {
  const { ff, opname, indent, entity, entitySDK } = props

  const entop = entity.op[opname]
  const path = entop.path
  // console.log('ENTOP', entop)

  // TODO: move up to to common Entity
  const params = JSON.stringify(path
    .match(/\{[^}]+\}/g)
    .map((p: string) => p.substring(1, p.length - 1))
    .filter((p: string) => null != p && '' !== p))

  const aliasmap = JSON.stringify(entitySDK.alias.field)

  // const hasp = '' != entop.place

  Fragment({
    from: ff + '/Entity' + camelify(opname) + 'Op.fragment.js',
    indent,
    replace: {
      Name: entity.Name,
      PATH: entop.path,
      "['PARAM-LIST']": params,
      "{'ALIAS':'MAP'}": aliasmap,
      "'REQFORM'": JSON.stringify(entop.reqform),
      "'RESFORM'": JSON.stringify(entop.resform),
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
  const { target, entity, entitySDK } = props
  // console.log('ENTITY', props)

  const ff = Path.normalize(__dirname + '/../../../src/cmp/ts/fragment/')

  // Folder({ name: 'src/entity' }, () => {

  //   File({ name: entity.Name + 'Entity.' + target.name }, () => {

  //     const opnames = Object.keys(entity.op)

  //     const opfrags =
  //       (['load', 'list', 'create', 'update', 'remove']
  //         .reduce((a: any, opname: string) =>
  //         (a['#' + camelify(opname) + 'Op'] =
  //           !opnames.includes(opname) ? '' : ({ indent }: any) => {
  //             Operation({ ff, opname, indent, entity, entitySDK })
  //           }, a), {}))

  //     Fragment({
  //       from: ff + 'Entity.fragment.js',
  //       replace: {
  //         Name: entity.Name,

  //         '#Feature-Hook': ({ name, indent }: any) =>
  //           FeatureHook({ name }, (f: any) =>
  //             Line({ indent },
  //               `${f.await ? 'await ' : ''}this.#features.${f.name}.${name}({entity:this})`)),

  //         ...opfrags,
  //       }
  //     })

  //   })
  // })

})


export {
  Entity
}
