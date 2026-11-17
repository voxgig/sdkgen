// node enumgen.js <out-dir> <sdkgen ts root> <lang> <fact path> <value>
//
// The pages of <lang> generated with ONE enumerated fact changed and nothing
// else: the compiled provider is loaded from the clone, its fact is set in
// memory (the clone is not touched), and gen/gen.js generates every variation
// but the alias one (which stages files into the clone). Only <lang>/ and the
// root README are written. The fact sheet diffs these pages against the real
// ones: the units that differ are the sentences the value selects (a minimal
// pair), which no comparison across languages can isolate.
const Fs = require('node:fs')
const Path = require('node:path')
const [out, ts, lang, path, value] = process.argv.slice(2)
if (!out || !ts || !lang || !path || null == value) { console.error('usage: node enumgen.js <out-dir> <ts> <lang> <fact path> <value>'); process.exit(2) }
const file = Path.join(Path.resolve(ts), 'dist-test-scaffold/.sdk/dist/cmp', lang, 'Syntax_' + lang + '.js')
const S = require(file).Syntax
const keys = path.split('.')
const holder = 'ref' === keys[0] ? (S.ref && S.ref.facts) : S.facts
if (!holder) { console.error(`enumgen: ${lang} declares no ${'ref' === keys[0] ? 'ref.facts' : 'facts'}`); process.exit(1) }
let o = holder
const ks = 'ref' === keys[0] ? keys.slice(1) : keys
for (const k of ks.slice(0, -1)) o = o[k]
o[ks[ks.length - 1]] = value
const OUT = Path.resolve(out)
const keep = (p) => { const r = Path.relative(OUT, Path.resolve(p)); if (r.startsWith('..')) return true; const parts = r.split(Path.sep); return parts.length <= 2 || parts[1] === lang }
const wf = Fs.writeFileSync, mk = Fs.mkdirSync
Fs.writeFileSync = function (p, ...rest) { if (keep(p)) return wf.call(Fs, p, ...rest) }
Fs.mkdirSync = function (p, ...rest) { if (keep(p)) return mk.call(Fs, p, ...rest) }
process.argv = [process.argv[0], Path.join(__dirname, 'gen', 'gen.js'), OUT, ts, '--only', '^(?!alias-)']
require('./gen/gen.js')
