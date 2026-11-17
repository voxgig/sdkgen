// node puritymut.js <mutations.json> <cmp-dir copy> <out-root>
// Each mutation: edit one provider file in a COPY of the providers, run
// purity.js on that language, restore. FLAGGED when purity reports an open
// finding (exit 1), MISSED otherwise. Never point it at a clone's own tree.
const Fs = require('fs'), Path = require('path'), CP = require('child_process')
const [mfile, CMP, ROOT] = process.argv.slice(2)
const muts = JSON.parse(Fs.readFileSync(mfile, 'utf8'))
let flagged = 0
const res = []
for (const m of muts) {
  const p = Path.join(CMP, m.file)
  const orig = Fs.readFileSync(p, 'utf8')
  // one edit (from, to) or several (edits: [{ from, to }]), each unique in the file
  let src = orig, bad = null
  for (const e of m.edits || [{ from: m.from, to: m.to }]) { if (1 !== src.split(e.from).length - 1) { bad = e.from.slice(0, 40); break } src = src.replace(e.from, e.to) }
  if (bad) { console.log(m.id, 'ERROR from not unique/found: ' + bad); res.push({ id: m.id, error: true }); continue }
  Fs.writeFileSync(p, src)
  let out = '', rc = 0
  try { out = CP.execFileSync(process.execPath, [Path.join(__dirname, 'purity.js'), '--providers', CMP, '--lang', m.lang, '--root', ROOT], { stdio: 'pipe' }).toString() }
  catch (e) { rc = e.status; out = String(e.stdout) + String(e.stderr) }
  Fs.writeFileSync(p, orig)
  const detail = out.split('\n').filter((l) => /^\s{5}\S.*: \d+$/.test(l)).map((l) => l.trim()).join('; ')
  const f = 1 === rc
  if (f) flagged++
  res.push({ id: m.id, lang: m.lang, flagged: f, detail })
  console.log(`${m.id.padEnd(26)} ${f ? 'FLAGGED' : 'MISSED '} rc=${rc} | ${detail}`)
}
console.log(`${flagged} of ${muts.length} flagged`)
if (process.env.JSON_OUT) Fs.writeFileSync(process.env.JSON_OUT, JSON.stringify(res, null, 1))
process.exit(flagged === muts.length ? 0 : 1)
