
import { Content } from 'jostraca'

import { cmp } from '../helpers/component'
import { optionalComponent } from '../helpers/optional'
import { modelText } from '../helpers/text'
import { alongsideNote } from '../helpers/alongside'


// Every language README opens the same way: the title and tagline, the
// target's own ReadmeIntroBody, then the note naming the rest of the project.
// A component exporting a whole ReadmeIntro (a project's copy from before this
// frame, or a pack not yet moved to it) still writes its own introduction.
const ReadmeIntro = cmp(function ReadmeIntro(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const intro = optionalComponent(ctx$, target, 'ReadmeIntro')
  if (null == intro) return

  if (null == intro.ReadmeIntroBody) {
    intro.ReadmeIntro({ target })
    return
  }

  Content(`# ${model.Name} ${target.title} SDK

${modelText(model).tagline || ''}

`)
  intro.ReadmeIntroBody({ target })
  Content(alongsideNote(model, target.name))
})


export {
  ReadmeIntro
}
