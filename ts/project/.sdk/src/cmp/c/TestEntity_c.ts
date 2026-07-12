
import {
  Model,
  ModelEntity,
} from '@voxgig/apidef'

import {
  Content,
  File,
  cmp,
} from '@voxgig/sdkgen'


import { cIdent, cVarName } from './utility_c'


// Generated entity instance test: constructs the SDK in test mode, obtains
// the entity via its accessor, and verifies its name. (End-to-end CRUD
// pipeline coverage is provided by the generated direct test + the static
// sdk_pipeline_test, both driving the full pipeline via a mock transport.)
const TestEntity = cmp(function TestEntity(props: any) {
  const ctx$ = props.ctx$
  const model: Model = ctx$.model
  const entity: ModelEntity = props.entity

  const ident = cIdent(model)
  const evar = cVarName(entity.name)
  const Name = model.const.Name

  File({ name: entity.name + '_entity_test.c' }, () => {
    Content(`// Generated instance test for the ${entity.name} entity.

#include "ctest.h"

int main(void) {
  ${Name}SDK* sdk = test_sdk(NULL, NULL);
  CHECK(sdk != NULL, "sdk constructed");

  Entity* e = ${ident}_${evar}(sdk, NULL);
  CHECK(e != NULL, "entity instance");
  CHECK_STR_EQ(e->vt->get_name(e), "${entity.name}", "entity get_name");

  TEST_SUMMARY("${evar}_entity");
}
`)
  })
})


export {
  TestEntity
}
