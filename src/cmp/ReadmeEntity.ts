
import { cmp, each, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'


const ReadmeEntity = cmp(function ReadmeEntity(props: any) {
  const { ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

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
