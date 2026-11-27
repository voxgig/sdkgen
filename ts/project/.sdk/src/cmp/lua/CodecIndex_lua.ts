import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the index naming them is written per model.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$

  const used = codecsUsed(model)

  const requires: string[] = []
  const entries: string[] = []

  if (used.form) {
    requires.push('local form = require("utility.codec.form")')
    entries.push('  form = form.encode_form,')
  }
  if (used.multipart) {
    requires.push('local multipart = require("utility.codec.multipart")')
    entries.push('  multipart = multipart.encode_multipart,',
      '  multipart_boundary = multipart.multipart_boundary,')
  }
  if (used.raw) {
    requires.push('local raw = require("utility.codec.raw")')
    entries.push('  raw = raw.read_raw,')
  }

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'index.lua' }, () => {
      Content(`-- ${model.const.Name} SDK body codecs: the ones this model's points use; generated per model.
${requires.join('\n')}${0 < requires.length ? '\n' : ''}
return {
${entries.join('\n')}${0 < entries.length ? '\n' : ''}}
`)
    })
  })
})


export {
  CodecIndex
}
