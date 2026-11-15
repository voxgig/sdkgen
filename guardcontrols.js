const Path = require('path')
const T = Path.resolve(__dirname, '../sdkgen/ts')
const { check, CONTROLS } = require(T + '/dist-test/runtimefacts.test.js')
const STAGE = T + '/dist-test-scaffold/.sdk/dist/cmp/'
const clone = (x) => { const o = Array.isArray(x) ? [] : {}; for (const [k, v] of Object.entries(x)) o[k] = null != v && 'object' === typeof v ? clone(v) : v; return o }
const langs = ['ts','go','py','c','zig','clojure','rust','elixir']
const head = ['control'.padEnd(46), ...langs.map(l => l.padEnd(8))].join('')
console.log(head)
for (const c of CONTROLS) {
  const row = [c.name.padEnd(46)]
  for (const t of langs) {
    const S0 = require(STAGE + t + '/Syntax_' + t + '.js').Syntax
    const forms = require(T + '/dist-test/runtimeforms/' + t + '.js').forms
    const S = clone(S0); S.ref = S0.ref ? { ...S0.ref, facts: clone(S0.ref.facts) } : S0.ref
    if (!c.mutate(S, forms)) { row.push('n/a'.padEnd(8)); continue }
    const f = check(t, S, forms)
    row.push((f.some(x => x.check === c.check) ? 'caught' : 'MISSED').padEnd(8))
  }
  console.log(row.join(''))
}
