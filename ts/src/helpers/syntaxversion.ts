import { SdkGenError } from '../utility'


// The interface a syntax provider is written against, declared by the
// provider as `interface`. Raised on every breaking change to it.
const SYNTAX_INTERFACE = '3.3' as const


// What each raise asks of a provider written for the version before it.
const SYNTAX_CHANGES: { to: string, change: string }[] = [
  { to: '3.3', change: 'ref.read(value, key, truth?): a read used as a condition is called with truth = true, and prints the test the language branches on' },
  { to: '3.3', change: "ref.facts.testMock is required: 'generated' or 'always'" },
  { to: '3.3', change: 'ref.facts.streamSignal: without it, no sentence says a stream ends on callopts.signal' },
  { to: '3.3', change: 'the wrapped result style: facts.record is the plain accessor, and facts.unwrap the step before it' },
  { to: '3.3', change: "the utility getter's sentence follows Member.copy: without copy: true it says the getter returns the object itself" },
]


const num = (v: string) => v.split('.').map(Number)
const before = (a: string, b: string) => {
  const [x, y] = [num(a), num(b)]
  return x[0] < y[0] || (x[0] === y[0] && (x[1] ?? 0) < (y[1] ?? 0))
}


function checkSyntaxInterface(target: string, declared: unknown): void {
  if (SYNTAX_INTERFACE === declared) {
    return
  }

  const from = 'string' === typeof declared ? declared : undefined
  const changes = SYNTAX_CHANGES.filter((c) => null == from || before(from, c.to))
  const file = `.sdk/src/cmp/${target}/Syntax_${target}.ts`

  throw new SdkGenError(target + ': the syntax provider ' + file + ' is written for ' +
    (null == from ? 'an interface before ' + SYNTAX_CHANGES[0].to + ' (it declares none)' :
      'interface ' + from) +
    ', and this sdkgen calls interface ' + SYNTAX_INTERFACE + '. ' +
    'An unchanged copy from a package is refreshed by `voxgig-sdkgen package update` ' +
    '(doctor lists it as OUTDATED). Otherwise, ' +
    (0 === changes.length ? '' :
      'check each change, then declare interface: \'' + SYNTAX_INTERFACE + '\':\n' +
      changes.map((c) => '  - ' + c.to + ': ' + c.change).join('\n')))
}


export {
  SYNTAX_INTERFACE,
  SYNTAX_CHANGES,
  checkSyntaxInterface,
}
