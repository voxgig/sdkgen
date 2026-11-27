import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the index naming them is written per model.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const used = codecsUsed(model)
  const Name = model.const.Name

  const requires: string[] = []
  const entries: string[] = []

  if (used.form) {
    requires.push(`require_once __DIR__ . '/FormCodec.php';`)
    entries.push(`            'form' => [${Name}FormCodec::class, 'encode'],`)
  }
  if (used.multipart) {
    requires.push(`require_once __DIR__ . '/MultipartCodec.php';`)
    entries.push(`            'multipart' => [${Name}MultipartCodec::class, 'encode'],`,
      `            'multipart_boundary' => [${Name}MultipartCodec::class, 'boundary'],`)
  }
  if (used.raw) {
    requires.push(`require_once __DIR__ . '/RawCodec.php';`)
    entries.push(`            'raw' => [${Name}RawCodec::class, 'read'],`)
  }

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'Index.' + target.ext }, () => {
      Content(`<?php
declare(strict_types=1);

// ${Name} SDK utility: the body codecs this model's points use; generated per model.
${requires.join('\n')}${0 < requires.length ? '\n' : ''}
class ${Name}Codec
{
    public static function all(): array
    {
        return [
${entries.join('\n')}${0 < entries.length ? '\n' : ''}        ];
    }
}
`)
    })
  })
})


export {
  CodecIndex
}
