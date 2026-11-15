import { SdkGenError } from '../utility'
import { componentSource } from './cmpfile'


// The interface a syntax provider is written against, declared by the
// provider as `interface`. Raised on every breaking change to it.
const SYNTAX_INTERFACE = '3.3' as const

// The one earlier interface the shared code still serves, with a warning. A
// provider that declares nothing is taken as written for it. At the next raise
// this moves up and its handling is deleted: a provider gets one raise.
const SYNTAX_PREVIOUS = '3.2' as const


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


// The interface the shared code serves this provider at: the current one, or
// the previous one with a warning naming each change. Anything else is refused.
function servedInterface(target: string, declared: unknown, log?: any): string {
  if (SYNTAX_INTERFACE === declared) {
    return SYNTAX_INTERFACE
  }

  if (null == declared || SYNTAX_PREVIOUS === declared) {
    log?.warn?.({
      point: 'syntax-interface-previous', target, declared: declared ?? null,
      note: target + ': the syntax provider .sdk/' + componentSource(target, 'Syntax') +
        ' is written for interface ' + SYNTAX_PREVIOUS + (null == declared ? ' (it declares none)' : '') +
        ', which this sdkgen still serves until its next interface raise. Its pages leave out ' +
        'what these facts would say until the provider declares them and interface: \'' +
        SYNTAX_INTERFACE + '\':\n' + SYNTAX_CHANGES.filter((c) => SYNTAX_INTERFACE === c.to)
        .map((c) => '  - ' + c.change).join('\n'),
    })
    return SYNTAX_PREVIOUS
  }

  return checkSyntaxInterface(target, declared)
}


// A provider is marked with the interface it is served at; the shared code
// reads `facts.served` where the previous interface printed otherwise.
const served = new WeakMap<object, any>()

function serveSyntax(target: string, module: any, log?: any): any {
  const syntax = module?.Syntax
  if (null == syntax || 'object' !== typeof syntax) {
    return module
  }
  if (!served.has(module)) {
    const at = servedInterface(target, syntax.interface, log)
    served.set(module, SYNTAX_INTERFACE === at ? module :
      { ...module, Syntax: { ...syntax, facts: { ...syntax.facts, served: at } } })
  }
  return served.get(module)
}


function checkSyntaxInterface(target: string, declared: unknown): never | string {
  if (SYNTAX_INTERFACE === declared) {
    return SYNTAX_INTERFACE
  }

  const from = 'string' === typeof declared ? declared : undefined
  const changes = SYNTAX_CHANGES.filter((c) => null == from || before(from, c.to))
  const file = '.sdk/' + componentSource(target, 'Syntax')

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


// The declaration as a provider's source writes it. The constant is not
// exported, so a literal is the only declaration that compiles, and this
// reads the same value the loaded provider carries.
function declaredInterface(src: string): string | undefined {
  return src.match(/^\s*interface:\s*['"]([^'"]+)['"]/m)?.[1]
}


export {
  SYNTAX_INTERFACE,
  SYNTAX_PREVIOUS,
  servedInterface,
  serveSyntax,
  declaredInterface,
  SYNTAX_CHANGES,
  checkSyntaxInterface,
}
