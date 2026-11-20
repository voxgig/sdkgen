
import Path from 'node:path'


function packageRoot(): string {
  return Path.resolve(__dirname, '..', '..')
}


function schemaFile(): string {
  return Path.join(packageRoot(), 'model', 'sdkgen.aontu')
}


// The bundled scaffold — the `.sdk` of `ts/project`, which is itself an
// sdkgen package.
function scaffoldFolder(): string {
  return Path.join(packageRoot(), 'project', '.sdk')
}


function factRulesFile(): string {
  return Path.join(packageRoot(), 'model', 'fact.aontu')
}

export {
  packageRoot,
  schemaFile,
  scaffoldFolder,
  factRulesFile,
}
