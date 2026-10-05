
import { cmp, Content, isAuthActive, envName, canonKey, entityIdField, opRequestShape, javaMapOf } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { scalaVarName, scalaPackage, scalaListMatch, scalaLit } from './utility_scala'


const ReadmeTopQuick = cmp(function ReadmeTopQuick(props: any) {
  const { target, ctx$: { model } } = props

  const SDK = model.const.Name + 'SDK'

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const authActive = isAuthActive(model)

  Content(`\`\`\`scala
import ${scalaPackage(model)}.core.${SDK}

`)

  if (authActive) {
    Content(`val options = new java.util.LinkedHashMap[String, Object]()
options.put("apikey", System.getenv("${envName(model)}_APIKEY"))
val client = new ${SDK}(options)

`)
  }
  else {
    Content(`val client = new ${SDK}()

`)
  }

  if (exampleEntity) {
    const eVar = scalaVarName(exampleEntity.name)
    const accessor = scalaVarName(exampleEntity.name)
    const eNameLower = nom(exampleEntity, 'Name').toLowerCase()
    const opnames = Object.keys(exampleEntity.op || {})
    const idF = entityIdField(exampleEntity)

    if (opnames.includes('list')) {
      Content(`// List all ${eNameLower}s (returns Object, an aggregate list; raises on error)
val ${eVar}List = client.${accessor}(null).list(${scalaListMatch(exampleEntity)}, null)
println(${eVar}List)
`)
    }

    if (opnames.includes('load')) {
      // Every REQUIRED load-match key (id first, then parent path params like
      // page_id) — the same shape the runtime resolves path params from, so
      // the example always works.
      const loadItems = opRequestShape(exampleEntity, 'load').items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      const loadArg = 0 < loadItems.length
        ? javaMapOf(loadItems.map((it: any) =>
          `"${it.name}", ${scalaLit(it.type,
            it.name === idF ? 'example_id' : 'example_' + it.name)}`), 'java.util.')
        : 'null'
      Content(`
// Load a specific ${eNameLower} (returns the record, raises on error)
val ${eVar} = client.${accessor}(null).load(${loadArg}, null)
println(${eVar})
`)
    }
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopQuick
}
