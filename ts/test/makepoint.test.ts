// makePoint is a TEMPLATE: it ships to users verbatim, outside sdkgen's own
// tsconfig, so nothing here compiled or ran it before. This suite transpiles
// the real shipped file and drives it directly.

import { test, describe } from 'node:test'
import { strictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


function loadTemplate(rel: string, shims: Record<string, any> = {}): any {
  const file = Path.join(TM, rel)
  const js = transform(readFileSync(file, 'utf8'), {
    transforms: ['typescript', 'imports'],
    filePath: file,
  }).code

  const req = (p: string) => {
    for (const key of Object.keys(shims)) {
      if (p === key || p.endsWith(key)) {
        return shims[key]
      }
    }
    return require(p)
  }

  const mod: any = { exports: {} }
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', js)
  fn(mod.exports, req, mod, Path.dirname(file), file)
  return mod.exports
}


// ts and js are the reference pair, so both run the SAME cases. The other
// twelve languages carry the same rule in their own makePoint template and
// are covered by their own suites, not from here.
const IMPL: [string, any][] = [
  ['ts', loadTemplate('ts/src/utility/MakePointUtility.ts', { '../types': {} }).makePoint],
  ['js', loadTemplate('js/src/utility/MakePointUtility.js').makePoint],
]


// A context shaped the way the generated pipeline builds one, for an op
// with several points and an id-only match argument.
function makeCtx(points: any[], match: any = { id: 'x' }) {
  return {
    out: {},
    op: { name: 'load', input: 'match', points },
    options: { allow: { op: 'load' } },
    match,
    reqmatch: match,
    utility: { struct: { getprop: (o: any, k: string) => (o ? o[k] : undefined) } },
    error: (code: string, msg: string) => ({ code, message: msg }),
  }
}


describe('makePoint', () => {

  for (const [lang, makePoint] of IMPL) {

    // Trello's board load: /boards/{id} (2 parts) vs cross-references like
    // /notifications/{id}/board (3 parts) — neither's select.exist matches a
    // plain {id}, so the shortest, canonical path must win.
    test(lang + ': falls back to the shortest path when no select.exist matches', () => {
      const short = { parts: ['boards', '{id}'], select: { exist: ['not_a_real_key'] } }
      const long = { parts: ['notifications', '{id}', 'board'], select: { exist: ['notification_id'] } }

      const point = makePoint(makeCtx([long, short]))

      strictEqual(point, short, 'did not prefer the shortest, canonical path')
    })


    // The shortest point must win wherever it sits in the list — picking
    // points[0] would pass the case above by accident if the model happened
    // to order the canonical route first.
    test(lang + ': the shortest path wins from any position', () => {
      const short = { parts: ['boards', '{id}'], select: { exist: ['not_a_real_key'] } }
      const long = { parts: ['notifications', '{id}', 'board'], select: { exist: ['nope'] } }
      const longer = { parts: ['cards', '{id}', 'board', 'x'], select: { exist: ['nope'] } }

      strictEqual(makePoint(makeCtx([short, long, longer])), short, 'first')
      strictEqual(makePoint(makeCtx([long, short, longer])), short, 'middle')
      strictEqual(makePoint(makeCtx([long, longer, short])), short, 'last')
    })


    // The existing, correct case: a point whose select.exist IS satisfied by
    // the match argument still wins outright, unaffected by the fallback.
    test(lang + ': a point whose select.exist matches is still preferred', () => {
      const generic = { parts: ['thing', '{id}'], select: { exist: ['not_a_real_key'] } }
      const specific = { parts: ['other', '{id}', 'thing'], select: { exist: ['id'] } }

      const point = makePoint(makeCtx([generic, specific]))

      strictEqual(point, specific, 'a real select.exist match was not preferred')
    })


    test(lang + ': a single point needs no selection at all', () => {
      const only = { parts: ['thing', '{id}'], select: {} }
      const point = makePoint(makeCtx([only]))
      strictEqual(point, only)
    })


    // The $action edge the fallback introduces: a request naming an action
    // whose own point failed the exist test lands on a non-action point, and
    // is refused rather than silently sent to the wrong endpoint.
    test(lang + ': an unbuildable $action request is refused, not misrouted', () => {
      const plain = { parts: ['planet', '{id}'], select: { exist: ['not_a_real_key'] } }
      const action = {
        parts: ['planet', '{id}', 'terraform'],
        select: { exist: ['not_a_real_key'], $action: 'terraform' },
      }

      const out = makePoint(makeCtx([plain, action], { id: 'x', $action: 'terraform' }))

      strictEqual(out.code, 'point_action_invalid',
        'a $action that cannot be built must error, not fall through to a point')
    })

  }

})
