
import { cmp } from 'jostraca'

import { optionalComponent } from '../helpers/optional'


// Per-language intro lives in `project/.sdk/src/cmp/<lang>/ReadmeIntro_<lang>.ts`.
// Each language declares its own tagline and stylistic emphasis (Go's
// `map[string]any` data-flow note, TS's async/await emphasis, etc.).
const ReadmeIntro = cmp(function ReadmeIntro(props: any) {
  const { target, ctx$ } = props

  const ReadmeIntro_sdk =
    optionalComponent(ctx$, target, 'ReadmeIntro')

  if (ReadmeIntro_sdk) {
    ReadmeIntro_sdk['ReadmeIntro']({ target })
  }
})


export {
  ReadmeIntro
}
