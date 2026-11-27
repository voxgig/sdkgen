import {
  cmp, File, Folder, Content,
  codecsUsed,
} from '@voxgig/sdkgen'


// GENERATED, NOT COPIED: the codec sources are trimmed to what the model's
// points use, so the index naming them is written per model.
const CodecIndex = cmp(function CodecIndex(props: any) {
  const { model } = props.ctx$

  const used = codecsUsed(model)
  const Name = model.const.Name

  const requires: string[] = []
  const entries: string[] = []

  if (used.form) {
    requires.push('form')
    entries.push('  form => \\&encode_form,')
  }
  if (used.multipart) {
    requires.push('multipart')
    entries.push('  multipart => \\&encode_multipart,',
      '  multipart_boundary => \\&multipart_boundary,')
  }
  if (used.raw) {
    requires.push('raw')
    entries.push('  raw => \\&read_raw,')
  }

  Folder({ name: 'utility/codec' }, () => {
    File({ name: 'index.pm' }, () => {
      Content(`# ${Name} SDK body codecs: the ones this model's points use; generated per model.

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
${requires.map((r) => `require(Cwd::abs_path("$__dir/${r}.pm"));\n`).join('')}
package ${Name}Utilities;

our %CODEC = (
${entries.join('\n')}${0 < entries.length ? '\n' : ''});

1;
`)
    })
  })
})


export {
  CodecIndex
}
