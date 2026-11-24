
import { each } from 'jostraca'
import { cmp } from '../helpers/component'

import {
  KIT,
  getModelPath
} from '../types'


const FeatureHook = cmp(function FeatureHook(props: any, children: any) {
  const { ctx$: { model } } = props

  const feature = getModelPath(model, `main.${KIT}.feature`)

  // A feature need not implement every pipeline stage; only fire the hook
  // for features that declare it as active. Optional chaining guards
  // features whose `hook` map omits this stage entirely.
  each(feature)
    .filter(feature => feature.active && feature.hook?.[props.name]?.active)
    .forEach(feature => each(children, { call: true, args: feature }))
})


// The stages every entity operation runs, in order; each fires its hook first.
const PIPELINE_STAGES: { name: string, hook: string, purpose: string }[] = [
  {
    name: 'Point', hook: 'PrePoint',
    purpose: 'Resolves which API endpoint to call based on the operation name and entity configuration.',
  },
  {
    name: 'Spec', hook: 'PreSpec',
    purpose: 'Builds the HTTP spec — URL, method, headers, body — from the resolved point and the caller\'s parameters.',
  },
  {
    name: 'Request', hook: 'PreRequest',
    purpose: 'Sends the HTTP request. Features can intercept here to replace the transport.',
  },
  {
    name: 'Response', hook: 'PreResponse',
    purpose: 'Parses the raw HTTP response.',
  },
  {
    name: 'Result', hook: 'PreResult',
    purpose: 'Extracts the business data from the parsed response.',
  },
  {
    name: 'Done', hook: 'PreDone',
    purpose: 'Final stage before returning to the caller. Entity state (match, data) is updated here.',
  },
]

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

function pipelineLength(): string {
  return COUNT_WORDS[PIPELINE_STAGES.length] ?? String(PIPELINE_STAGES.length)
}


export {
  FeatureHook,
  PIPELINE_STAGES,
  pipelineLength,
}
