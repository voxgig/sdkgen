
import { cmp, Content, entityIdField } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeTopTest = cmp(function ReadmeTopTest(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk/go`

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  Content(`\`\`\`go
client := sdk.Test()
`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    // Model-driven id key: null when the entity has no id-like field, so the
    // test-mode load passes a nil match.
    const idF = entityIdField(exampleEntity)
    Content(`result, err := client.${eName}(nil).Load(
    ${idF ? `map[string]any{"${idF}": "test01"}` : 'nil'}, nil,
)
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
