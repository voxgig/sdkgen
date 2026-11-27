import type { Readable } from 'node:stream'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { ifRangeHolds, noneMatch, parseRange } from './content/conditional.js'
import type { Slot } from './store/SlotStore.js'

export interface DownloadOptions {
  ranges: boolean
  conditional: boolean
  disposition?: string
}

export interface Download {
  status: 200 | 206 | 304 | 416
  headers: Record<string, string>
  start: number
  end: number
  body: boolean
}

export interface DownloadEvent {
  request: FastifyRequest
  slot: Slot
  download: Download
  stream?: Readable
}

// The seam where a download can be altered before it is written, and a
// request answered before its route runs. Both are absent by default.
export interface Intercept {
  request?(request: FastifyRequest, reply: FastifyReply): Promise<boolean>
  download?(event: DownloadEvent): DownloadEvent | Promise<DownloadEvent>
}

function displayType(type: string): string {
  return type.startsWith('text/') ? `${type}; charset=utf-8` : type
}

export function planDownload(
  method: string,
  headers: Record<string, string | string[] | undefined>,
  slot: Slot,
  options: DownloadOptions,
): Download {
  const { info } = slot
  const one = (name: string) => {
    const v = headers[name]
    return Array.isArray(v) ? v.join(', ') : v
  }
  const isGet = 'GET' === method

  const base: Record<string, string> = { etag: info.etag }
  const full: Record<string, string> = {
    ...base,
    'content-type': displayType(info.type),
    'repr-digest': info.digest,
  }
  if (options.ranges) full['accept-ranges'] = 'bytes'
  if (options.disposition) full['content-disposition'] = options.disposition

  if (options.conditional && noneMatch(one('if-none-match'), info.etag)) {
    return { status: 304, headers: base, start: 0, end: 0, body: false }
  }

  if (options.ranges && isGet && ifRangeHolds(one('if-range'), info.etag)) {
    const range = parseRange(one('range'), info.size)
    if ('unsatisfiable' === range.kind) {
      return {
        status: 416,
        headers: { 'content-range': `bytes */${info.size}` },
        start: 0,
        end: 0,
        body: false,
      }
    }
    if ('range' === range.kind) {
      const end = range.end + 1
      return {
        status: 206,
        headers: {
          ...full,
          'content-range': `bytes ${range.start}-${range.end}/${info.size}`,
          'content-length': String(end - range.start),
        },
        start: range.start,
        end,
        body: true,
      }
    }
  }

  return {
    status: 200,
    headers: { ...full, 'content-length': String(info.size) },
    start: 0,
    end: info.size,
    body: isGet,
  }
}

export async function sendDownload(
  request: FastifyRequest,
  reply: FastifyReply,
  slot: Slot,
  options: DownloadOptions,
  intercept: Intercept,
): Promise<FastifyReply> {
  const download = planDownload(request.method, request.headers, slot, options)
  let event: DownloadEvent = {
    request,
    slot,
    download,
    stream: download.body ? slot.content.read(download.start, download.end) : undefined,
  }
  if (intercept.download) event = await intercept.download(event)

  const { status, headers } = event.download
  if (416 === status) {
    reply.code(416).headers(headers)
    return reply.send({ error: 'RangeNotSatisfiable', message: headers['content-range'] })
  }
  reply.code(status).headers(headers)
  return event.stream ? reply.send(event.stream) : reply.send()
}
