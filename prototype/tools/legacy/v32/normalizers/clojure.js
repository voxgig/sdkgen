// clojure: normalizers whose pattern is Clojure syntax.
const { onNew } = require('../normalizers.js')
module.exports = [
  { id: 'server-required-given:clojure', order: 9, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'the client gives the server variables with no default (S50/D23): the `"server" (vs/jm ...)` pair removed from NEW where OLD had none',
    undo: onNew((t, old) => /server/.test(old) ? t : t.replace(/ "server" \(vs\/jm [^)]*\)/, '')) },
  { id: 'secret-option:clojure', order: 19, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'header Basic: the client passes the secret (S50/D23): the `"secret" (System/getenv ...)` pair removed from NEW where OLD had none',
    undo: onNew((t, old) => /DEMO_SECRET/.test(old || '') ? t : t.replace(/ "secret" \(System\/getenv "DEMO_SECRET"\)/, '')) },
]
