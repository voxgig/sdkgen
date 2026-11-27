import { Context } from '../../types'

import { BinarySource, bodyItems, isBlob, isBytes, itemText, toBytes } from '../BinaryUtility'
import { isStream } from '../MediaUtility'


const MULTIPART_MEDIA = 'multipart/form-data'

const OCTET_MEDIA = 'application/octet-stream'

const CRLF = '\r\n'


function multipartBoundary(_ctx: Context): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}


// Inside a quoted header parameter nothing may end the quote or the line.
function quoted(text: string): string {
  return text.replace(/[\\"\r\n]/g, (c) =>
    '\\' === c ? '%5C' : '"' === c ? '%22' : '\r' === c ? '%0D' : '%0A')
}


// A local path never leaves: only its last segment, and nothing for an empty one.
function baseName(name: any): string | undefined {
  if ('string' !== typeof name) {
    return undefined
  }
  const base = name.split(/[\\/]/).pop() || ''
  return '' === base ? undefined : base
}


type Part = {
  name: string
  filename?: string
  type?: string
  content: Uint8Array | Blob
}


function filePart(ctx: Context, name: string, field: any, value: any): Part | Error {
  let content: any = value
  let filename: string | undefined = undefined
  let type: string | undefined = undefined

  if (value instanceof BinarySource) {
    content = value.data
    filename = baseName(value.name)
    type = value.type
  }
  else if (isBlob(value)) {
    filename = baseName((value as any).name)
    type = (value as Blob).type || undefined
  }

  if (isStream(content)) {
    return ctx.error('binary_feature_inactive', 'The multipart field "' + name +
      '" holds a stream, which needs the binary feature: pass bytes, a Blob or a source.')
  }

  return {
    name,
    filename,
    type: type ?? field.media ?? OCTET_MEDIA,
    content: isBlob(content) ? content : isBytes(content) ? toBytes(content) :
      toBytes(itemText(content)),
  }
}


function textPart(name: string, field: any, value: any): Part {
  return {
    name,
    type: field.media,
    content: isBytes(value) ? toBytes(value) : toBytes(itemText(value)),
  }
}


function encodeMultipart(ctx: Context, data: any, lifted: Record<string, any>):
  { type: string, body: Uint8Array | Blob } | Error {
  const body = ctx.point?.body
  const boundary = ctx.utility.multipartBoundary(ctx)
  const chunks: (Uint8Array | Blob)[] = []

  for (const item of bodyItems(body, data, lifted)) {
    const part = item.binary ? filePart(ctx, item.name, item.field, item.value) :
      textPart(item.name, item.field, item.value)
    if (part instanceof Error) {
      return part
    }

    if ('string' === typeof part.type && /[\r\n]/.test(part.type)) {
      return ctx.error('binary_source_refused', 'The media type of the multipart field "' +
        item.name + '" contains a line break.')
    }

    chunks.push(toBytes('--' + boundary + CRLF +
      'Content-Disposition: form-data; name="' + quoted(part.name) + '"' +
      (null == part.filename ? '' : '; filename="' + quoted(part.filename) + '"') + CRLF +
      (null == part.type ? '' : 'Content-Type: ' + part.type + CRLF) + CRLF))
    chunks.push(part.content)
    chunks.push(toBytes(CRLF))
  }

  chunks.push(toBytes('--' + boundary + '--' + CRLF))

  const declared = 'string' === typeof body?.media ? body.media.split(';')[0].trim() : ''
  const type = ('' === declared ? MULTIPART_MEDIA : declared) + '; boundary=' + boundary

  if (chunks.some(isBlob)) {
    return { type, body: new Blob(chunks as BlobPart[], { type }) }
  }

  const out = new Uint8Array(chunks.reduce((n, c) => n + (c as Uint8Array).byteLength, 0))
  let at = 0
  for (const chunk of chunks as Uint8Array[]) {
    out.set(chunk, at)
    at += chunk.byteLength
  }
  return { type, body: out }
}


export {
  baseName,
  encodeMultipart,
  multipartBoundary,
  quoted,
}
