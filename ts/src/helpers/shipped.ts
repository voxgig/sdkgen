// WHERE THIS GENERATOR'S OWN FILES ARE, resolved from the compiled code.
//
// Every other path in `action/` is relative to the PROJECT being operated on
// — `node_modules/@voxgig/sdkgen/project/.sdk` is how a consumer reaches the
// bundled scaffold, and that is correct there. `package check` has no project:
// it is run by an AUTHOR against a package that may sit anywhere, and it
// still needs this generator's base schema (to unify against) and its feature
// catalogue (to know which names denote features). Those come from the
// installation doing the checking, which is this one.
//
// `__dirname` is `dist/helpers` in the shipped package, so the package root is
// two levels up. npm can only ship files under that root, which is why the
// canonical `model/` is mirrored into `ts/model/` (the model-mirror guard
// fails on drift).

import Path from 'node:path'


function packageRoot(): string {
  return Path.resolve(__dirname, '..', '..')
}


// The base model schema — `@voxgig/sdkgen/model/sdkgen.aon`.
function schemaFile(): string {
  return Path.join(packageRoot(), 'model', 'sdkgen.aon')
}


// The bundled scaffold — the `.sdk` of `ts/project`, which is itself an
// sdkgen package.
function scaffoldFolder(): string {
  return Path.join(packageRoot(), 'project', '.sdk')
}


export {
  packageRoot,
  schemaFile,
  scaffoldFolder,
}
