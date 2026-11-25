
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


// This generator's own version, from the package.json beside `dist`. Not from
// the consumer's model: `engines.sdkgen` is about the generator running.
const SDKGEN_VERSION: string = (() => {
  try {
    return require(Path.join(packageRoot(), 'package.json')).version
  }
  catch (err: any) {
    return '0.0.0'
  }
})()

export {
  SDKGEN_VERSION,
  packageRoot,
  schemaFile,
  scaffoldFolder,
  factRulesFile,
}
