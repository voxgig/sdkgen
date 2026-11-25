import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$: { model } } = props

  const pkgdir = model.const.Name.toLowerCase() + '_sdk'

  const tree: [string, string][] = [
    ['├── ' + pkgdir + '/', 'Main SDK package'],
    ['│   ├── __init__.py', 'The SDK class'],
    ['│   ├── config.py', 'Configuration'],
    ['│   ├── schema.py', 'Generated option + entity specs'],
    ['│   ├── features.py', 'Feature factory'],
    ['│   ├── ' + model.const.Name.toLowerCase() + '_types.py', 'Typed models (TypedDict)'],
    ['│   ├── core/', 'Core types and context'],
    ['│   ├── entity/', 'Entity implementations'],
    ['│   ├── feature/', 'Feature implementations'],
    ['│   └── utility/', 'Utility functions and struct library'],
    ['└── test/', 'Test suites'],
  ]
  const width = Math.max(...tree.map(([path]) => path.length)) + 2

  Content(`### Data as dicts

The Python SDK uses plain dicts throughout rather than typed
objects. This mirrors the dynamic nature of the API and keeps the
SDK flexible — no code generation is needed when the API schema
changes.

Use \`helpers.to_map()\` to safely validate that a value is a dict.

### Module structure

\`\`\`
${target.name}/
${tree.map(([path, what]) => path.padEnd(width) + '-- ' + what).join('\n')}
\`\`\`

The main module is the package \`${pkgdir}\`: its \`__init__.py\` exports the
SDK class. Import entity or utility modules directly only when needed.

`)

})


export {
  ReadmeExplanation
}
