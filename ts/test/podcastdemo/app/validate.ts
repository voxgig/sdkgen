#!/usr/bin/env node
// Every operation and declared status is provoked; each answer must use a
// declared status, media type and header set, with JSON fitting its schema.
// `--serve` starts a server of its own on an ephemeral port; otherwise the
// target is PODCASTDEMO_URL, or HOST and PORT.

import { readFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { type Config, loadConfig } from './src/config.js'
import { buildApp } from './src/server.js'

const here = dirname(fileURLToPath(import.meta.url))
const def = parse(readFileSync(resolve(here, 'def/podcastdemo-1.0.0-openapi-3.0.0.yaml'), 'utf-8'))

const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head']
const SERVE_LIMITS = { audio: 4096, artwork: 4096, transcript: 1024, sessions: 3 }

function deref(node: any): any {
  if (node && 'string' === typeof node.$ref) {
    const path = node.$ref.replace(/^#\//, '').split('/')
    return deref(path.reduce((at: any, key: string) => at?.[key], def))
  }
  return node
}

const declared = new Map<string, Set<string>>()
for (const [path, item] of Object.entries<any>(def.paths)) {
  for (const method of METHODS) {
    if (item[method]) {
      declared.set(`${method.toUpperCase()} ${path}`, new Set(Object.keys(item[method].responses)))
    }
  }
}

function schemaErrors(schema: any, value: any, at = '$'): string[] {
  schema = deref(schema)
  if (!schema) return []
  if (schema.allOf) return schema.allOf.flatMap((s: any) => schemaErrors(s, value, at))
  if (schema.enum && !schema.enum.includes(value)) return [`${at} is not one of ${schema.enum}`]
  switch (schema.type) {
    case 'object': {
      if (null == value || 'object' !== typeof value || Array.isArray(value)) return [`${at} is not an object`]
      const errors = (schema.required ?? [])
        .filter((k: string) => !(k in value))
        .map((k: string) => `${at}.${k} is missing`)
      for (const [k, s] of Object.entries<any>(schema.properties ?? {})) {
        if (k in value) errors.push(...schemaErrors(s, value[k], `${at}.${k}`))
      }
      return errors
    }
    case 'array':
      return Array.isArray(value)
        ? value.flatMap((v, i) => schemaErrors(schema.items, v, `${at}[${i}]`))
        : [`${at} is not an array`]
    case 'integer':
      return Number.isInteger(value) ? [] : [`${at} is not an integer`]
    case 'boolean':
      return 'boolean' === typeof value ? [] : [`${at} is not a boolean`]
    case 'string':
      return 'string' === typeof value ? [] : [`${at} is not a string`]
    default:
      return []
  }
}

interface Call {
  op: string
  params?: Record<string, string>
  headers?: Record<string, string>
  body?: BodyInit | Buffer
  auth?: false
}

let base = ''
let token = ''
let limits: Config['limits']
const seen = new Map<string, Set<string>>()
const failures: string[] = []
let checks = 0

// A server refusing an oversized body may close the socket while the body is
// still being written, so a transport failure is tried again.
async function fetchRetrying(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, init)
    } catch (err) {
      if (3 <= attempt) throw err
    }
  }
}

