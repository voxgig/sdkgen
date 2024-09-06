
import { cmp, File, Code } from 'jostraca'


import { ReadmeInstall } from './ReadmeInstall'
import { ReadmeOptions } from './ReadmeOptions'
import { ReadmeEntity } from './ReadmeEntity'


const Readme = cmp(function Readme(props: any) {
  const { build } = props
  const { model } = props.ctx$

  File({ name: 'README.md' }, () => {

    Code(`
# ${model.Name} ${build.Name} SDK
`)

    ReadmeInstall({ build })
    ReadmeOptions({ build })
    ReadmeEntity({ build })
  })
})


export {
  Readme
}
