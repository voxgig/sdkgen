

import { cmp, Content } from '@voxgig/sdkgen'

import { cljAccessor, cljEntityAlias } from './utility_clojure'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props

  // Public accessor: (<entityname> client data) constructs an entity client.
  // The accessor name is the (lower-case) entity name; the entity namespace is
  // aliased e-<name> in the api ns require.
  Content(`
;; ${entity.Name} accessor: (${entity.name} client data)
(defn ${cljAccessor(entity)} [client data] (${cljEntityAlias(entity)}/make client data))
`)
})


export {
  MainEntity
}