async function call(c: Call, expect: number): Promise<Response> {
  const [method, template] = c.op.split(' ')
  if (!declared.has(c.op)) throw new Error(`Not a declared operation: ${c.op}`)
  const path = template.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(c.params?.[k] ?? 'missing'))
  const headers: Record<string, string> = { ...c.headers }
  if (false !== c.auth) headers.authorization = `Bearer ${token}`
  const body = Buffer.isBuffer(c.body) ? new Uint8Array(c.body) : c.body
  const res = await fetchRetrying(base + path, { method, headers, body })
  const raw = Buffer.from(await res.arrayBuffer())
  const status = String(res.status)
  const problems: string[] = []
  checks++

  if (res.status !== expect) problems.push(`status ${status}, wanted ${expect}`)
  const response = deref(def.paths[template][method.toLowerCase()].responses[status])
  if (!response) {
    problems.push(`status ${status} is not declared`)
  } else {
    if (!seen.has(c.op)) seen.set(c.op, new Set())
    seen.get(c.op)!.add(status)
    for (const name of Object.keys(response.headers ?? {})) {
      if (!res.headers.has(name)) problems.push(`declared header ${name} is absent`)
    }
    const media = Object.keys(response.content ?? {})
    const type = res.headers.get('content-type')?.split(';')[0].trim()
    if ('HEAD' === method || 0 === media.length) {
      if (0 < raw.length) problems.push(`a body of ${raw.length} bytes where none is declared`)
    } else if (!type || !media.includes(type)) {
      problems.push(`media type ${type} is not one of ${media.join(', ')}`)
    } else if ('application/json' === type) {
      problems.push(...schemaErrors(response.content[type].schema, JSON.parse(raw.toString())))
    }
  }

  const line = `${c.op} -> ${status}`
  if (0 === problems.length) {
    console.log(`  ok    ${line}`)
  } else {
    console.log(`  FAIL  ${line}: ${problems.join('; ')}`)
    failures.push(`${line}: ${problems.join('; ')}`)
  }
  return new Response(0 < raw.length && ![204, 304].includes(res.status) ? raw : null, {
    status: res.status,
    headers: res.headers,
  })
}

const json = (value: unknown) => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
})
const typed = (type: string, body: Buffer, extra: Record<string, string> = {}) => ({
  headers: { 'content-type': type, ...extra },
  body,
})
const TUS = { 'tus-resumable': '1.0.0' }
const OFFSET = 'application/offset+octet-stream'
const reprOf = async (bytes: Buffer) =>
  `sha-256=:${Buffer.from(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))).toString('base64')}:`

function form(parts: { title?: string; audio?: Buffer; type?: string }) {
  const f = new FormData()
  if (undefined !== parts.title) f.set('title', parts.title)
  if (parts.audio) {
    f.set('audio', new Blob([new Uint8Array(parts.audio)], { type: parts.type ?? 'audio/wav' }), 'a.wav')
  }
  return f
}

