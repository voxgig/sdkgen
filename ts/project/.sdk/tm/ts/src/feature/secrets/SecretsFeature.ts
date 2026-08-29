import type { Context, FeatureOptions } from '../../types'

import { BaseFeature } from '../base/BaseFeature'
import { Sekreto, envkey } from './sekreto'


// Secret access via a vendored @voxgig/sekreto provider chain.
//
// The SDK's `apikey` option keeps exactly its old meaning: an explicit
// credential given in code. This feature makes it ONE SOURCE among several
// rather than the only one: when active, the apikey is resolved through a
// sekreto chain in which the explicit option (when set) is the FIRST
// provider — a `memory` store named `options` — so an explicit value always
// wins, by sekreto's own first-hit rule rather than by special-case logic.
// When the option is unset, the remaining providers (env, dotenv, a vault)
// are asked in order, and moving a credential from code to a vault becomes
// a configuration change.
//
// Resolution is ASYNC (providers may do IO), but the auth header is built
// by the synchronous prepareAuth inside makeSpec. The bridge is the
// feature hook pipeline: every entity op awaits featureHook('PreSpec')
// before calling makeSpec, so the PreSpec hook below resolves the secret
// once and writes it into the live options where prepareAuth already
// looks. prepareAuth itself is untouched. SolardemoSDK.prepare() bypasses
// feature hooks entirely, so it awaits client._secrets.resolve() itself.
class SecretsFeature extends BaseFeature {
  version = '0.1.0'
  name = 'secrets'

  _client: any
  _sekreto?: Sekreto
  _secretname: string = 'apikey'
  _resolving?: Promise<void>


  // Sync by contract (the constructor cannot await): build the chain only,
  // never look anything up here.
  init(ctx: Context, fopts: FeatureOptions): void {
    const client = ctx.client
    const options = ctx.options

    this._client = client
    this._secretname = 'string' === typeof (fopts as any).name &&
      '' !== (fopts as any).name ? (fopts as any).name : 'apikey'

    const providers: any[] = []

    // The explicit option, when set, is the first store in the chain.
    const apikey = options.apikey
    if ('string' === typeof apikey && '' !== apikey) {
      providers.push({
        kind: 'memory',
        name: 'options',
        values: { [envkey(this._secretname)]: apikey },
      })
    }

    for (const p of ((fopts as any).providers || [])) {
      providers.push(p)
    }

    this._sekreto = new Sekreto({
      providers,
      cache: false !== (fopts as any).cache,
    })

    // Seam for ProjectNameSDK.prepare() (no feature hooks on that path)
    // and for the public secrets() accessor.
    //
    // Cast, because `_secrets` is emitted on the SDK class only when this
    // feature is active, while this file is copied into the target tree by
    // Main's blanket copy whether or not the model declares the feature.
    // Typing the assignment would make the SDK fail to compile in exactly
    // the case the feature is switched off.
    ;(client as any)._secrets = this
  }


  // The LIVE Sekreto instance, for the SDK's secrets() accessor and for
  // callers who want arbitrary secrets or redaction:
  //
  //   await sdk.secrets().get('db.password')
  //   sdk.secrets().redact(logline)
  //
  // Public, so the accessor does not have to reach into a private field.
  // Never a clone: sekreto holds provider state (caches, vault leases)
  // that has to stay live to be worth anything.
  sekreto(): any {
    return this._sekreto
  }


  PreSpec(_ctx: Context) {
    return this.resolve()
  }


  // Resolve the apikey once, before the first request. Concurrent ops share
  // the same in-flight promise. A provider ERROR (unreachable vault, bad
  // creds) rejects and fails the op — sekreto's miss-vs-error rule: never
  // fall through to an unauthenticated request because a store was broken.
  resolve(): Promise<void> {
    if (null == this._resolving) {
      this._resolving = this._resolveonce()
    }
    return this._resolving
  }


  private async _resolveonce(): Promise<void> {
    if (null == this._sekreto) {
      return
    }

    const found = await this._sekreto.try(this._secretname)

    if (undefined !== found) {
      // The same live-mutation seam TestFeature uses for the transport:
      // prepareAuth reads client.options() (a clone of _options), so the
      // resolved value lands where the sync auth path already looks.
      this._client._options.apikey = found
    }
  }
}


export {
  SecretsFeature
}
