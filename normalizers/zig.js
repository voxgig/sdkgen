// zig: normalizers whose pattern is Zig syntax.
const { lines, onNew } = require('../normalizers.js')
function zigSwitch1(t) {
  const m = /^const (\w+) = switch \(([\s\S]*?)\) \{\n {4}\.ok => \|e\| e,\n {4}\.err => \|e\| return (std\.debug\.print\(.*\)),\n\};\n?([\s\S]*)$/.exec(t)
  if (null == m) return t
  const rest = lines(m[4].trim()).filter((l) => '' !== l)
  const ok = 1 === rest.length ? [`    .ok => |${m[1]}| ${rest[0].replace(/;$/, ',')}`] : [`    .ok => |${m[1]}| {`, ...rest.map((l) => '        ' + l), '    },']
  return [`switch (${m[2]}) {`, ...ok, `    .err => |e| ${m[3]},`, '}'].join('\n')
}
function zigSwitch(t) {
  return t.split('\n\n').map((seg) => {
    const L = lines(seg); const lead = []
    while (0 < L.length && /^\s*\/\//.test(L[0])) lead.push(L.shift())
    return [...lead, zigSwitch1(L.join('\n'))].join('\n')
  }).join('\n\n')
}
module.exports = [
  { id: 'zig-env-io', order: 5, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'Zig 0.16 has no std.posix.getenv (the old idiom fails to compile under Basic auth, zig documentation lane basic-server): NEW reads the environment through the global Io the runtime itself uses (tm/zig/core/utility.zig); put back as the old getenv ... orelse',
    undo: onNew((t) => t.replace(/std\.Io\.Threaded\.global_single_threaded\.environ\.process_environ\.getAlloc\(h\.A\(\), ("[^"]*")\) catch ""/g, 'std.posix.getenv($1) orelse ""')) },
  { id: 'zig-bind-outside', order: 270, kind: 'unification', keys: /^(ref:op|root)/,
    undoes: 'a call outside error handling binds its result, written as a switch that returns on .err: NEW put back as a switch with the rest in its .ok arm',
    undo: onNew(zigSwitch) },
]