async function scenarios() {
  const S = 'studio'
  const E = 'pilot'
  const showOp = (m: string, rest = '') => `${m} /api/show/{show_id}${rest}`
  const epOp = (m: string, rest = '') => `${m} /api/show/{show_id}/episode/{episode_id}${rest}`
  const ids = { show_id: S, episode_id: E }

  console.log('\nshows')
  await call({ op: 'GET /api/show' }, 200)
  const made = await (await call({ op: 'POST /api/show', ...json({ name: 'V', author: 'W' }) }, 201)).json()
  await call({ op: 'POST /api/show', ...json({ name: 'V' }) }, 400)
  const mine = { show_id: made.id }
  await call({ op: showOp('GET'), params: mine }, 200)
  await call({ op: showOp('PUT'), params: mine, ...json({ name: 'V2' }) }, 200)
  await call({ op: showOp('PUT'), params: mine, ...json({ name: '' }) }, 400)

  console.log('\nartwork and feed')
  const art = await call({ op: showOp('GET', '/artwork'), params: ids }, 200)
  await call({ op: showOp('GET', '/artwork'), params: ids, headers: { 'if-none-match': art.headers.get('etag')! } }, 304)
  const png = Buffer.from(await art.arrayBuffer())
  await call({ op: showOp('PUT', '/artwork'), params: mine, ...typed('image/png', png) }, 200)
  await call({ op: showOp('PUT', '/artwork'), params: mine, ...typed('image/png', png, { 'if-match': '"stale"' }) }, 412)
  await call({ op: showOp('PUT', '/artwork'), params: mine, ...typed('image/png', Buffer.alloc(limits.artwork + 1)) }, 413)
  await call({ op: showOp('PUT', '/artwork'), params: mine, ...typed('audio/wav', png) }, 415)
  await call({ op: showOp('GET', '/feed'), params: ids }, 200)

  console.log('\nepisodes')
  await call({ op: showOp('GET', '/episode'), params: ids }, 200)
  const wav = Buffer.alloc(Math.min(1024, limits.audio), 1)
  const ep = await (
    await call({ op: showOp('POST', '/episode'), params: mine, body: form({ title: 'E', audio: wav }) }, 201)
  ).json()
  await call({ op: showOp('POST', '/episode'), params: mine, body: form({ title: 'E' }) }, 400)
  await call({ op: showOp('POST', '/episode'), params: mine, body: form({ title: 'E', audio: wav, type: 'image/png' }) }, 415)
  await call(
    { op: showOp('POST', '/episode'), params: mine, body: form({ title: 'E', audio: Buffer.alloc(limits.audio + 1) }) },
    413,
  )
  const epIds = { show_id: made.id, episode_id: ep.id }
  await call({ op: epOp('GET'), params: epIds }, 200)
  await call({ op: epOp('PUT'), params: epIds, ...json({ title: 'E2' }) }, 200)
  await call({ op: epOp('PUT'), params: epIds, ...json({ show_id: 'other' }) }, 400)
  await call({ op: epOp('POST', '/publish'), params: epIds, ...json({ publish: true }) }, 200)
  await call({ op: epOp('POST', '/publish'), params: epIds, ...json({}) }, 400)

  console.log('\naudio')
  const audio = await call({ op: epOp('GET', '/audio'), params: ids }, 200)
  const etag = audio.headers.get('etag')!
  await call({ op: epOp('GET', '/audio'), params: ids, headers: { range: 'bytes=0-99' } }, 206)
  await call({ op: epOp('GET', '/audio'), params: ids, headers: { 'if-none-match': etag } }, 304)
  await call({ op: epOp('GET', '/audio'), params: ids, headers: { range: 'bytes=999999999-' } }, 416)
  await call({ op: epOp('HEAD', '/audio'), params: ids }, 200)
  await call({ op: epOp('HEAD', '/audio'), params: ids, headers: { 'if-none-match': etag } }, 304)
  await call({ op: epOp('PUT', '/audio'), params: epIds, ...typed('audio/wav', wav, { 'repr-digest': await reprOf(wav) }) }, 200)
  await call({ op: epOp('PUT', '/audio'), params: epIds, ...typed('audio/wav', wav, { 'repr-digest': 'sha-256=:AAAA:' }) }, 400)
  await call({ op: epOp('PUT', '/audio'), params: epIds, ...typed('audio/wav', wav, { 'if-match': '"stale"' }) }, 412)
  await call({ op: epOp('PUT', '/audio'), params: epIds, ...typed('audio/wav', Buffer.alloc(limits.audio + 1)) }, 413)
  await call({ op: epOp('PUT', '/audio'), params: epIds, ...typed('image/png', wav) }, 415)

  console.log('\ntranscript')
  await call({ op: epOp('GET', '/transcript'), params: ids }, 200)
  const vtt = Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\nHello\n')
  await call({ op: epOp('PUT', '/transcript'), params: epIds, ...typed('text/vtt', vtt) }, 200)
  await call({ op: epOp('PUT', '/transcript'), params: epIds, ...typed('text/vtt', Buffer.alloc(limits.transcript + 1, 65)) }, 413)
  await call({ op: epOp('PUT', '/transcript'), params: epIds, ...typed('text/plain', vtt) }, 415)

  console.log('\nupload sessions')
  const up = (body: Record<string, unknown>) => ({
    op: 'POST /api/upload',
    ...json({ show_id: made.id, episode_id: ep.id, ...body }),
  })
  const file = Buffer.alloc(Math.min(100, limits.audio), 2)
  const session = await (await call(up({ size: file.length, digest: await reprOf(file) }), 201)).json()
  await call(up({ size: 0 }), 400)
  await call(up({ size: limits.audio + 1 }), 413)
  await call({ ...up({ size: 1 }), ...json({ show_id: made.id, episode_id: 'missing', size: 1 }) }, 404)
  const sid = { upload_id: session.id }
  const item = (m: string) => `${m} /api/upload/{upload_id}`
  const patch = (offset: number, bytes: Buffer, extra: Record<string, string> = {}) => ({
    op: item('PATCH'),
    params: sid,
    ...typed(OFFSET, bytes, { ...TUS, 'upload-offset': String(offset), ...extra }),
  })
  await call({ op: item('GET'), params: sid }, 200)
  await call({ op: item('HEAD'), params: sid, headers: TUS }, 200)
  await call({ op: item('HEAD'), params: sid }, 412)
  await call(patch(0, file.subarray(0, 40)), 204)
  await call(patch(0, file.subarray(0, 40)), 409)
  await call(patch(40, file.subarray(40), { 'tus-resumable': '0.2.2' }), 412)
  await call(patch(40, file.subarray(40), { 'content-type': 'application/octet-stream' }), 415)
  await call(patch(40, Buffer.alloc(file.length)), 413)
  await call(patch(40, file.subarray(40), { 'upload-offset': 'x' }), 400)
  await call(patch(40, file.subarray(40)), 204)
  const extra: string[] = []
  for (;;) {
    const res = await fetch(`${base}/api/upload`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ show_id: made.id, episode_id: ep.id, size: 1 }),
    })
    if (201 !== res.status) break
    extra.push((await res.json()).id)
  }
  await call(up({ size: 1 }), 429)
  for (const id of [...extra, session.id]) await call({ op: item('DELETE'), params: { upload_id: id } }, 204)

  console.log('\nnot found and unauthorized, every operation')
  for (const op of declared.keys()) {
    const [method] = op.split(' ')
    const known = { ...ids, upload_id: 'missing' }
    const headers = op.endsWith('{upload_id}') && ['HEAD', 'PATCH'].includes(method) ? TUS : {}
    await call({ op, params: known, auth: false }, 401)
    if (declared.get(op)!.has('404')) {
      const missing: Record<string, string> = op.includes('{episode_id}')
        ? { ...ids, episode_id: 'missing' }
        : { show_id: 'missing', upload_id: 'missing' }
      const body =
        'PATCH' === method ? typed(OFFSET, Buffer.alloc(1), { 'upload-offset': '0', ...TUS })
        : op.endsWith('/artwork') && 'PUT' === method ? typed('image/png', png)
        : op.endsWith('/audio') && 'PUT' === method ? typed('audio/wav', wav)
        : op.endsWith('/transcript') && 'PUT' === method ? typed('text/vtt', vtt)
        : op.endsWith('/episode') && 'POST' === method ? { body: form({ title: 'E', audio: wav }) }
        : op.endsWith('/publish') ? json({ publish: true })
        : 'POST /api/upload' === op ? json({ show_id: 'missing', episode_id: 'missing', size: 1 })
        : ['PUT'].includes(method) ? json({ name: 'x', title: 'x' })
        : { headers }
      await call({ op, params: missing, ...body, headers: { ...headers, ...body.headers } }, 404)
    }
  }

  console.log('\ncleanup')
  await call({ op: epOp('DELETE'), params: epIds }, 204)
  await call({ op: showOp('DELETE'), params: mine }, 204)
}

