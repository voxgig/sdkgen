/* Copyright (c) 2024-2025 Voxgig, MIT License */



import { SdkGenError } from '../utility'


type PathSegment = {
  lit?: string
  var?: string
}


function pointSegments(point: any): PathSegment[] {
  const segments = point && point.s

  if (!Array.isArray(segments) && (Array.isArray(point?.parts) || Array.isArray(point?.segments))) {
    throw new SdkGenError(
      'model: the point for `' + (point?.o || point?.orig || '(unknown path)') +
      '` uses an obsolete path shape. Typed segments belong in `s`. ' +
      'Run `npm run generate` in the project\'s `.sdk` to regenerate the API model.')
  }

  return Array.isArray(segments) ? segments : []
}


function pointParts(point: any): string[] {
  return pointSegments(point).map((seg: PathSegment) =>
    null == seg.var ? String(seg.lit ?? '') : '{' + seg.var + '}')
}


// The path parameters a point's URL needs, including a placeholder inside a
// literal segment such as `{version}.mod`.
function pointPlaceholders(point: any): string[] {
  const names: string[] = []
  for (const seg of pointSegments(point)) {
    if (null != seg.var) {
      names.push(String(seg.var))
    }
    else {
      for (const found of String(seg.lit ?? '').matchAll(/\{([^{}/]+)\}/g)) {
        names.push(found[1])
      }
    }
  }
  return names
}


function pointTerminalParam(point: any): boolean {
  const parts = pointParts(point)
  const last = 0 < parts.length ? parts[parts.length - 1] : ''
  return 0 === last.indexOf('{')
}


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
  pointPlaceholders,
  pointTerminalParam,
  pointPathKey,
}
