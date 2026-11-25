
// The OTP application: an atom mix holds to lower snake case. The main module
// file, its folder and the typespec module are named after it too.
function elixirApp(model: any): string {
  return String(model.const.name).toLowerCase().replace(/[^a-z0-9_]+/g, '_')
}


export {
  elixirApp
}
