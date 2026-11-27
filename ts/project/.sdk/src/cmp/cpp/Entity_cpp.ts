
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

import { EntityOperation } from './EntityOperation_cpp'
import { cppVarName } from './utility_cpp'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  const ff = Path.normalize(__dirname + '/../../../src/cmp/cpp/fragment/')

  Folder({ name: 'entity' }, () => {

    File({ name: cppVarName(entity.name) + '.' + target.ext }, () => {

      const opnames = Object.keys(entity.op || {})

      // For each CRUD op: splice the real method if the spec defines it, else
      // a stub that satisfies the SdkEntity interface but throws at runtime.
      const opfrags =
        (['load', 'list', 'create', 'update', 'patch', 'remove']
          .reduce((a: any, opname: string) =>
          (a['#' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ?
              ({ indent }: any) => {
                const arg = ('create' === opname || 'update' === opname || 'patch' === opname) ?
                  'reqdata' : 'reqmatch'
                // The stub mirrors the real signature: ops resolve to the
                // ENTITY (`list` to a vector of them), so an unsupported op
                // has to declare the same return type to satisfy SdkEntity.
                const ret = 'list' === opname ? 'std::vector<SdkEntityPtr>' : 'SdkEntityPtr'
                Content({ indent }, `${ret} ${opname}(const Value& ${arg}, const Value& ctrl) override {
    (void)${arg}; (void)ctrl;
    throw Helpers::unsupportedOp("${opname}", this->name_);
  }
`)
                if ('reqdata' === arg) {
                  Content({ indent }, `
  SdkEntityPtr ${opname}With(const Value& reqdata, BinarySources sources,
                      const Value& ctrl) override {
    (void)reqdata; (void)sources; (void)ctrl;
    throw Helpers::unsupportedOp("${opname}", this->name_);
  }
`)
                }
              } :
              ({ indent }: any) => {
                EntityOperation({ ff, opname, indent, entity, entrep, cls })
              }, a), {}))

      // The entity's binary slots, by name; "" is its own bytes.
      const slots = entitySlots(entity)
      const only = 1 === slots.length && '' === slots[0].name
      const named = slots.some((s: any) => '' !== s.name)
      const param = only ? '' : named && !slots.some((s: any) => '' === s.name) ?
        'const std::string& slot' : 'const std::optional<std::string>& slot = std::nullopt'
      const binarySlot = ({ indent }: any) => 0 === slots.length ? undefined :
        Content({ indent }, `std::vector<BinarySlotDef> binarySlots() const override {
  return {
${slots.map((s: any) => `    { ${JSON.stringify(s.name)}, ${JSON.stringify(s.action)}, ${JSON.stringify(s.read ?? '')}, ${JSON.stringify(s.write ?? '')} },`).join('\n')}
  };
}
// The handle of one of this entity's binary slots.
BinaryHandle binary(${param}) {
  return BinaryHandle(this->self(), ${only ? 'std::nullopt' : 'slot'});
}
`)

      Fragment({
        from: ff + 'Entity.fragment.cpp',
        replace: {
          ...entrep,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,
          EntyClass: cls,

          ...opfrags,

          '#BinarySlot': binarySlot,
          '#BinaryImport': ({ indent }: any) => 0 === slots.length ? undefined :
            Content({ indent }, `#include "../utility/codec/handle.hpp"
`),
        }
      })

    })
  })
})


export {
  Entity
}
