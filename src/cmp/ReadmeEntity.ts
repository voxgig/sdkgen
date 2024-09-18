
import { cmp, each, Content } from 'jostraca'


const ReadmeEntity = cmp(function ReadmeEntity(props: any) {
  const { ctx$: { model } } = props

  const { entity } = model.main.sdk

  Content(`

## Entities
`)


  each(entity)
    .filter((entity: any) => entity.publish)
    .map((entity: any) => {
      Content(`
### Entity: __${entity.Name}__

`)

      each(entity.field, (field: any) => {
        Content(`
* __${field.name}__ (${field.type}): ${field.short}
  
`)
      })
    })


})



export {
  ReadmeEntity
}
