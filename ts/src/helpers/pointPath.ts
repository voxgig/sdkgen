/* Copyright (c) 2024-2025 Voxgig, MIT License */

// A point's path, as apidef resolves it.
//
// apidef ADR-003: the model carries the path as a typed segment vector —
// `[{ lit: 'element' }, { var: 'id' }]` — and no brace-templated string. A
// `var` names one of the point's `args.params` directly, so a consumer walks
// the vector instead of parsing anything.
//
// The generated SDK runtimes still speak the older braced-string form
// (`['element', '{id}']`), which this file reconstructs in ONE place. Every
// generation-time consumer and the embedded config go through here, so when
// the runtimes move onto segments there is a single call site to retire —
// rather than the twenty-odd hand-written brace parsers ADR-003 is about.


type PathSegment = {
  lit?: string
  var?: string
}


// The segment vector, defensively. GraphQL points address the single endpoint
// and carry no path, so an empty vector is normal, not a fault.
function pointSegments(point: any): PathSegment[] {
  const segments = point && point.segments
  return Array.isArray(segments) ? segments : []
}


// The braced-string form the SDK runtimes still consume. A `lit` is emitted
// verbatim — including one that contains braces, which apidef leaves literal
// (a compound element like `{a}.{b}` names no single parameter). That is the
// lossiness ADR-003 removed from the model, and it survives here only because
// this is the OLD representation being reconstructed on the way out.
function pointParts(point: any): string[] {
  return pointSegments(point).map((seg: PathSegment) =>
    null == seg.var ? String(seg.lit ?? '') : '{' + seg.var + '}')
}


// Does the path end in a parameter? The braced form had to ask whether the
// last part started with `{`; the vector states it.
function pointTerminalParam(point: any): boolean {
  const segments = pointSegments(point)
  return 0 < segments.length && null != segments[segments.length - 1].var
}


// Do two points describe the same route? Compares the vectors, so a literal
// containing braces cannot be mistaken for a parameter of the same spelling.
function pointPathKey(point: any): string {
  return pointSegments(point)
    .map((seg: PathSegment) =>
      null == seg.var ? 'l:' + String(seg.lit ?? '') : 'v:' + seg.var)
    .join('/')
}


export type {
  PathSegment,
}

export {
  pointSegments,
  pointParts,
  pointTerminalParam,
  pointPathKey,
}
