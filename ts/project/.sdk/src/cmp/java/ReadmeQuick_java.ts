
import { cmp, Content, isAuthActive, envName, canonKey, opRequestShape, entityIdField, entityOps , serverVariables, javaMapOf, matchExampleItems, requiredItems, javaMapItems, requestExampleItems, sendsId } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { javaVarName, javaPackage, javaListMatch, javaLit } from './utility_java'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const SDK = model.const.Name + 'SDK'

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  // Find a nested entity if available: one with a parent chain
  // (relations.ancestors), an active load op, and a required non-id load
  // param to demonstrate (the parent key, e.g. page_id).
  const nestedEntity = Object.values(entity).find((e: any) =>
    e.active !== false &&
    e.relations && e.relations.ancestors && 0 < e.relations.ancestors.length &&
    entityOps(e).includes('load') &&
    opRequestShape(e, 'load').items.some((it: any) =>
      !it.optional && it.name !== entityIdField(e))
  ) as any

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


  if (authActive) {
    Content(`### 1. Create a client

\`\`\`java
import java.util.List;
import java.util.Map;
import ${javaPackage(model)}.core.${SDK};
import ${javaPackage(model)}.core.SdkEntity;

Map<String, Object> options = new java.util.LinkedHashMap<>();
options.put("apikey", System.getenv("${envName(model)}_APIKEY"));
${javaServerLines}${SDK} client = new ${SDK}(options);
\`\`\`

`)
  }
  else {
    Content(`### 1. Create a client

\`\`\`java
import java.util.List;
import java.util.Map;
import ${javaPackage(model)}.core.${SDK};
import ${javaPackage(model)}.core.SdkEntity;

${'' === javaServerLines
      ? `${SDK} client = new ${SDK}();`
      : `Map<String, Object> options = new java.util.LinkedHashMap<>();\n${javaServerLines}${SDK} client = new ${SDK}(options);`}
\`\`\`

`)
  }

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? 'an' : 'a'
    // Sanitise the local variable name — a camelCased Java keyword gets a
    // trailing underscore (javaVarName) so the snippet compiles.
    const eVar = javaVarName(exampleEntity.name)
    const accessor = javaVarName(exampleEntity.name)
    const opnames = entityOps(exampleEntity)
    const idF = entityIdField(exampleEntity)

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

