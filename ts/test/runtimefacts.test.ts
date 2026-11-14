// Each fact a syntax provider declares is re-derived from its runtime through
// the forms in test/runtimeforms/<lang>.ts (runtimeforms/guard.ts), cited
// there, or a property of the language or a documentation convention
// (runtimeforms/account.ts). A fact in none of these fails, and each check
// has a negative control.

import { describe, test } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'
import * as Fs from 'node:fs'
import * as Path from 'node:path'

import { account, tally } from './runtimeforms/account'
import { CONTROLS, FORMS, FORMS_SRC, PROVIDERS, check, clone, formsOf, full, syntaxOf } from './runtimeforms/guard'


describe('runtimefacts', () => {

  test('every provider is checked', () => {
    ok(PROVIDERS.length >= 8, 'providers found: ' + PROVIDERS.join(' '))
  })

  test('every compiled forms file has its source, and every provider a forms source', () => {
    const stale = Fs.readdirSync(FORMS).filter((f: string) => f.endsWith('.js'))
      .map((f: string) => f.slice(0, -3)).filter((n: string) => !Fs.existsSync(Path.join(FORMS_SRC, n + '.ts')))
    deepStrictEqual(stale, [], 'compiled forms with no source (a deleted forms file still passes until dist-test is rebuilt clean)')
    const missing = PROVIDERS.filter((t) => !Fs.existsSync(Path.join(FORMS_SRC, t + '.ts')))
    deepStrictEqual(missing, [], 'providers with no forms source')
  })

  for (const t of PROVIDERS) {
    test(t + ': the language declares its runtime forms', () => {
      ok(null != formsOf(t), t + ' has a syntax provider and no test/runtimeforms/' + t + '.ts: ' +
        'a ported language must declare how its runtime writes things')
    })

    test(t + ': the declared facts are what its runtime defines', () => {
      const forms = formsOf(t)
      if (null == forms) throw new Error(t + ': no runtime forms')
      deepStrictEqual(check(t, syntaxOf(t), forms).findings, [], t + ': declared facts the runtime contradicts')
    })

    test(t + ': every declared fact is accounted for', () => {
      const forms = formsOf(t)
      if (null == forms) throw new Error(t + ': no runtime forms')
      const res = check(t, syntaxOf(t), forms)
      deepStrictEqual(account(t, syntaxOf(t), forms, res.verified).findings, [], t + ': declared facts with no account')
    })

    test(t + ': each check fails when its fact is changed (negative controls)', () => {
      const forms0 = formsOf(t)
      if (null == forms0) throw new Error(t + ': no runtime forms')
      const missed: string[] = []
      for (const c of CONTROLS) {
        const S0 = syntaxOf(t)
        const S = { ...S0, facts: clone(S0.facts), notes: clone(S0.notes) }
        S.ref = S0.ref ? { ...S0.ref, facts: clone(S0.ref.facts) } : S0.ref
        const forms = { ...forms0, cite: clone(forms0.cite), types: { ...forms0.types } }
        if (!c.mutate(S, forms)) continue
        const found = full(t, S, forms).all
        if (!found.some((x) => x.check === c.check)) missed.push(`${c.name} (${c.check}): ${JSON.stringify(found)}`)
      }
      deepStrictEqual(missed, [], t + ': a changed fact the guard did not catch')
    })
  }

  test('the account, per language (SDKGEN_GUARD_REPORT=1 prints it)', () => {
    const lines: string[] = []
    for (const t of PROVIDERS) {
      const forms = formsOf(t)
      if (null == forms) continue
      const res = full(t, syntaxOf(t), forms)
      const n = tally(res.account)
      lines.push(`${t}: ` + Object.entries(n).map(([k, v]) => `${k} ${v}`).join(', ') +
        `; types: ${null == forms.types.column ? 'printer total only (' + forms.types.reason + ')' : 'column ' + forms.types.column}` +
        `; uncompared ${Object.entries(res.uncompared).filter(([, v]) => 0 < v).map(([k, v]) => `${k} ${v} (${(forms.uncompared as any)?.[k]})`).join(', ') || 'none'}`)
      for (const c of res.account.cited) {
        lines.push(`  cited${c.prose ? ' (prose: audit only)' : ''} ${c.path} = ${JSON.stringify(c.value)}\n    ${c.file}: ${JSON.stringify(c.quote)}`)
      }
      for (const x of res.account.excepted) lines.push(`  excepted ${x.path}: ${x.reason}`)
      // One line per declared leaf, for a reviewer's fact sheet.
      const cites = new Map(res.account.cited.map((c) => [c.path, c.file]))
      for (const [p, c] of Object.entries(res.account.category)) {
        lines.push(`${t} account ${p}: ${c}${cites.has(p) ? ' (' + cites.get(p) + ')' : ''}`)
      }
      for (const [k, v] of Object.entries(forms.exceptions || {})) {
        if (!/^(facts|ref\.facts|notes)\./.test(k)) lines.push(`  exception ${k}: ${v}`)
      }
    }
    if (process.env.SDKGEN_GUARD_REPORT) console.log(lines.join('\n'))
    ok(0 < lines.length)
  })
})

