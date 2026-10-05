
import { cmp } from 'jostraca'

import { optionalComponent } from '../helpers/optional'


// Per-language Options block lives in
// `project/.sdk/src/cmp/<lang>/ReadmeOptions_<lang>.ts`.
// Each language emits its own constructor-call shape and option-table
// formatting; they share the data source (target.options).
const ReadmeOptions = cmp(function ReadmeOptions(props: any) {
  const { target, ctx$ } = props

  const ReadmeOptions_sdk =
    optionalComponent(ctx$, target, 'ReadmeOptions')

  if (ReadmeOptions_sdk) {
    ReadmeOptions_sdk['ReadmeOptions']({ target })
  }
})


export {
  ReadmeOptions
}
