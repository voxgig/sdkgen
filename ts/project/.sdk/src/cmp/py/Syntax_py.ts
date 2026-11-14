// Stand-in syntax provider: how py writes things, never what the SDK has.
const Syntax = {
  lang: 'py',
  call: (obj: string, method: string, args: string) => obj + '.' + method + '(' + args + ')',
}

export { Syntax }
