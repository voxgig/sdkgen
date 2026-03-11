
import {
  cmp, camelify,
  Content, Fragment
} from '@voxgig/sdkgen'


import { formatGoMap } from './utility_go'


const EntityOperation = cmp(function Operation(props: any) {
  const { model } = props.ctx$
  const { ff, opname, entity, entrep } = props

  let { indent } = props

  if (null != indent) {
    indent = indent.substring(1)
    if ('' == indent) {
      indent = undefined
    }
  }

  const entop = entity.op[opname]

  Fragment({
    from: ff + '/Entity' + camelify(opname) + 'Op.fragment.go',
    eject: ['// EJECT-START', '// EJECT-END'],
    indent,
    replace: {
      ...entrep,
      ProjectName: model.const.Name,
      EntityName: entity.Name,
      entityname: entity.name,
      '#Feature-Hook': ({ name, indent }: any) =>
        Content({ indent }, `
sdk.FeatureHook(ctx, "${name}")
`)

    }
  })
})


export {
  EntityOperation
}
