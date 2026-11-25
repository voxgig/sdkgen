
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$: { model } } = props

  Content(`### Data as arrays

The PHP SDK uses plain PHP associative arrays throughout rather than typed
objects. This mirrors the dynamic nature of the API and keeps the
SDK flexible: code that works with the arrays needs no regeneration
when the API schema changes. The typed models in
\`types/${model.const.Name}Types.php\` follow the schema only when the
SDK is regenerated.

Use \`Helpers::to_map()\` to safely validate that a value is an array.

### Directory structure

\`\`\`
php/
├── ${model.const.Name.toLowerCase()}_sdk.php          -- Main SDK class
├── config.php                     -- Configuration
├── schema.php                     -- Generated option + entity specs
├── features.php                   -- Feature factory
├── core/                          -- Core types and context
├── entity/                        -- Entity implementations
├── feature/                       -- Built-in features (Base, Test, Log)
├── utility/                       -- Utility functions and struct library
└── test/                          -- Test suites
\`\`\`

The main class (\`${model.const.Name.toLowerCase()}_sdk.php\`) exports the SDK class
and test helper. Import entity or utility modules directly only
when needed.

`)

})


export {
  ReadmeExplanation
}
