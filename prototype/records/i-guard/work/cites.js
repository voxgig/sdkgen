const TS = '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/i-guard/sdkgen/ts'
const G = require(TS + '/dist-test/runtimeforms/guard.js')
const get = (S, p) => p.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((x, k) => null == x ? x : x[k], S)
for (const t of (process.argv.length > 2 ? process.argv.slice(2) : G.PROVIDERS)) {
  const forms = G.formsOf(t), S = G.syntaxOf(t)
  for (const [p, c] of Object.entries(forms.cite || {})) {
    const v = /^notes\./.test(p) ? (S.notes || {})[p.slice(6)] : get(S, p)
    console.log(`## ${t} ${p} = ${JSON.stringify(v)}`)
    if (c.absent) { console.log('   absent', c.absent.pattern, c.absent.files.join(' ')); continue }
    for (const part of [c, ...(c.also || [])]) console.log('   ' + part.file + ': ' + JSON.stringify(part.quote))
    if (c.unquoted) console.log('   unquoted ' + JSON.stringify(c.unquoted))
  }
}
