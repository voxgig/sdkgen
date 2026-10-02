/* Copyright (c) 2026 Voxgig Ltd, MIT License */

import { each } from 'jostraca'


// The model records a point's request body as `rb` and its success response
// as `rs`; the generated config carries them as `body` and `response`.

// The data key a raw request body travels under, in every target.
const RAW_BODY = '$body'


// The body an operation's active points declare when it is not JSON alone.
function opRequestBody(op: any): any {
  const points: any[] = op?.points ? each(op.points) : []
  return points
    .filter((pt: any) => false !== pt?.a)
    .map((pt: any) => pt?.rb)
    .find((rb: any) => null != rb && 'json' !== rb.kind)
}


function opRawBody(op: any): any {
  const rb = opRequestBody(op)
  return 'raw' === rb?.kind ? rb : undefined
}


function codeList(types: string[]): string {
  return types.map((t) => '`' + t + '`').join(', ')
}


// The reference note for an operation whose body is not JSON. `values` names
// what the target accepts as `$body`; `binary: false` marks a target that
// cannot send bytes yet.
function bodyNote(op: any, target: { values: string, binary?: boolean }): string {
  const rb = opRequestBody(op)
  if (null == rb || 'string' !== typeof rb.media) {
    return ''
  }

  if ('raw' !== rb.kind) {
    return 'Declares a `' + rb.media + '` body, which this SDK does not encode yet: ' +
      'it sends the data as JSON.\n\n'
  }

  if (true === rb.binary && false === target.binary) {
    return 'Declares a binary `' + rb.media + '` body, which this SDK cannot send yet.\n\n'
  }

  const others = (Array.isArray(rb.alternatives) ? rb.alternatives : [])
    .map((alt: any) => alt?.media).filter((m: any) => 'string' === typeof m)

  return 'Sends its body unencoded, as `' + rb.media + '`: pass it as `' + RAW_BODY +
    '`, ' + target.values + '.' +
    (0 < others.length ? ' The operation also accepts ' + codeList(others) +
      ': a `content-type` header option that is not JSON replaces the declared one.' : '') +
    '\n\n'
}


export {
  RAW_BODY,
  bodyNote,
  opRawBody,
  opRequestBody,
}
