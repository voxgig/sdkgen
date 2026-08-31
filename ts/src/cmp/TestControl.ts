import Path from 'node:path'

import {
  cmp,
  File,
  Fragment,
} from 'jostraca'


const TEST_CONTROL_FILE = 'sdk-test-control.json'


// Keep the blanket per-target `Copy({ from: 'tm/<lang>' })` from restoring the
// template default over a project's edited control file. One regex for every
// target: the file sits under `test/`, `t/`, `tests/` or `sdktest/` depending
// on the language, and the name is what identifies it either way.
const TEST_CONTROL_EXCLUDE = new RegExp('(^|/)' + TEST_CONTROL_FILE + '$')


// `sdk-test-control.json` is the ONE generated file a project is meant to edit
// by hand: it names the tests to skip, the live pacing, and the extra client
// options a live run needs (`test.client.options`).
//
// It shipped as part of each target's blanket `Copy({ from: 'tm/<lang>' })`,
// and a Copy has no per-file "leave it alone if it already exists" — so every
// `npm run generate` overwrote whatever the project had put there. The
// documented workaround, editing the template master under `.sdk/tm/`, is
// worse: `doctor` reports it as drift and the next `target add <lang>` reverts
// it.
//
// So it is emitted HERE instead, write-once: `File({ exclude: true })` returns
// early when the file already exists (FileOp), which is exactly the semantics
// the file is documented to have. A project without one yet gets the
// template's default; a project that has edited one keeps its edits across
// both `generate` and `target add`.
//
// The content still comes from the target's own template, so there remains
// exactly one copy of the default on disk.
//
// The template is addressed the SAME way the Copy this replaces addressed it:
// `tm/<lang>/...` relative to the working directory, which is the project's
// `.sdk`. Resolved to absolute here because Fragment resolves a RELATIVE
// `from` against the OUTPUT folder instead — a different base, and the one
// place these two could silently disagree.
const TestControl = cmp(function TestControl(props: {
  target: { name: string }
  dir: string
  ctx$?: any
}) {
  const { target, dir } = props

  File({ name: TEST_CONTROL_FILE, exclude: true }, () => {
    Fragment({
      from: Path.resolve('tm', target.name, dir, TEST_CONTROL_FILE)
    })
  })
})


export {
  TestControl,
  TEST_CONTROL_FILE,
  TEST_CONTROL_EXCLUDE,
}
