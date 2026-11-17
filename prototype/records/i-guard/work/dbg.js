// node dbg.js [langs...]: guard findings, account findings, control misses and reader problems.
const TS = process.env.TSDIR || '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/i-guard/sdkgen/ts'
const G = require(TS + '/dist-test/runtimeforms/guard.js')
const A = require(TS + '/dist-test/runtimeforms/account.js')
const Fs = require('fs')
const langs = process.argv.slice(2)
// reader problems through running the reader test file's function is not exported; re-run via node --test is slow, so require the module's helpers
for (const t of (langs.length ? langs : G.PROVIDERS)) {
  const forms = G.formsOf(t)
  if (null == forms) { console.log(t, 'no forms'); continue }
  if (G.PROVIDERS.includes(t)) {
    const S = G.syntaxOf(t)
    const r = G.full(t, S, forms)
    for (const f of r.all) console.log(t, 'FIND', f.check, '|', f.what)
    for (const c of G.CONTROLS) {
      const S0 = G.syntaxOf(t)
      const S1 = { ...S0, facts: G.clone(S0.facts), notes: G.clone(S0.notes) }
      S1.ref = S0.ref ? { ...S0.ref, facts: G.clone(S0.ref.facts) } : S0.ref
      const f1 = { ...forms, cite: G.clone(forms.cite), types: { ...forms.types } }
      if (!c.mutate(S1, f1)) { if (process.env.NA) console.log(t, 'n/a', c.name); continue }
      const found = G.full(t, S1, f1).all
      if (!found.some((x) => x.check === c.check)) console.log(t, 'MISSED', c.name, JSON.stringify(found).slice(0, 300))
    }
  }
}
