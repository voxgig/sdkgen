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

  const entries: string[] = []

  if (used.form) {
    entries.push('            ["form"] = (BodyEncoder)EncodeForm,')
  }
  if (used.multipart) {
    entries.push('            ["multipart"] = (BodyEncoder)EncodeMultipart,',
      '            ["multipartBoundary"] = (Func<Context, string>)MultipartBoundaryUtil,')
  }
  if (used.raw) {
    entries.push('            ["raw"] = (Action<Context>)ReadRawUtil,')
  }

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'CodecIndex.' + target.ext }, () => {
      Content(`// ${model.const.Name} SDK utility: the body codecs this model's points use; generated per model.

namespace ${model.const.Name}Sdk.Util;

public static partial class SdkUtility
{
    internal static Dictionary<string, object?> CodecIndex()
    {
        return new Dictionary<string, object?>
        {
${entries.join('\n')}${0 < entries.length ? '\n' : ''}        };
    }
}
`)
    })
  })
})


export {
  CodecIndex
}
