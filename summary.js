// node summary.js <lang> <review/lang dir> <guard result> <variations missing from new>
// The one screen portcheck.sh prints, from the JSON the tools wrote. Exit 1
// on anything unclassified, a defect, an impure provider, notes no region
// holds, a language or convention fact not attested on the OLD page (and not
// recorded by hand), and, with STRICT_SENTENCES=1, a shared match against a
// reference sentence nobody gave a verdict.
const Fs = require('node:fs')
const Path = require('node:path')
const [lang, dir, guard, missingVars] = process.argv.slice(2)
const J = (f) => { try { return JSON.parse(Fs.readFileSync(Path.join(dir, f), 'utf8')) } catch (e) { return null } }
const L = J('ledger.json') || [], B = J('blocks.json') || [], Pu = (J('purity.json') || {})[lang]
let bad = 0
const out = []
out.push(`== portcheck ${lang} ==${missingVars && missingVars.trim() ? `   (variations in old/ with no new/: ${missingVars.trim()}; their classes count one less)` : ''}`)
out.push('section    ledger: units same | classes shared rule-rec by-hand missing  OPEN  defect | contradictions')
for (const r of L) {
  const by = r.by || {}
  out.push(`${r.section.padEnd(10)}         ${String(r.tally.same).padStart(10)} | ${String(r.classes).padStart(7)} ${String(by.shared || 0).padStart(6)} ${String(by.rule || 0).padStart(8)} ${String(by.hand || 0).padStart(7)} ${String(by.missing || 0).padStart(7)} ${String(r.unclassified).padStart(5)} ${String(r.defect).padStart(7)} | ${r.contradictions.length}`)
  if (r.unclassified || r.defect) bad++
}
out.push('section    blocks: identical corrected unified otherwise | classes OPEN defect | compiler on PATH')
for (const r of B) {
  const t = r.tally
  const changed = t.corrected + t.unified + t.changed + t.newOnly
  out.push(`${r.section.padEnd(10)}         ${String(t.identical).padStart(9)} ${String(t.corrected).padStart(9)} ${String(t.unified).padStart(7)} ${String(t.changed).padStart(9)} | ${String(r.classes).padStart(7)} ${String(r.unclassified).padStart(4)} ${String(r.defect).padStart(6)} | ${r.toolchain ? 'yes (' + r.toolchain + ')' : 'NO'}; ${changed} changed blocks compiled by nothing`)
  if (r.unclassified || r.defect) bad++
}
out.push('  classes = "otherwise" pairs grouped by masked diff + OLD-only/NEW-only blocks + identifiers new to or gone from the code (' + B.map((r) => r.section + ': ' + Object.entries(r.byType || {}).map(([k, v]) => k + ' ' + v).join(', ')).join('; ') + ')')
out.push('  a compiler on PATH compiles nothing here: no tool compiles the changed blocks of these variations; the toolchain lanes compile their own models')
const contra = L.flatMap((r) => r.contradictions.map((c) => ({ ...c, section: r.section })))
if (contra.length) {
  out.push(`contradictions (${contra.length}; counted, not failed):`)
  for (const c of contra.slice(0, 12)) out.push(`  ${c.section} [${c.id}] ${String(c.text).slice(0, 70)} | other: ${String(c.where).slice(0, 60)} | true: ${String(c.true).slice(0, 40)}`)
  if (contra.length > 12) out.push(`  ... ${contra.length - 12} more in review/${lang}/ledger.log`)
}
if (Pu) {
  const noteBad = Pu.open.filter((f) => /notes declared but no notes region|outside every notes region/.test(f.check)).length
  out.push(`purity: ${Pu.open.length} open, ${Pu.accepted.length} accepted | notes declared ${null == Pu.declaredNotes ? '?' : Pu.declaredNotes}, note regions found ${Pu.noteRegions}${noteBad ? ' (NOTES NOT LINTED)' : ''}`)
  for (const f of Pu.open.slice(0, 6)) out.push(`  OPEN ${f.file}:${f.line} ${f.check}: ${String(f.text).slice(0, 90)}`)
  if (Pu.open.length) bad++
} else { out.push('purity: NOT RUN'); bad++ }
out.push(`guard: ${guard}`)
const Fa = J('facts.json')
if (Fa) {
  const at = Fa.attestation || {}
  out.push(`facts (language and convention, against the OLD page${Fa.scratch ? '; from scratch, hand records ignored' : ''}): attested ${at.ATTESTED || 0}, recorded by hand ${at.RECORDED || 0}, UNATTESTED ${Fa.unattested.length}, not printed ${at['not printed'] || 0}, not judged ${at['not judged'] || 0}; cited ${Fa.cited}, pinned prose ${Fa.pinned.length} (the reviewer audits each)`)
  for (const u of Fa.unattested) out.push(`  UNATTESTED ${u.path} = ${JSON.stringify(u.value)} (${u.account}): ${String(u.detail || '').slice(0, 110)}${u.handProblem ? '; ' + u.handProblem : ''}`)
  if (Fa.unattested.length) out.push(`  record each in hand/${lang}.json facts: { "<path>": { "value", "why", "evidence" } }, or fix the provider`)
  if (Fa.unattested.length || Fa.noAccount) bad++
} else { out.push('facts: NOT RUN'); bad++ }
const Se = J('sentences.json')
if (Se) {
  const strict = '1' === process.env.STRICT_SENTENCES
  out.push(`shared sentences: matched ${Se.matched}, of which against a sentence nobody reviewed ${Se.unreviewed}${strict ? ' (STRICT_SENTENCES=1: fails)' : ' (fails only with STRICT_SENTENCES=1)'}; printed less often than its reference ${Se.fewer} (open, above); absent here but printed by every reference of this result style ${Se.absent} (${Se.absentExplained} explained; listed in <section>.absent.json, not failed)`)
  if (strict && Se.unreviewed) bad++
}
const fsl = (() => { try { return Fs.readFileSync(Path.join(dir, 'factsheet.log'), 'utf8').trim().split('\n').pop() } catch (e) { return 'factsheet: not run' } })()
out.push(`fact sheet: ${fsl.replace(/ -> .*$/, '')}: ${Path.join(dir, 'facts.txt')} (audit every fact a shared sentence carries)`)
out.push(`worklists: ${dir}/<section>.open.json (fill into hand/${lang}.json), *.ledger.txt, *.blocks.txt, *.blocks.diff`)
console.log(out.join('\n'))
process.exit(bad ? 1 : 0)
