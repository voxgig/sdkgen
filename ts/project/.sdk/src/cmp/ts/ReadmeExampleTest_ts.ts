
import { cmp, Content, File, fact } from '@voxgig/sdkgen'


const ReadmeExampleTest = cmp(function ReadmeExampleTest(props: any) {
  const { target, ctx$: { model } } = props
  const Name = model.const.Name

  // The root README's quick start where the run writes one for this target,
  // else the tutorial in the target's own README.
  const root = fact(target, 'link').readme
  if ('' === root && !fact(target, 'phase').readme) {
    return
  }
  const readme = '' === root ? 'README.md' : root
  const section = '' === root ? 'Tutorial: your first API call' : 'Quickstart'

  File({ name: 'ReadmeExample.test.ts' }, () => {
    Content(`// Verifies the README's lead-language quickstart still runs.

import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as Fs from 'node:fs'
import * as Path from 'node:path'

import { ${Name}SDK } from '..'


function findFirstTsBlock(md: string, sectionHeading: string): string | null {
  const escapedHeading = sectionHeading.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')
  const re = new RegExp('##\\\\s+' + escapedHeading + '[\\\\s\\\\S]*?\`\`\`ts\\\\n([\\\\s\\\\S]*?)\`\`\`')
  const m = md.match(re)
  return m ? m[1] : null
}


function transformForTestMode(code: string, name: string): string {
  // Strip import lines — symbols come from the test's outer scope.
  const src = code.replace(/^\\s*import\\s+[^;\\n]+;?\\s*$/gm, '')
  // Swap real client construction for test mode (no network, no auth), reading
  // the arguments to the parenthesis that balances the opening one.
  const head = new RegExp('new\\\\s+' + name + 'SDK\\\\(', 'g')
  let out = ''
  let at = 0
  let m: RegExpExecArray | null
  while (null != (m = head.exec(src))) {
    let depth = 0
    let end = m.index + m[0].length - 1
    for (; end < src.length; end++) {
      if ('(' === src[end]) depth++
      else if (')' === src[end] && 0 === --depth) break
    }
    if (end === src.length) break
    out += src.slice(at, m.index) + name + 'SDK.test()'
    at = head.lastIndex = end + 1
  }
  return out + src.slice(at)
}


describe('README example', () => {
  it('lead-language quickstart runs in test mode', async () => {
    const readmePath = Path.join(__dirname, '..', '${readme}')
    const md = Fs.readFileSync(readmePath, 'utf8')

    const block = findFirstTsBlock(md, '${section}')
    assert(block, 'No TypeScript code block found under "## ${section}" in ${readme}')

    const code = transformForTestMode(block, '${Name}')

    // Run the (transformed) example. Async, so wrap in AsyncFunction.
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const silentConsole = { log: () => {}, error: () => {}, warn: () => {} }
    const runner = new AsyncFunction('${Name}SDK', 'console', code)

    // The example should at least parse and have a valid call shape
    // (every method exists on the SDK and accepts the args shown). A
    // "Not found" / 404 from test mode means the SDK accepted the call
    // but there's no fixture for that match — that's a test-data gap,
    // not a README bug, so it's OK. Everything else (TypeError,
    // ReferenceError, SyntaxError) means the README example is out of
    // sync with the real SDK API and the test should fail.
    try {
      await runner(${Name}SDK, silentConsole)
    } catch (err: any) {
      const msg = String(err?.message ?? err)
      if (/\\b(404|Not found)\\b/i.test(msg)) return
      throw err
    }
  })
})
`)
  })
})


export {
  ReadmeExampleTest
}
