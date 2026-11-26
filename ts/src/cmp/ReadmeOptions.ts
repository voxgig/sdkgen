import { cmp } from '../helpers/component'


// Writes nothing. It stays exported for a project's own components that call
// it; ReadmeModel and ReadmeRef write the options tables, from `clientOptions`.
const ReadmeOptions = cmp(function ReadmeOptions() {
})


export {
  ReadmeOptions
}
