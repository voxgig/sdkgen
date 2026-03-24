
import { cmp, File, Content } from 'jostraca'


import { ReadmeIntro } from './ReadmeIntro'
import { ReadmeInstall } from './ReadmeInstall'
import { ReadmeQuick } from './ReadmeQuick'
import { ReadmeModel } from './ReadmeModel'
import { ReadmeOptions } from './ReadmeOptions'
import { ReadmeEntity } from './ReadmeEntity'
import { ReadmeRef } from './ReadmeRef'


const Readme = cmp(function Readme(props: any) {
  const { target } = props
  const { model } = props.ctx$

  File({ name: 'README.md' }, () => {

    Content(`
# ${model.Name} ${target.title} SDK
`)
    // Sections
    ReadmeIntro({ target })
    ReadmeInstall({ target })
    ReadmeQuick({ target })
    ReadmeModel({ target })
    ReadmeOptions({ target })
    ReadmeEntity({ target })

    Content(`
## Reference

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
