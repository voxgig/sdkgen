
import * as Path from 'node:path'

import {
  cmp, camelify,
  File, Content, Folder, Fragment,
  entityClassName,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_zig'
import { zigVarName } from './utility_zig'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  const entityColl = getModelPath(model, `main.${KIT}.entity`)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  const ff = Path.normalize(__dirname + '/../../../src/cmp/zig/fragment/')

  // Entity files go to entity/ as one file per entity.
  Folder({ name: 'entity' }, () => {

    File({ name: zigVarName(entity.name) + '.' + target.ext }, () => {

      const opnames = Object.keys(entity.op)

      // For each CRUD op: if the spec defines it, splice in the real
      // implementation. Otherwise emit a stub returning the unsupported_op
      // error. Tag-form keys (`#LoadOp`) match `// #LoadOp` and capture the
      // marker's indent, so the spliced method nests inside the struct.
      const opfrags =
        (['load', 'list', 'create', 'update', 'remove']
          .reduce((a: any, opname: string) =>
          (a['#' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ?
              ({ indent }: any) => {
                const arg = ('create' === opname || 'update' === opname) ?
                  'reqdata' : 'reqmatch'
                Content({ indent }, `pub fn ${opname}(self: *EntyClass, _${arg}: Value, _ctrl: Value) OpResult {
    _ = _${arg};
    _ = _ctrl;
    return .{ .err = h.unsupported_op("${opname}", self.name) };
}
`)
              } :
              ({ indent }: any) => {
                EntityOperation({ ff, opname, indent, entity, entrep, cls })
              }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.zig',
        replace: {
          ...entrep,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          EntyClass: cls,

          // Matches every `// #<Stage>-Hook` marker in run_op (where `ctx` is
          // the operation context). // comments -> default marker works.
          '#Entity-Hook': ({ name, indent }: any) =>
            Content({ indent }, `self.utility.feature_hook(ctx, "${name}");`),

          ...opfrags,
        }
      })

    })
  })
})



export {
  Entity
}