\`list(null, null)\` returns a list of entities, one per record (as \`Object\`),
and raises on error; an entity's \`data()\` reads its record.

\`\`\`java
try {
    List<?> ${eVar}List = (List<?>) client.${accessor}(null).list(${javaListMatch(exampleEntity)}, null);
    for (Object ${eVar}Item : ${eVar}List) {
        System.out.println(((SdkEntity) ${eVar}Item).data());
    }
}
catch (RuntimeException err) {
    System.out.println("list failed: " + err.getMessage());
}
\`\`\`

`)
    }

    if (nestedEntity) {
      const neName = nom(nestedEntity, 'Name')
      const neArticle = /^[aeiou]/i.test(neName) ? 'an' : 'a'
      const neVar = javaVarName(nestedEntity.name)
      const neAccessor = javaVarName(nestedEntity.name)

      // Model-driven match: every REQUIRED load-match key. Parent keys (e.g.
      // page_id) first, the entity's own id last.
      const neIdF = entityIdField(nestedEntity)
      const neRequired = requiredItems(nestedEntity, 'load')
        .sort((a: any, b: any) =>
          (a.name === neIdF ? 1 : 0) - (b.name === neIdF ? 1 : 0))
      const parentItem = neRequired.find((it: any) => it.name !== neIdF) as any
      const parentParam = parentItem && parentItem.name
      const parentName = parentParam ? parentParam.replace(/_id$/, '') : 'its parent'
      const neMatch = javaMapItems(neRequired).map((it: any) =>
        `${JSON.stringify(it.name)}, ${javaLit(it.type,
          it.name === neIdF ? 'example_id' : 'example_' + it.name)}`)

      Content(`### 3. Load ${neArticle} ${neName.toLowerCase()}

${neName} is nested under ${parentName}, so provide the \`${parentParam}\`.
\`load()\` returns the ENTITY — call data() for the record — and raises on error.

\`\`\`java
try {
    SdkEntity ${neVar} = (SdkEntity) client.${neAccessor}(null).load(${javaMapOf(neMatch)}, null);
    System.out.println(${neVar}.data());
}
catch (RuntimeException err) {
    System.out.println("load failed: " + err.getMessage());
}
\`\`\`

`)
    }
    else if (opnames.includes('load')) {
      const loadRequired = javaMapItems(matchExampleItems(exampleEntity, 'load', idF))
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      const loadArg = 0 < loadRequired.length
        ? javaMapOf(loadRequired.map((it: any) =>
          `${JSON.stringify(it.name)}, ${javaLit(it.type,
            it.name === idF ? 'example_id' : 'example_' + it.name)}`))
        : 'null'

      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`load()\` returns the ENTITY — call data() for the record — and raises on error.

\`\`\`java
try {
    SdkEntity ${eVar} = (SdkEntity) client.${accessor}(null).load(${loadArg}, null);
    System.out.println(${eVar}.data());
}
catch (RuntimeException err) {
    System.out.println("load failed: " + err.getMessage());
}
\`\`\`

`)
    }

    // Model-driven example fields: derive the create/update body from the op
    // shape (opRequestShape) so the docs reference REAL writable fields.
    const examplePairs = (opname: string): string[] => {
      const items = javaMapItems(requestExampleItems(exampleEntity, opname))
        .filter((it: any) => (it.name !== idF && it.name !== 'id') ||
          ('create' === opname && !it.optional))
      const required = items.filter((it: any) => !it.optional)
      const optional = items.filter((it: any) => it.optional)
      const chosen = 'create' === opname
        ? (required.length ? required : items.slice(0, 2))
        : required.concat(optional).slice(0, Math.max(2, required.length))
      return chosen.map((it: any) => `${JSON.stringify(it.name)}, ${javaLit(it.type, 'example_' + it.name)}`)
    }

    const idParamType = (opname: string): any => {
      const it = opRequestShape(exampleEntity, opname).items.find((x: any) => x.name === idF)
      return it && it.type
    }

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('patch') ||
      opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`java
`)
      if (opnames.includes('create')) {
        Content(`// Create — returns the ENTITY (call data() for the record)
Object created = client.${accessor}(null).create(${javaMapOf(examplePairs('create'))}, null);

`)
      }
      if (opnames.includes('update')) {
        const updatePairs = (sendsId(exampleEntity, 'update', idF) ? [`${JSON.stringify(idF)}, ${javaLit(idParamType('update'), 'example_id')}`] : [])
          .concat(examplePairs('update'))
        Content(`// Update${sendsId(exampleEntity, 'update', idF) ? ' — supply the id in the match/data' : ''}
client.${accessor}(null).update(${javaMapOf(updatePairs)}, null);

`)
      }
      if (opnames.includes('patch')) {
        const patchPairs = (sendsId(exampleEntity, 'patch', idF) ? [`${JSON.stringify(idF)}, ${javaLit(idParamType('patch'), 'example_id')}`] : [])
          .concat(examplePairs('patch'))
        Content(`// Patch — sends only the fields given
client.${accessor}(null).patch(${javaMapOf(patchPairs)}, null);

`)
      }
      if (opnames.includes('remove')) {
        const removePairs = javaMapItems(matchExampleItems(exampleEntity, 'remove', idF))
          .sort((a: any, b: any) =>
            (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
          .map((it: any) => it.name === idF
            ? `${JSON.stringify(it.name)}, ${javaLit(idParamType('remove'), 'example_id')}`
            : `${JSON.stringify(it.name)}, ${javaLit(it.type, 'example_' + it.name)}`)
        Content(`// Remove
client.${accessor}(null).remove(${removePairs.length ? javaMapOf(removePairs) : 'null'}, null);
`)
      }
      Content(`\`\`\`

`)
    }
  }
})


export {
  ReadmeQuick
}
