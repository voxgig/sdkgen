import { strictEqual } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const DEF_PATH = resolve(appRoot, 'def/podcastdemo-1.0.0-openapi-3.0.0.yaml')
const DESIGN_PATH = resolve(appRoot, '../../../../docs/design/file-transfer-demo-def.yaml')

// The design copy exists only inside the sdkgen repository.
test('the design copy of the definition is the served one', (t) => {
  if (!existsSync(DESIGN_PATH)) {
    t.skip(`no design copy at ${DESIGN_PATH}`)
    return
  }
  strictEqual(readFileSync(DESIGN_PATH, 'utf-8'), readFileSync(DEF_PATH, 'utf-8'))
})
