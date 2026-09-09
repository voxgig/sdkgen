
import {
  cmp,
} from '@voxgig/sdkgen'


// The C++ target ships a header-only SDK built by the tm/cpp Makefile (copied
// verbatim); there is no package manifest to generate (unlike pom.xml /
// Cargo.toml / go.mod). This component is a no-op kept for parity with the
// other targets' Main -> Package call.
//
// The Makefile stays a TEMPLATE even now that the gated `secrets` feature
// brings a multi-translation-unit payload: its build model is wildcard-
// driven (feature/secrets/kinds.cpp present -> compile the vendored
// archive; a kind file present -> compile the plugin layer and link
// OpenSSL), so the same verbatim file is right for every model, and the
// one thing that differs per API - which kinds were selected - is emitted
// by Config_cpp's FeaturePlugins as feature/secrets/kinds.cpp, not here.
// (c makes the same choice; rust generates a module index instead because
// cargo has no wildcard.)
const Package = cmp(async function Package(_props: any) {
})


export {
  Package
}
