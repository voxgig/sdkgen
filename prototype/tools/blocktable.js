// node blocktable.js <old-root> <new-root> <lang>..: the block table per language and section (identical, corrected, unified, otherwise), as blocks.js counts it.
const B = require('./blocks.js'), C = require('./cut.js')
const [oldRoot, newRoot, ...langs] = process.argv.slice(2)
for (const lang of langs) for (const section of C.SECTIONS) {
  const r = B.run({ old: oldRoot, new: newRoot }, section, lang)
  const t = r.tally
  console.log((lang + ' ' + section).padEnd(20), `identical ${t.identical}, corrected ${t.corrected}, unified ${t.unified}, otherwise ${t.changed}, oldOnly ${t.oldOnly}, newOnly ${t.newOnly}`, process.env.USED ? JSON.stringify(r.used) : '')
}
