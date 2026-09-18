

type Parts = [number, number, number]


const COMPARATOR_RE = /^(>=|<=|>|<|=|\^|~)?v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/

const ANY_RE = /^(\*|x|X)$/


function parseVersion(v: string): Parts | undefined {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim())

  return null == m ? undefined :
    [Number(m[1]), Number(m[2]), Number(m[3])]
}


function compare(a: Parts, b: Parts): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return a[i] < b[i] ? -1 : 1
    }
  }
  return 0
}


function caretBound(p: Parts): Parts {
  if (0 !== p[0]) return [p[0] + 1, 0, 0]
  if (0 !== p[1]) return [0, p[1] + 1, 0]
  return [0, 0, p[2] + 1]
}


function tildeBound(p: Parts, given: number): Parts {
  return nextBound(p, given)
}


function nextBound(p: Parts, given: number): Parts {
  return 1 === given ? [p[0] + 1, 0, 0] : [p[0], p[1] + 1, 0]
}


function satisfiesOne(version: Parts, comparator: string): boolean | undefined {
  const c = comparator.trim()

  if ('' === c || ANY_RE.test(c)) {
    return true
  }

  const m = COMPARATOR_RE.exec(c)

  if (null == m) {
    return undefined
  }

  const op = m[1] ?? '='

  // How many components were actually written — `~1.2` and `~1` bound
  // differently, and a partial version means "any" in its missing places.
  const given = null != m[4] ? 3 : null != m[3] ? 2 : 1
  const p: Parts = [Number(m[2]), Number(m[3] ?? 0), Number(m[4] ?? 0)]

  const cmp = compare(version, p)

  const bound = 3 === given ? p : nextBound(p, given)

  if ('>=' === op) return 0 <= cmp
  if ('<' === op) return 0 > cmp
  if ('>' === op) return 3 === given ? 0 < cmp : 0 <= compare(version, bound)
  if ('<=' === op) return 3 === given ? 0 >= cmp : 0 > compare(version, bound)

  if ('^' === op) {
    return 0 <= cmp && 0 > compare(version, caretBound(p))
  }

  if ('~' === op) {
    return 0 <= cmp && 0 > compare(version, tildeBound(p, given))
  }

  if (3 === given) return 0 === cmp
  if (2 === given) return version[0] === p[0] && version[1] === p[1]
  return version[0] === p[0]
}


// Does `version` satisfy `range`?
//
// `true` / `false` / `undefined` — see the note at the top: undefined means
// "not understood", and the caller must not treat it as a failure.
function satisfies(version: string, range: string): boolean | undefined {
  const v = parseVersion(version)

  if (null == v) {
    return undefined
  }

  const text = String(range ?? '').trim()

  if ('' === text || ANY_RE.test(text)) {
    return true
  }

  if (/\s-\s/.test(text)) {
    return undefined
  }

  // An alternative that MATCHES wins immediately, whatever the others say.
  // But a `false` is only reportable if every comparator was understood:
  // otherwise the honest answer is "do not know", and refusing on it would be
  // the strict-direction failure this module is shaped to avoid.
  let unknown = false

  for (const alt of text.split('||')) {
    const comparators = alt.trim().split(/\s+/).filter((s) => '' !== s)

    if (0 === comparators.length) {
      unknown = true
      continue
    }

    let all = true

    for (const c of comparators) {
      const one = satisfiesOne(v, c)

      if (null == one) {
        unknown = true
        all = false
      }
      else if (!one) {
        all = false
      }
    }

    if (all) {
      return true
    }
  }

  return unknown ? undefined : false
}


export {
  satisfies,
  parseVersion,
}
