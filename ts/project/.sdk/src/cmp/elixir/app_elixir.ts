
import { packageName } from '@voxgig/sdkgen'


// The OTP application, which is the hex package: the main module file, its
// folder and the typespec module are named after it too.
function elixirApp(model: any, target: any): string {
  return packageName(model, target.name)
}


export {
  elixirApp
}
