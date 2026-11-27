import {
  cmp, each, File, Content,
  codecsUsed, entityClassName, entityCollection, entitySlots,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { swiftString } from './utility_swift'


// The codec suite is a template, and swift cannot find an accessor or a
// method by name at run time, so the entities it drives and their binary
// handles are generated beside it, as an extension of its test case. Emitted
// exactly when the suite ships.
const CodecEntities = cmp(function CodecEntities(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const used = codecsUsed(model)
  if (!Object.values(used).some((u: any) => true === u)) return

  const Name = model.const.Name
  const entityColl = entityCollection(model)
  const entities = each(getModelPath(model, `main.${KIT}.entity`))

  const accessors = entities.map((e: any) =>
    `    ${swiftString(e.name)}: { $0.${e.Name}() },`)

  const handles = entities.filter((e: any) => 0 < entitySlots(e).length).map((e: any) => {
    const slots = entitySlots(e)
    const named = slots.filter((s: any) => '' !== s.name).length
    const call = 0 === named ? 'binary()' :
      named < slots.length ? 'binary(slot)' : 'binary(slot ?? "")'
    return [
      `    if let ent = entity as? ${entityClassName(e, entityColl)} {`,
      `      let handle = ent.${call}`,
      '      return (bytes: { try handle.bytes() }, put: { try handle.put($0) as ' + Name + 'EntityBase })',
      '    }',
    ].join('\n')
  })

  File({ name: 'CodecEntities.' + target.ext }, () => {
    Content(`// The entities the codec suite drives, and their binary handles; generated per model.

import Foundation

@testable import ${Name}Sdk

extension CodecTest {
  static let entities: [String: (${Name}SDK) -> ${Name}EntityBase] = ${0 === accessors.length ? '[:]' :
    '[\n' + accessors.join('\n') + '\n  ]'}

  static func handle(_ entity: ${Name}EntityBase, _ slot: String?)
    -> (bytes: () throws -> Data, put: (Any) throws -> ${Name}EntityBase)?
  {
${handles.join('\n')}${0 < handles.length ? '\n' : ''}    return nil
  }
}
`)
  })
})


export {
  CodecEntities
}
