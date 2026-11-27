
import * as Path from 'node:path'

import {
  cmp, camelify, names,
  File, Folder, Fragment,
  entityClassName, entityCollection, entitySlots,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_perl'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // Collision-free entity CLASS name (see entityClassName): normally
  // `<Name>Entity`, disambiguated when it would clash with another entity's
  // data-type name. The snake-cased source-file name is unaffected.
  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  const ff = Path.normalize(__dirname + '/../../../src/cmp/perl/fragment/')

  const slots = entitySlots(entity)
  const q = (v: string) => "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
  const slotDefs = slots.map((slot: any) => '  ' + q(slot.name) + ' => { action => ' +
    q(slot.action) + (null == slot.read ? '' : ', read => ' + q(slot.read)) +
    (null == slot.write ? '' : ', write => ' + q(slot.write)) + ' },').join('\n')
  const named = slots.filter((slot: any) => '' !== slot.name).map((slot: any) => slot.name)

  const binaryImport = 0 === slots.length ? '' :
    `require(Cwd::abs_path("$__dir/../utility/codec/handle.pm"));

my $BINARY_SLOTS = {
${slotDefs}
};
`

  const binarySlot = 0 === slots.length ? '' :
    `# An entity's bytes never enter its data: they are reached by slot` +
    (0 === named.length ? '.' : ', one of ' + named.map(q).join(', ') +
      (named.length < slots.length ? ', or none for its own' : '') + '.') + `
sub binary {
  my ($self, $slot) = @_;
  return ${model.const.Name}BinaryHandle->new($self, $BINARY_SLOTS, $slot);
}
`

  Folder({ name: 'entity' }, () => {

    File({ name: entity.name + '_entity.pm' }, () => {

      const opnames = Object.keys(entity.op || {})

      const opfrags =
        (['load', 'list', 'create', 'update', 'patch', 'remove']
          .reduce((a: any, opname: string) =>
          (a['# #' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ? '' : ({ indent }: any) => {
              EntityOperation({ ff, opname, indent, entity, entrep })
            }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.pm',
        replace: {
          ...entrep,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          EntyClass: cls,

          '# #BinaryImport\n': binaryImport,
          '# #BinarySlot\n': binarySlot,

          // Feature-hook markers. jostraca's built-in `#Name-Tag` pattern is
          // hardcoded to `//` comments, so the Perl fragment's
          // `# #<Name>-Hook` marker lines never matched it and the pipeline
          // hooks (PrePoint, PreRequest, ...) were silently dropped from the
          // generated op runner. Match the `#`-comment form explicitly.
          '/(?<indent>[ \\t]*)#[ \\t]*#(?<name>[A-Za-z0-9]+)-Hook[ \\t]*\\n?/':
            ({ name, indent }: any) =>
              `${indent}$utility->{feature_hook}->($ctx, "${name}");\n`,

          ...opfrags,
        }
      })

    })
  })
})



export {
  Entity
}
