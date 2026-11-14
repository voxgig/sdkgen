// Stand-in syntax provider: how ts writes things, never what the SDK has.
const Syntax = {
  lang: 'ts',
  call: (obj: string, method: string, args: string) => obj + '.' + method + '(' + args + ')',
}

export { Syntax }
