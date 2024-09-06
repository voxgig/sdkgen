
import { cmp, each, Code } from 'jostraca'


const ReadmeOptions = cmp(function ReadmeOptions(props: any) {
  const { build } = props

  Code(`

## Options

`)

  each(build.options)
    .filter((option: any) => option.publish)
    .map((option: any) => {
      Code(`
* __${option.name} (${option.kind})__: ${option.short}
`)
    })


})



export {
  ReadmeOptions
}
