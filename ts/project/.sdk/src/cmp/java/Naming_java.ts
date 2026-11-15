import type { Naming as NamingType } from '@voxgig/sdkgen'

import { JAVA_CORE, javaPackage, javaVarName } from './utility_java'


// The names the java code generator gives the SDK: the package root
// (javaPackage) and its core subpackage (Main_java's JAVA_CORE folder), the
// ProjectNameSDK class and its constructor, and each entity's accessor
// (MainEntity_java: `public SdkEntity ${javaVarName(entity.name)}(...)`).
const Naming: NamingType = (model, _target, tm) => ({
  layout: {
    module: javaPackage(model),
    client: tm('ProjectNameSDK'),
    ctor: tm('ProjectNameSDK'),
    names: { core: JAVA_CORE },
  },
  symbols: (e) => ({ accessor: javaVarName(e.name), var: javaVarName(e.name) }),
  ident: javaVarName,
})


export {
  Naming
}
