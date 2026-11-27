import { test, describe, before, after } from 'node:test'
import { ok, deepStrictEqual, strictEqual } from 'node:assert'

import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import { ProjectNameSDK } from '..'


// Every form, multipart and raw point this SDK has, driven through a real
// entity operation against a local listener that decodes what arrives. The
// cases come from the client's own config, so no case names an entity.

type Answer = { status?: number, type?: string, body?: Buffer | string }

type Arrived = { method: string, url: string, headers: Record<string, any>, body: Buffer }

type CodecCase = {
  name: string
  run: (client: any, net: Net) => Promise<void>
}

type Net = {
  answer: (answer: Answer) => void
  arrived: () => Arrived
}


const PROBE: any = new (ProjectNameSDK as any)({ base: 'http://127.0.0.1:1' })
const CONFIG: any = PROBE._rootctx.config


function accessors(client: any): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of Object.getOwnPropertyNames(Object.getPrototypeOf(client))) {
    if (!/^[A-Z]/.test(m) || 'function' !== typeof client[m]) continue
    let inst: any
    try { inst = client[m]() } catch (e) { continue }
    if (null != inst && 'string' === typeof inst.name && null != CONFIG.entity[inst.name]) {
      out[inst.name] = m
    }
  }
  return out
}


// A value for each path parameter a point names.
function params(point: any): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of point.parts || []) {
    const m = /^\{(.+)\}$/.exec(String(part))
    if (null != m) out[m[1]] = 'p1'
  }
  return out
}


function select(point: any): Record<string, any> {
  return null == point.select?.$action ? {} : { $action: point.select.$action }
}


function content(name: string): Buffer {
  return Buffer.from('file:' + name + '\u0000ÿ\r\n--', 'latin1')
}


type Expect = { name: string, value?: string, file?: Buffer, filename?: string, type?: string }


// The data a form or multipart point is sent, and the parts it must arrive as.
function plan(client: any, body: any): { data: Record<string, any>, expect: Expect[] } {
  const data: Record<string, any> = {}
  const expect: Expect[] = []
  for (const field of body.fields || []) {
    const name = field.name
    if (true === field.binary) {
      const type = 'form' === body.kind ? undefined : field.media || 'application/octet-stream'
      data[name] = client.binary.bytes(new Uint8Array(content(name)),
        { name: '/local/dir/' + name + '.bin', type })
      expect.push('form' === body.kind ? { name, value: content(name).toString('latin1') } :
        { name, file: content(name), filename: name + '.bin', type })
    }
    else if (true === field.list) {
      data[name] = ['a', 'b c']
      expect.push({ name, value: 'a' }, { name, value: 'b c' })
    }
    else if ('string' === typeof field.join) {
      data[name] = ['a', 'b']
      expect.push({ name, value: 'a' + field.join + 'b' })
    }
    else {
      data[name] = 'v"' + name + '\r\n'
      expect.push({ name, value: 'v"' + name + '\r\n' })
    }
  }
  return { data, expect }
}


function multipart(arrived: Arrived): Expect[] {
  const type = String(arrived.headers['content-type'] || '')
  const boundary = /boundary=([^;]+)/.exec(type)?.[1]
  ok(null != boundary, 'no boundary in ' + type)
  const text = arrived.body.toString('latin1')
  ok(text.endsWith('--' + boundary + '--\r\n'), 'the body does not close')
  const parts: Expect[] = []
  for (const chunk of text.split('--' + boundary).slice(1, -1)) {
    const at = chunk.indexOf('\r\n\r\n')
    const head = chunk.slice(2, at)
    const body = chunk.slice(at + 4, -2)
    const disp = /^Content-Disposition: form-data; name="([^"]*)"(?:; filename="([^"]*)")?$/m.exec(head)
    ok(null != disp, 'a part without a disposition: ' + JSON.stringify(head))
    const ctype = /^Content-Type: (.*)$/m.exec(head)?.[1]
    parts.push(null == disp![2] ? { name: disp![1], value: body } :
      { name: disp![1], file: Buffer.from(body, 'latin1'), filename: disp![2], type: ctype })
  }
  return parts
}


function decoded(parts: Expect[]): any[] {
  return parts.map((p) => null == p.file ? { name: p.name, value: p.value } :
    { name: p.name, file: p.file.toString('latin1'), filename: p.filename, type: p.type })
}


