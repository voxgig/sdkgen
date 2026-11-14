/* Copyright (c) 2026 Voxgig Ltd, MIT License */

import { each } from 'jostraca'


// A point's `rb` and `rs` reach the generated config as `body` and `response`.

const RAW_BODY = '$body'


// The bodies an operation's active points declare that are not JSON.
function opBodies(op: any): any[] {
  const points: any[] = op?.points ? each(op.points) : []
  return points
    .filter((pt: any) => false !== pt?.a)
    .map((pt: any) => pt?.rb)
    .filter((rb: any) => null != rb && 'json' !== rb.kind)
}


// A raw body first: it is the one that needs the caller's `$body`.
function opRequestBody(op: any): any {
  const bodies = opBodies(op)
  return bodies.find((rb: any) => 'raw' === rb.kind) || bodies[0]
}


function opRawBody(op: any): any {
  const rb = opRequestBody(op)
  return 'raw' === rb?.kind ? rb : undefined
}


function codeList(types: string[]): string {
  return types.map((t) => '`' + t + '`').join(', ')
}


// What an operation's request body is, when it is not JSON: plain data, so a
// description can carry it and the note be written from it.
type BodyFacts = {
  kind: 'raw' | 'encoded'
  media: string
  binary: boolean
  others: string[]
  encoded: string[]
}

function bodyFacts(op: any): BodyFacts | null {
  const rb = opRequestBody(op)
  if (null == rb || 'string' !== typeof rb.media) {
    return null
  }
  return {
    kind: 'raw' === rb.kind ? 'raw' : 'encoded',
    media: rb.media,
    binary: true === rb.binary,
    others: (Array.isArray(rb.alternatives) ? rb.alternatives : [])
      .map((alt: any) => alt?.media).filter((m: any) => 'string' === typeof m),
    encoded: opBodies(op).filter((b: any) => 'raw' !== b.kind)
      .map((b: any) => b.media).filter((m: any) => 'string' === typeof m),
  }
}


// The reference note for a body that is not JSON. `values` names what the
// target accepts as `$body`, `once` the stream among them, which is read in
// full before the request is sent, and `binary: false` a target without bytes.
function bodyNoteText(rb: BodyFacts | null, target: { values: string, once?: string, binary?: boolean }): string {
  if (null == rb) {
    return ''
  }

  if ('raw' !== rb.kind) {
    return 'Declares a `' + rb.media + '` body, which this SDK does not encode yet: ' +
      'it sends the data as JSON.\n\n'
  }

  if (true === rb.binary && false === target.binary) {
    return 'Declares a binary `' + rb.media + '` body, which this SDK cannot send yet.\n\n'
  }

  return 'Sends its body unencoded, as `' + rb.media + '`: pass it as `' + RAW_BODY +
    '`, ' + target.values + '.' +
    (null == target.once ? '' : ' ' + target.once.charAt(0).toUpperCase() + target.once.slice(1) +
      ' is read in full before the request is sent, so that a retry sends the same bytes.') +
    (0 < rb.others.length ? ' The operation also accepts ' + codeList(rb.others) +
      ': a `content-type` header option that is not JSON replaces the declared one.' : '') +
    (0 < rb.encoded.length ? ' Its other endpoints declare ' + codeList(rb.encoded) +
      ' bodies, which this SDK sends as JSON.' : '') +
    '\n\n'
}


function bodyNote(op: any, target: { values: string, once?: string, binary?: boolean }): string {
  return bodyNoteText(bodyFacts(op), target)
}


export type { BodyFacts }

export {
  RAW_BODY,
  bodyFacts,
  bodyNote,
  bodyNoteText,
  opRawBody,
  opRequestBody,
}
