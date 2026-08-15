// A DELIBERATELY SMALL semver range check, for `engines.sdkgen`.
//
// WHY NOT node-semver
//
// This package has no runtime dependencies (`dependencies: {}`), and adding
// one to read a single optional manifest field is a poor trade. What the field
// actually carries is a floor — `">=3.5"` — so the subset below covers the
// spellings that occur, and REFUSES TO GUESS at anything else.
//
// THE FAILURE DIRECTION MATTERS MORE THAN THE COVERAGE
//
// Getting this wrong in the strict direction refuses a package that would
// have worked, which is worse than the incompatibility it is trying to
// prevent. So `satisfies` has three outcomes, not two: yes, no, and
// `undefined` for "this range is outside the subset I understand". A caller
// that gets `undefined` must let the install proceed and say so, never treat
// it as a failure.
//
// SUPPORTED
//   *  x  X  ''            any version
//   >=1.2.3  >1.2  <=2  <2  =1.2.3  1.2.3
//   ^1.2.3  ~1.2.3
//   space-separated conjunction:  ">=3.5 <4"
//   ||-separated alternatives:    "^3 || ^4"
//
// NOT SUPPORTED (returns undefined)
//   hyphen ranges (`1.2.3 - 2.3.4`), prerelease/build metadata comparison,
//   and anything else. Prereleases are compared by their numeric core only,
//   which is why a range mentioning one is rejected rather than mishandled.


type Parts = [number, number, number]


const COMPARATOR_RE = /^(>=|<=|>|<|=|\^|~)?v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/

const ANY_RE = /^(\*|x|X)$/


// A version as three numbers, or undefined if it is not a plain `X.Y.Z`.
// A prerelease or build suffix returns undefined deliberately: comparing them
// properly is most of what makes semver hard, and this subset does not.
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


// The upper bound `^` and `~` imply, exclusive.
//
//   ^1.2.3 -> <2.0.0      ^0.2.3 -> <0.3.0      ^0.0.3 -> <0.0.4
//   ~1.2.3 -> <1.3.0      ~1.2   -> <1.3.0      ~1     -> <2.0.0
//
// `^0.x` is the case worth stating: npm treats a leading zero as unstable, so
// the caret narrows to the first NON-ZERO component. Getting that wrong would
// admit `0.3.0` for `^0.2.3`, which is a breaking change by that convention.
function caretBound(p: Parts): Parts {
  if (0 !== p[0]) return [p[0] + 1, 0, 0]
  if (0 !== p[1]) return [0, p[1] + 1, 0]
  return [0, 0, p[2] + 1]
}


function tildeBound(p: Parts, given: number): Parts {
  return nextBound(p, given)
}


// The version just past everything a PARTIAL version covers: `3.4` covers all
// of 3.4.x, so the next bound is 3.5.0; `3` covers all of 3.x, so 4.0.0.
// Shared by `~` and by the two strict comparators that need it, so they
// cannot disagree about where a partial version ends.
function nextBound(p: Parts, given: number): Parts {
  return 1 === given ? [p[0] + 1, 0, 0] : [p[0], p[1] + 1, 0]
}


// One comparator against one version. `undefined` if the comparator is
// outside the subset.
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

  // A PARTIAL version is a RANGE, not a version with zeroes in it, and two of
  // the four strict comparators have to move their bound to say so:
  //
  //   >3.4   means ">= all of 3.4.x"  ->  >=3.5.0    (not >3.4.0)
  //   <=3.4  means "<= all of 3.4.x"  ->  <3.5.0     (not <=3.4.0)
  //   >=3.4  ->  >=3.4.0     <3.4  ->  <3.4.0        (already right)
  //
  // Read as literal zeroes, `>3.4` admitted 3.4.8 (an incompatible package
  // let through) and `<=3.4` rejected it (a compatible one refused) — the two
  // failures this module's whole shape is meant to avoid, in one comparator.
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

  // `=` / bare. A partial version is a PREFIX match: `1.2` admits any 1.2.x,
  // which is what every other tool means by it.
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

  // A hyphen range is not supported, and its parts would otherwise be read as
  // a conjunction of two bare versions — which is never satisfiable, i.e. a
  // false REFUSAL. Rejected explicitly rather than by accident.
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