function cases(): CodecCase[] {
  const out: CodecCase[] = []
  const acc = accessors(PROBE)

  for (const ename of Object.keys(CONFIG.entity).sort()) {
    const accessor = acc[ename]
    if (null == accessor) continue
    const ops = CONFIG.entity[ename].op || {}

    for (const opname of Object.keys(ops).sort()) {
      for (const point of ops[opname].points || []) {
        const label = ename + '.' + opname + (null == point.select?.$action ? '' :
          ':' + point.select.$action)
        const rb = point.body
        const rs = point.response

        if (('form' === rb?.kind || 'multipart' === rb?.kind) &&
          ['create', 'update', 'patch'].includes(opname)) {
          out.push({
            name: label + ' sends a ' + rb.kind + ' body',
            run: async (client, net) => {
              const { data, expect } = plan(client, rb)
              net.answer({ type: 'application/json', body: JSON.stringify({ id: 'p1' }) })
              await client[accessor]()[opname]({ ...params(point), ...select(point), ...data })
              const arrived = net.arrived()
              if ('form' === rb.kind) {
                strictEqual(arrived.headers['content-type'], rb.media)
                const got = [...new URLSearchParams(arrived.body.toString('latin1'))]
                  .map(([name, value]) => ({ name, value }))
                deepStrictEqual(got.filter((g) => expect.some((e) => e.name === g.name)),
                  expect.map((e) => ({ name: e.name, value: Buffer.from(e.value!, 'latin1')
                    .toString('utf8') })))
              }
              else {
                deepStrictEqual(decoded(multipart(arrived))
                  .filter((g) => expect.some((e) => e.name === g.name)), decoded(expect))
              }
            },
          })
        }

        if ('raw' === rb?.kind && ['create', 'update', 'patch'].includes(opname)) {
          out.push({
            name: label + ' sends a raw ' + (true === rb.binary ? 'binary' : 'text') + ' body',
            run: async (client, net) => {
              net.answer({ type: 'application/json', body: JSON.stringify({ id: 'p1' }) })
              const ent = client[accessor]()
              ent.data(params(point))
              ent.match(params(point))
              if (true === rb.binary) {
                const slot = point.select?.$action
                const got = await ent.binary(slot).put(client.binary.bytes(
                  new Uint8Array(content(label)), { type: rb.media }))
                strictEqual(got, ent)
                deepStrictEqual(net.arrived().body, content(label))
              }
              else {
                await ent[opname]({ ...select(point), $body: 'text "' + label + '"\n' })
                strictEqual(net.arrived().body.toString('utf8'), 'text "' + label + '"\n')
              }
              strictEqual(net.arrived().headers['content-type'], rb.media)
            },
          })
        }

        if ('raw' === rs?.kind && 'load' === opname) {
          out.push({
            name: label + ' reads a raw ' + (true === rs.binary ? 'binary' : 'text') + ' body',
            run: async (client, net) => {
              const ent = client[accessor]()
              ent.data(params(point))
              ent.match(params(point))
              if (true === rs.binary) {
                net.answer({ type: rs.media, body: content(label) })
                const bytes = await ent.binary(point.select?.$action).bytes()
                deepStrictEqual(Buffer.from(bytes), content(label))
                let refused: any
                try { await ent.load({ ...params(point), ...select(point) }) }
                catch (err) { refused = err }
                strictEqual(refused?.code, 'binary_sink_required')
              }
              else {
                net.answer({ type: rs.media, body: 'café ' + label })
                const got = await ent.load({ ...params(point), ...select(point) })
                strictEqual(got, ent)
                strictEqual(ent.data().$body, 'café ' + label)
              }
            },
          })
        }
      }
    }
  }
  return out
}


describe('codec', () => {
  const CASES = cases()
  let server: any
  let base = ''
  let answer: Answer = {}
  const arrivals: Arrived[] = []
  let ran = 0
  let failed = 0

  const net: Net = {
    answer: (a) => { answer = a },
    arrived: () => {
      ok(0 < arrivals.length, 'nothing arrived')
      return arrivals[arrivals.length - 1]
    },
  }

  before(async () => {
    server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => {
        arrivals.push({ method: String(req.method), url: String(req.url), headers: req.headers,
          body: Buffer.concat(chunks) })
        const body = null == answer.body ? '' : answer.body
        res.writeHead(answer.status || 200, {
          'content-type': answer.type || 'application/json',
          'content-length': Buffer.byteLength(body),
        })
        res.end(body)
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
  })

  after(async () => {
    console.log('codec: ran ' + ran + ' case(s), ' + failed + ' failed')
    await new Promise((resolve) => server.close(resolve))
  })

  test('this SDK has a point to drive', () => {
    ok(0 < CASES.length, 'no form, multipart or raw point was found')
  })

  for (const kase of CASES) {
    test(kase.name, async () => {
      ran++
      arrivals.length = 0
      answer = {}
      try {
        await kase.run(new (ProjectNameSDK as any)({ base }), net)
      }
      catch (err) {
        failed++
        throw err
      }
    })
  }
})
