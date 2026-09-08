
import {
  cmp,
} from '@voxgig/sdkgen'


// C has no package manifest — the build is driven by the template Makefile
// (tm/c/Makefile, copied verbatim). Package is a no-op for the C target,
// kept so the Main component can call it uniformly across targets.
//
// This is also why the secrets feature's build model is not emitted from
// here, unlike Package_rust's rustls dependency table or Package_swift's
// targets: the Makefile reads the TRIMMED TREE. Config_c generates
// feature/secrets/kinds.c only when the model activates `secrets` for this
// target, and the Makefile compiles the vendored sekreto/plugin payload only
// when that file exists, compiles the plugin layer (and links OpenSSL and
// libcurl) only when a kind file survived the plugin trim. Nothing here has
// to restate the model's choice, so nothing here can drift from it.
const Package = cmp(async function Package(_props: any) {
  // intentionally empty
})


export {
  Package
}
