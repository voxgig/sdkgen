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
