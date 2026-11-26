
// A target's display name when its model declares no title, by the target's
// origin. A test holds each equal to the title its bundled model declares.
const LANG_LABEL: Record<string, string> = {
  c: 'C',
  clojure: 'Clojure',
  cpp: 'C++',
  csharp: 'C#',
  elixir: 'Elixir',
  go: 'Go',
  'go-cli': 'Go CLI',
  'go-mcp': 'Go MCP server',
  java: 'Java',
  js: 'JavaScript',
  kotlin: 'Kotlin',
  lua: 'Lua',
  ocaml: 'OCaml',
  perl: 'Perl',
  php: 'PHP',
  py: 'Python',
  'py-data': 'Python Data',
  rb: 'Ruby',
  rust: 'Rust',
  scala: 'Scala',
  swift: 'Swift',
  ts: 'TypeScript',
  zig: 'Zig',
}


function langLabel(target: string): string {
  return LANG_LABEL[target] || target
}


function given(value: any): boolean {
  return null != value && '' !== value
}


// The title fact: the declared title, else the origin's label, else the key.
// Code, not a rule: aontu has no fallback for a member's absent field
// (aontu-lang/aontu#849).
function titleFacts(target: any): void {
  for (const [name, t] of Object.entries(target || {})) {
    const decl: any = t
    if (null != decl?.fact && 'object' === typeof decl.fact) {
      decl.fact.title = given(decl.title) ? String(decl.title) :
        (LANG_LABEL[decl.fact.origin] ?? name)
    }
  }
}


export {
  LANG_LABEL,
  langLabel,
  titleFacts,
}
