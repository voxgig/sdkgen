import { test, describe } from 'node:test'
import { rejects, doesNotReject } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


function loadTs(rel: string): any {
  const file = Path.join(TM, rel)
  const js = transform(readFileSync(file, 'utf8'), {
    transforms: ['typescript', 'imports'],
    filePath: file,
  }).code
  const mod: any = { exports: {} }
  new Function('exports', 'require', 'module', js)(mod.exports, require, mod)
  return mod.exports
}


// A client whose one operation sends the headers given, as the generated
// client sends what prepareHeaders built.
function fakeSdk(headers: Record<string, string>) {
  return class FakeSDK {
    fetch: any
    constructor(options: any) {
      this.fetch = options.system.fetch
    }
    thing() {
      const fetch = this.fetch
      return {
        list: async (_input: any) => {
          await fetch('http://definition.test/things', { method: 'GET', headers })
          return []
        },
      }
    }
  }
}


function point(headers: any[], cookies: any[]) {
  return {
    entity: 'thing', accessor: 'thing', op: 'list', method: 'GET', path: '/things',
    args: [], select: {}, headers, cookies, query: [], queryArgs: [], auth: null,
    status: 200, sample: null, idField: 'id',
  }
}


describe('definition runner', () => {

  const impls: Record<string, any> = {
    ts: loadTs('ts/test/definition-runner.ts').runDefinitionPoint,
    js: require(Path.join(TM, 'js', 'test', 'definition-runner.js')).runDefinitionPoint,
  }

  for (const [lang, run] of Object.entries(impls)) {
    // A header parameter named Cookie shares its header with the cookie
    // parameters, so its value is checked as pieces of what was sent.
    test(lang + ': a Cookie header argument is checked as pieces beside the cookie arguments', async () => {
      const cookieHeader = [{ name: 'cookie', wire: 'Cookie', value: 'raw=one' }]
      const theme = [{ name: 'theme', wire: 'theme', value: 'dark' }]
      await doesNotReject(run(fakeSdk({ cookie: 'raw=one; theme=dark' }), point(cookieHeader, theme)))
      await rejects(run(fakeSdk({ cookie: 'theme=dark' }), point(cookieHeader, theme)))
    })

    test(lang + ': any other header argument is checked exactly', async () => {
      const trace = [{ name: 'x_trace', wire: 'X-Trace', value: 't1' }]
      await doesNotReject(run(fakeSdk({ 'x-trace': 't1' }), point(trace, [])))
      await rejects(run(fakeSdk({ 'x-trace': 't1; t2' }), point(trace, [])))
    })
  }
})
