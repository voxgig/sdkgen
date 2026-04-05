
import { cmp, each, Content } from 'jostraca'


const ReadmeOptions = cmp(function ReadmeOptions(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const isGo = target.name === 'go'

  const publishedOptions = each(target.options)
    .filter((option: any) => option.publish)

  if (0 === publishedOptions.length) {
    return
  }

  Content(`

## Options

Pass options when creating a client instance:

`)

  if (isGo) {
    Content(`\`\`\`go
client := sdk.New${model.const.Name}SDK(map[string]any{
`)

    publishedOptions.map((option: any) => {
      if ('apikey' === option.name) {
        Content(`    "${option.name}": os.Getenv("${model.NAME}_APIKEY"),
`)
      }
      else {
        Content(`    // "${option.name}": ${option.kind === 'string' ? '"..."' : '...'},
`)
      }
    })

    Content(`})
\`\`\`

`)
  }
  else {
    Content(`\`\`\`ts
const client = new ${model.Name}SDK({
`)

    publishedOptions.map((option: any) => {
      if ('apikey' === option.name) {
        Content(`  ${option.name}: process.env.${model.NAME}_APIKEY,
`)
      }
      else {
        Content(`  // ${option.name}: ${option.kind === 'string' ? "'...'" : '...'},
`)
      }
    })

    Content(`})
\`\`\`

`)
  }

  Content(`| Option | Type | Description |
| --- | --- | --- |
`)

  publishedOptions.map((option: any) => {
    Content(`| \`${option.name}\` | \`${option.kind}\` | ${option.short} |
`)
  })

  Content(`
`)

})



export {
  ReadmeOptions
}
