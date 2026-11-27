import { Context } from '../../types'

import { BinarySource, bodyItems, isBlob, isBytes, itemText, toBytes } from '../BinaryUtility'
import { isStream } from '../MediaUtility'


const FORM_MEDIA = 'application/x-www-form-urlencoded'

const HEX = '0123456789ABCDEF'


// application/x-www-form-urlencoded byte serialisation: alphanumerics and
// `*-._` as they are, a space as `+`, every other byte as %HH.
function formEscape(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) {
    if ((0x30 <= byte && byte <= 0x39) || (0x41 <= byte && byte <= 0x5a) ||
      (0x61 <= byte && byte <= 0x7a) || 0x2a === byte || 0x2d === byte ||
      0x2e === byte || 0x5f === byte) {
      out += String.fromCharCode(byte)
    }
    else if (0x20 === byte) {
      out += '+'
    }
    else {
      out += '%' + HEX[byte >> 4] + HEX[byte & 15]
    }
  }
  return out
}


function formValue(ctx: Context, name: string, value: any): Uint8Array | Error {
  const content = value instanceof BinarySource ? value.data : value
  if (isBlob(content) || isStream(content)) {
    return ctx.error('binary_source_refused', 'The form field "' + name +
      '" holds a Blob or a stream, which a form body cannot carry: pass its bytes.')
  }
  return isBytes(content) ? toBytes(content) : toBytes(itemText(content))
}


function encodeForm(ctx: Context, data: any, lifted: Record<string, any>):
  { type: string, body: string } | Error {
  const body = ctx.point?.body
  const pairs: string[] = []

  for (const item of bodyItems(body, data, lifted)) {
    const value = formValue(ctx, item.name, item.value)
    if (value instanceof Error) {
      return value
    }
    pairs.push(formEscape(toBytes(item.name)) + '=' + formEscape(value))
  }

  const media = 'string' === typeof body?.media && '' !== body.media ? body.media : FORM_MEDIA
  return { type: media, body: pairs.join('&') }
}


export {
  encodeForm,
  formEscape,
}
