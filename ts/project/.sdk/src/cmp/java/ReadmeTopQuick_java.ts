
import { cmp, Content, isAuthActive, envName, canonKey, entityIdField, opRequestShape , serverVariables, javaMapOf } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { javaVarName, javaPackage, javaListMatch, javaLit } from './utility_java'


const ReadmeTopQuick = cmp(function ReadmeTopQuick(props: any) {
  const { target, ctx$: { model } } = props

  const SDK = model.const.Name + 'SDK'

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const authActive = isAuthActive(model)

  // Server variables (a templated server URL) are REQUIRED at construction
  // - the SDK throws rather than request a URL with a literal
  // {account_id} in it - so a quickstart that omits them is a quickstart
  // that fails on its first line.
  const svars = serverVariables(model)
  const javaServerLines = 0 === svars.length ? '' :
    'Map<String, Object> server = new java.util.LinkedHashMap<>();\n' +
    svars.map((v: any) =>
      `server.put("${v.name}", "<${v.name}>");\n`).join('') +
    'options.put("server", server);\n'


  Content(`\`\`\`java
import ${javaPackage(model)}.core.${SDK};

`)

  if (authActive) {
    Content(`Map<String, Object> options = new java.util.LinkedHashMap<>();
options.put("apikey", System.getenv("${envName(model)}_APIKEY"));
${javaServerLines}${SDK} client = new ${SDK}(options);

`)
  }
  else {
    Content(`${'' === javaServerLines
      ? `${SDK} client = new ${SDK}();`
      : `Map<String, Object> options = new java.util.LinkedHashMap<>();\n${javaServerLines}${SDK} client = new ${SDK}(options);`}

`)
  }

  if (exampleEntity) {
    const eVar = javaVarName(exampleEntity.name)
    const accessor = javaVarName(exampleEntity.name)
    const eNameLower = nom(exampleEntity, 'Name').toLowerCase()
    const opnames = Object.keys(exampleEntity.op || {})
    const idF = entityIdField(exampleEntity)

    if (opnames.includes('list')) {
      Content(`// List all ${eNameLower}s (returns Object, an aggregate list; raises on error)
Object ${eVar}List = client.${accessor}(null).list(${javaListMatch(exampleEntity)}, null);
System.out.println(${eVar}List);
`)
    }

    if (opnames.includes('load')) {
      const loadItems = opRequestShape(exampleEntity, 'load').items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      const loadArg = 0 < loadItems.length
        ? javaMapOf(loadItems.map((it: any) =>
          `"${it.name}", ${javaLit(it.type,
            it.name === idF ? 'example_id' : 'example_' + it.name)}`))
        : 'null'
      Content(`
// Load a specific ${eNameLower} (returns the record, raises on error)
Object ${eVar} = client.${accessor}(null).load(${loadArg}, null);
System.out.println(${eVar});
`)
    }
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopQuick
}
