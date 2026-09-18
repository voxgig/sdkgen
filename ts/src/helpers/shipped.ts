
import Path from 'node:path'


function packageRoot(): string {
  return Path.resolve(__dirname, '..', '..')
}


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
