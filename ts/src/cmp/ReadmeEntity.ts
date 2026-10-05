
import { cmp } from 'jostraca'

import { optionalComponent } from '../helpers/optional'


// Per-language Entities section lives in
// `project/.sdk/src/cmp/<lang>/ReadmeEntity_<lang>.ts`.
// Each language emits its own create-instance call style and
// op-method spelling (Go's `Load(match, ctrl)` vs TS's `load(match)`).
const ReadmeEntity = cmp(function ReadmeEntity(props: any) {
  const { target, ctx$ } = props

  const ReadmeEntity_sdk =
    optionalComponent(ctx$, target, 'ReadmeEntity')

  if (ReadmeEntity_sdk) {
    ReadmeEntity_sdk['ReadmeEntity']({ target })
  }
})


export {
  ReadmeEntity
}
