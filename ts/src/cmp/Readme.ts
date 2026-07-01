
import { cmp, File, Content } from 'jostraca'


import { ReadmeIntro } from './ReadmeIntro'
import { ReadmeInstall } from './ReadmeInstall'
import { ReadmeQuick } from './ReadmeQuick'
import { ReadmeModel } from './ReadmeModel'
import { ReadmeOptions } from './ReadmeOptions'
import { ReadmeEntity } from './ReadmeEntity'
import { ReadmeHowto } from './ReadmeHowto'
import { ReadmeExplanation } from './ReadmeExplanation'
import { ReadmeRef } from './ReadmeRef'


const Readme = cmp(function Readme(props: any) {
  const { target } = props
  const { model } = props.ctx$

  File({ name: 'README.md' }, () => {

    ReadmeIntro({ target })
    ReadmeInstall({ target })
    ReadmeQuick({ target })
    ReadmeHowto({ target })
    ReadmeModel({ target })
    ReadmeOptions({ target })
    ReadmeEntity({ target })
    ReadmeExplanation({ target })

    Content(`
## Full Reference

See [REFERENCE.md](REFERENCE.md) for complete API reference
documentation including all method signatures, entity field schemas,
and detailed usage examples.
`)
  })

  // Generate separate reference documentation
  ReadmeRef({ target })
})


export {
  Readme
}
