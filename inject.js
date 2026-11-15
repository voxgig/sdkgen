// node inject.js --old <root> --new <root> [--work <dir>]
// Copies <new>, injects four regressions into one variation (doc-crud), runs
// ledger.js and blocks.js on the original and on the copy, and prints every
// class that appears only on the copy: what the tools flag for each injection.
const Fs = require('node:fs')
const Path = require('node:path')
const CP = require('node:child_process')
const K = require('./common.js')
const a = K.args(process.argv.slice(2), { work: Path.join(__dirname, 'inject') })
const V = 'doc-crud'
const INJ = [
  { id: 'type-cell', lang: 'ts', file: 'ts/REFERENCE.md', section: 'reference', what: 'a field Type cell `string` -> `number`',
    from: '| `title` | `string` | Yes |  |', to: '| `title` | `number` | Yes |  |' },
  { id: 'sentence', lang: 'go', file: 'go/README.md', section: 'tutorial', what: 'a sentence removed',
    from: ' There is no `{ok, data}` wrapper;', to: '' },
  { id: 'code-comment', lang: 'py', file: 'py/README.md', section: 'tutorial', what: 'a comment inside a code block altered',
    from: "# Update — the id comes off the created entity's record", to: '# Update — the id comes from the server' },
  { id: 'variable', lang: 'c', file: 'c/README.md', section: 'tutorial', what: 'an example variable renamed (planets -> planetz)',
    from: /\bplanets\b/g, to: 'planetz' },
]
const copy = Path.join(a.work, 'new')
Fs.rmSync(a.work, { recursive: true, force: true })
Fs.cpSync(Path.resolve(a.new), copy, { recursive: true, dereference: true })
for (const j of INJ) {
  const f = Path.join(copy, V, j.file)
  const t = Fs.readFileSync(f, 'utf8')
  // the tutorial injections stay inside the tutorial section
  const s = 'tutorial' === j.section ? t.indexOf('## Tutorial') : 0, e = 'tutorial' === j.section ? t.indexOf('\n## ', s + 5) : t.length
  const mid = t.slice(s, e)
  const n = 'string' === typeof j.from ? mid.split(j.from).length - 1 : (mid.match(j.from) || []).length
  if (!n) throw new Error(j.id + ': nothing to change')
  Fs.writeFileSync(f, t.slice(0, s) + ('string' === typeof j.from ? mid.replace(j.from, j.to) : mid.replace(j.from, j.to)) + t.slice(e))
  j.count = 'string' === typeof j.from ? 1 : n
}
const node = process.execPath
const run = (tool, root, out, j) => {
  try { CP.execFileSync(node, [Path.join(__dirname, tool), '--old', a.old, '--new', root, '--lang', j.lang, '--section', j.section, '--vars', V, '--out', out], { stdio: 'pipe' }) } catch (e) { }
}
let all = true
for (const j of INJ) {
  const base = Path.join(a.work, 'review-base'), inj = Path.join(a.work, 'review-inj')
  const fresh = []
  for (const tool of ['ledger.js', 'blocks.js']) {
    run(tool, a.new, base, j); run(tool, copy, inj, j)
    const kind = tool.replace('.js', '')
    const read = (d) => Fs.readFileSync(Path.join(d, j.lang, `${j.section}.${kind}.txt`), 'utf8')
    const ids = (t) => new Set([...t.matchAll(/^\[([0-9a-f]{10})\]/gm)].map((m) => m[1]))
    const bt = read(base), it = read(inj), bi = ids(bt)
    const lines = it.split('\n')
    lines.forEach((l, k) => {
      const m = /^\[([0-9a-f]{10})\]/.exec(l)
      if (m && !bi.has(m[1])) {
        const sect = lines.slice(0, k).reverse().find((x) => /^## /.test(x)) || ''
        fresh.push(`${kind} ${sect.replace('## ', '').split(':')[0]}: ${l.slice(0, 90)}\n        ${(() => { const r = []; for (const x of lines.slice(k + 1)) { if (!/^   /.test(x)) break; r.push(x) } return r.slice(0, 3) })().map((x) => x.trim()).join('\n        ').slice(0, 400)}`)
      }
    })
  }
  all = all && fresh.length > 0
  console.log(`${fresh.length ? 'FLAGGED' : 'MISSED '} ${j.id} (${j.lang} ${j.section}, ${V}): ${j.what}${j.count > 1 ? `, ${j.count} occurrences` : ''}`)
  for (const f of fresh) console.log('    ' + f)
}
process.exit(all ? 0 : 1)
