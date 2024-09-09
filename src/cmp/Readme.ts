
import { cmp, File, Code } from 'jostraca'


import { ReadmeIntro } from './ReadmeIntro'
import { ReadmeInstall } from './ReadmeInstall'
import { ReadmeQuick } from './ReadmeQuick'
import { ReadmeModel } from './ReadmeModel'
import { ReadmeOptions } from './ReadmeOptions'
import { ReadmeEntity } from './ReadmeEntity'


const Readme = cmp(function Readme(props: any) {
  const { build } = props
  const { model } = props.ctx$

  File({ name: 'README.md' }, () => {

    Code(`
# ${model.Name} ${build.title} SDK
`)
    // Sections
    ReadmeIntro({ build })
    ReadmeInstall({ build })
    ReadmeQuick({ build })
    ReadmeModel({ build })
    ReadmeOptions({ build })
    ReadmeEntity({ build })
  })
})


export {
  Readme
}
