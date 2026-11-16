import type { Naming as NamingType } from '@voxgig/sdkgen'

import { JAVA_CORE, JAVA_ENTITY, javaPackage, javaVarName } from './utility_java'


// The names the java code generator gives the SDK: the package root
// (javaPackage), its core subpackage (Main_java's JAVA_CORE folder) and its
// entity subpackage (EntityBase_java's and Entity_java's JAVA_ENTITY folder), the
// ProjectNameSDK class and its constructor, and each entity's accessor
// (MainEntity_java: `public SdkEntity ${javaVarName(entity.name)}(...)`).
const Naming: NamingType = (model, _target, tm) => ({
  layout: {
    module: javaPackage(model),
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK'),
    names: { core: JAVA_CORE, entity: JAVA_ENTITY },
  },
  symbols: (e) => ({ accessor: javaVarName(e.name), var: javaVarName(e.name) }),
  ident: javaVarName,
})


export {
  Naming
}
