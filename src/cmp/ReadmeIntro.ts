
import { cmp, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'


const TARGET_INTRO: Record<string, string> = {
  ts: 'Provides a type-safe,\nentity-oriented interface with full async/await support.',
  go: 'Provides an entity-oriented interface\nusing standard Go conventions \u2014 no generics required, data flows as\n`map[string]any`.',
  js: 'Provides an entity-oriented\ninterface with full async/await support.',
}


const ReadmeIntro = cmp(function ReadmeIntro(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const desc = model.main.def.desc || ''

  const targetIntro = TARGET_INTRO[target.name] || 'Provides an entity-oriented interface.'

  Content(`# ${model.Name} ${target.title} SDK

The ${target.title} SDK for the ${model.Name} API. ${targetIntro}

`)

})




export {
  ReadmeIntro
}
