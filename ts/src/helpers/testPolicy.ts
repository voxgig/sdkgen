// How strict the generated LIVE tests are.
//
// WHY THIS IS A MODEL DECISION
//
// The generated direct tests are deliberately lenient in live mode:
//
//   if (setup.live) {
//     // Live mode is lenient: synthetic IDs frequently 4xx.
//     if (!result.ok || result.status < 200 || result.status >= 300) {
//       return                       // <-- passes
//     }
//   } else {
//     assert(result.ok === true)
//     ...
//   }
//
// That is CORRECT for sdkgen's default case — a fleet SDK generated against
// an arbitrary third-party public API, where synthetic IDs 4xx constantly and
// list response shapes vary wildly. Asserting there would mean permanent red.
//
// It is WRONG for a project that owns the server it tests against, and those
// projects had no way to say so. Measured on voxgig-solardemo-sdk: the live
// TypeScript suite reports 186 pass / 0 fail against the local test app —
// and 184 pass / 2 fail with the server STOPPED. Only the two entity `basic`
// flows noticed. A green live run said almost nothing.
//
// Gaps that announce themselves as a passing test suite are worse than the
// ones that break a build.

import { KIT } from '../types'


// True when live assertions should match the offline ones. Per-target
// override first, then the SDK-wide default, then false.
//
//   main: kit: test: live: strict: true
//   main: kit: target: go: test: live: strict: true
function liveStrict(model: any, target?: string): boolean {
  const perTarget = null == target ? undefined :
    model?.main?.[KIT]?.target?.[target]?.test?.live?.strict

  if (null != perTarget) {
    return true === perTarget
  }

  return true === model?.main?.[KIT]?.test?.live?.strict
}


export {
  liveStrict,
}
