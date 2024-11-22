
import { cmp, each, Content } from 'jostraca'


const ReadmeOptions = cmp(function ReadmeOptions(props: any) {
  const { target } = props

  Content(`

## Options

`)

  each(target.options)
    .filter((option: any) => option.publish)
    .map((option: any) => {
      Content(`
* __${option.name} (${option.kind})__: ${option.short}
`)
    })


})



export {
  ReadmeOptions
}
