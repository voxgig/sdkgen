
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  Content('```js')
  Content(`
const { ${model.const.Name}SDK } = require('${target.module.name}')

const client = ${model.const.Name}SDK.make({
  endpoint: process.env.${model.NAME}_ENDPOINT,
  apikey: process.env.${model.NAME}_APIKEY,
})

`)
  Content('```')

})


export {
  ReadmeQuick
}