async function main() {
  const serve = process.argv.includes('--serve')
  const config = loadConfig()
  token = config.token
  let close = async () => {}
  if (serve) {
    const app = await buildApp({ config: { limits: SERVE_LIMITS } })
    await app.fastify.listen({ host: '127.0.0.1', port: 0 })
    base = `http://127.0.0.1:${(app.fastify.server.address() as AddressInfo).port}`
    limits = app.ctx.config.limits
    close = () => app.fastify.close()
  } else {
    base = process.env.PODCASTDEMO_URL || `http://${config.host}:${config.port}`
    limits = config.limits
  }
  console.log(`Validating ${base} against the definition`)

  try {
    await scenarios()
  } catch (err) {
    failures.push(`aborted: ${err instanceof Error ? `${err.stack} ${String((err as any).cause ?? '')}` : String(err)}`)
  } finally {
    await close()
  }

  for (const [op, statuses] of declared) {
    for (const status of statuses) {
      if (!seen.get(op)?.has(status)) failures.push(`never provoked: ${op} -> ${status}`)
    }
  }
  const pairs = [...declared.values()].reduce((n, s) => n + s.size, 0)
  console.log(`\n${checks} checks, ${declared.size} operations, ${pairs} declared responses`)
  if (failures.length) {
    console.log(`${failures.length} failure(s):\n  ${failures.join('\n  ')}`)
    process.exit(1)
  }
  console.log('every declared operation, status, media type and header holds')
}

main()
