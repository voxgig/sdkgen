import type { Naming as NamingType } from '@voxgig/sdkgen'

import { cljAccessor, cljEntityAlias, cljEntityNs } from './utility_clojure'


// The names the clojure code generator gives the SDK: the sdk.api namespace,
// and per entity its accessor (MainEntity_clojure) and the namespace and alias
// the api namespace requires it by (Main_clojure).
const Naming: NamingType = () => ({
  layout: {
    module: 'sdk.api',
    client: 'api',
    ctor: 'api/make-sdk',
  },
  symbols: (e) => ({
    accessor: cljAccessor(e),
    var: cljAccessor(e),
    module: cljEntityNs(e),
    alias: cljEntityAlias(e),
  }),
  ident: (name) => name,
})


export {
  Naming
}
