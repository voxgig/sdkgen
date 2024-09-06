
import { cmp, each, Code } from 'jostraca'


const ReadmeEntity = cmp(function ReadmeEntity(props: any) {
  const { build } = props
  const { model } = props.ctx$

  const { entity } = model.main.sdk

  Code(`

## Entities
`)


  each(entity)
    .filter((entity: any) => entity.publish)
    .map((entity: any) => {
      Code(`
### Entity: __${entity.Name}__

`)

      each(entity.field, (field: any) => {
        Code(`
* __${field.name}__ (${field.type}): ${field.short}
  
`)
      })
    })


})



export {
  ReadmeEntity
}
