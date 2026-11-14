// Stand-in syntax provider: how go writes things, never what the SDK has.
const Syntax = {
  lang: 'go',
  call: (obj: string, method: string, args: string) => obj + '.' + method + '(' + args + ')',
}

export { Syntax }
