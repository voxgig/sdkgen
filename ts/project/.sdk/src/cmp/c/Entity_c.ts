
import * as Path from 'node:path'

import {
  cmp, camelify,
  File, Content, Folder, Fragment,
  entityClassName, entityCollection, entitySlots,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_c'
import { cVarName } from './utility_c'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)
  const evar = cVarName(entity.name)

  const entrep = {
    ...stdrep,
  }

  const ff = Path.normalize(__dirname + '/../../../src/cmp/c/fragment/')

  Folder({ name: 'entity' }, () => {

    File({ name: evar + '.c' }, () => {

      const opnames = Object.keys(entity.op || {})

      // For each CRUD op: splice the real implementation when the spec
      // defines it, otherwise emit a stub that errors at runtime (so the
      // vtable is complete and the file compiles). Tag-form keys (`#LoadOp`)
      // match the marker line `// #LoadOp`.
      const opfrags =
        (['load', 'list', 'create', 'update', 'patch', 'remove']
          .reduce((a: any, opname: string) =>
          (a['#' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ?
              ({ indent }: any) => {
                // The stub mirrors the real signature: ops resolve to the
                // ENTITY (`list` to a NULL-terminated array of them), so an
                // unsupported op declares the same return type as the vtable.
                const ret = 'list' === opname ? 'Entity**' : 'Entity*'
                Content({ indent }, `static ${ret} ${evar}_${opname}(Entity* e, voxgig_value* reqarg, voxgig_value* ctrl, PNError** err) {
  (void)e; (void)reqarg; (void)ctrl;
  *err = unsupported_op("${opname}", "${entity.name}");
  return NULL;
}
`)
                if (['create', 'update', 'patch'].includes(opname)) {
                  Content({ indent }, `
static Entity* ${evar}_${opname}_with(Entity* e, voxgig_value* reqarg, const BinaryField* sources,
                                 size_t nsources, voxgig_value* ctrl, PNError** err) {
  (void)sources; (void)nsources;
  return ${evar}_${opname}(e, reqarg, ctrl, err);
}
`)
                }
              } :
              ({ indent }: any) => {
                EntityOperation({ ff, opname, indent, entity, entrep, cls, evar })
              }, a), {}))

      // The entity's binary slots, by name; "" is its own bytes.
      const slots = entitySlots(entity)
      const cstr = (v: any) => null == v ? 'NULL' : JSON.stringify(String(v))
      const binarySlot = ({ indent }: any) => Content({ indent }, 0 === slots.length ? `
static const BinarySlotDef* ${evar}_binary_slots(Entity* e, size_t* n) {
  (void)e;
  *n = 0;
  return NULL;
}
` : `
static const BinarySlotDef ${evar}_BINARY_SLOTS[] = {
${slots.map((s: any) => `  { ${cstr(s.name)}, ${cstr(s.action)}, ${cstr(s.read)}, ${cstr(s.write)} },`).join('\n')}
};

static const BinarySlotDef* ${evar}_binary_slots(Entity* e, size_t* n) {
  (void)e;
  *n = sizeof(${evar}_BINARY_SLOTS) / sizeof(${evar}_BINARY_SLOTS[0]);
  return ${evar}_BINARY_SLOTS;
}

// The handle of one of this entity's binary slots: ${slots.map((s: any) => '"' + s.name + '"').join(', ')}.
BinaryHandle ${evar}_binary(Entity* e, const char* slot) {
  return entity_binary(e, slot);
}
`)

      Fragment({
        from: ff + 'Entity.fragment.c',
        replace: {
          ...entrep,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,
          EntyClass: cls,
          entyvar: evar,

          // Matches every `// #<Stage>-Hook` marker in run_op.
          '#Entity-Hook': ({ name, indent }: any) =>
            Content({ indent }, `feature_hook_util(ctx, "${name}");`),

          ...opfrags,

          '#BinarySlot': binarySlot,
        }
      })

    })
  })
})


export {
  Entity
}
