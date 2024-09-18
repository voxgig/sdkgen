
import { cmp, each, Content } from 'jostraca'


const ReadmeOptions = cmp(function ReadmeOptions(props: any) {
  const { build } = props

  Content(`

## Options

`)

  each(build.options)
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
