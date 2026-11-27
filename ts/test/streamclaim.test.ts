import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import Fs from 'node:fs'
import Path from 'node:path'


// stream() yields what an operation returns and sends no body of its own.
// Every target once attached a caller's `body` to the request under these
// names, and nothing in any target read it.

const SDK = Path.resolve(__dirname, '..', 'project', '.sdk')

const VENDORED = /[\\/](struct|voxgigstruct|voxgig_struct|sekreto|plugins|node_modules)[\\/]/

const CLAIM = /body\$|stream[_-]?out/i


function files(dir: string): string[] {
  return Fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = Path.join(dir, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  })
}


describe('stream() claims no upload', () => {

  for (const tree of ['src/cmp', 'tm']) {
    test(tree + ': nothing attaches a body to a stream call', () => {
      const found: string[] = []
      for (const file of files(Path.join(SDK, tree))) {
        if (VENDORED.test(file)) continue
        const lines = Fs.readFileSync(file, 'utf8').split('\n')
        lines.forEach((line, n) => {
          if (CLAIM.test(line)) {
            found.push(Path.relative(SDK, file) + ':' + (n + 1))
          }
        })
      }
      assert.deepEqual(found, [])
    })
  }
})
