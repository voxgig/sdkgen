
import {
  Content,
  File,
  cmp,
} from '@voxgig/sdkgen'


// Generates a per-entity smoke test: the entity accessor returns a bound
// entity in test mode. The full operation pipeline is exercised end-to-end by
// the shared template suites (PrimaryUtility, Pipeline, Feature, Netsim) plus
// the generated Direct test; this keeps the generated per-entity test API-shape
// independent (no fixture/flow coupling) so it is green for every SDK.
const TestEntity = cmp(function TestEntity(props: any) {
  const model = props.ctx$.model
  const { target, entity } = props
  const Name = model.const.Name

  File({ name: entity.Name + 'EntityTest.' + target.ext }, () => {
    Content(`// ${entity.name} entity test (generated from the API model).

import XCTest

@testable import ${Name}Sdk

final class ${entity.Name}EntityTest: XCTestCase {
  func testInstance() {
    let sdk = ${Name}SDK.testSDK(nil, nil)
    let ent = sdk.${entity.Name}()
    XCTAssertEqual(ent.getName(), "${entity.name}")
  }
}
`)
  })
})


export {
  TestEntity
}
