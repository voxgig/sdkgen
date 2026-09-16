
import {
  Content,
  File,
  Folder,
  cmp,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so it is generated
// rather than templated.
//
// This was a static file at `tm/csharp/utility/PrepareAuth.cs` that
// hardcoded `authorization` and a header. apidef has always resolved the
// scheme's `in` and `name` into `main.kit.info.security` - joplin's says
// `in: "query", name: "token"` - and generation dropped both. The result
// was an SDK that sent a header the API does not read and never sent the
// query parameter it does, so it could not authenticate at all. Four
// repos in the cedar fleet shipped that way: joplin (`token`), pipedrive
// (`api_token`), trello (`key`), lm-umbrella (`apiKey`).
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else - no dead query code in
// a bearer-token SDK, and no runtime `if` on a value that is fixed at
// generation time.
//
// This is the csharp port of PrepareAuth_ts, and it keeps the C# file's
// own idioms (lazy prefix read, `TryGetValue` for a suppressed auth
// block, `Remove` rather than a struct delprop): the credential MOVES,
// nothing else changes. For the default header placement the rendered
// file is BYTE-IDENTICAL to the template it replaces, so every
// header-based csharp SDK regenerates with no diff at all.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const active = !authSwitchedOff(model)
  const where = resolveAuthIn(model)
  const name = resolveAuthName(model)
  const basic = isHttpBasicAuth(model)

  // `utility`, opened HERE, and the call site in Main_csharp is at the
  // ROOT - deliberately outside `Folder({ name: 'core' })`.
  //
  // csharp's layout is not ts's. Main_csharp copies `tm/csharp` at the
  // root, so the template this replaces landed at `<out>/utility/
  // PrepareAuth.cs`, beside MakeSpec.cs and Register.cs - which is the
  // one path that compiles, since Register.cs wires `u.PrepareAuth =
  // PrepareAuthUtil` from the same `partial class SdkUtility`. The
  // generated files (Config, SdkError, EntityBase, EntityTypes) sit one
  // level down in `core/` because Main opens that Folder around them; a
  // call from inside it would write `core/utility/PrepareAuth.cs`, which
  // nothing compiles into the utility partial and which would leave the
  // stale copy at `utility/` being used instead.
  Folder({ name: 'utility' }, () => {
    File({ name: 'PrepareAuth.' + target.ext }, () => {
      Content(render({
        Name: model.const.Name,
        active,
        where,
        name,
        basic,
      }))
    })
  })
})


// DELIBERATELY NARROWER THAN isAuthActive, and measured rather than assumed.
//
// isAuthActive answers TWO different questions with one boolean:
//
//   1. `main.kit.config.auth.active: false` - this SDK is deliberately
//      built WITHOUT auth. A per-SDK decision.
//   2. `main.kit.info.auth: false`          - the SPEC declares no security
//      scheme. A fact about the API.
//
// Only (1) may silence prepareAuth. (2) says nothing about whether the
// CALLER holds a credential, and csharp has always let one through: the
// optspec in tm/csharp/utility/MakeOptions.cs supplies an `auth` default
// map whether or not the generated config carries one, so `options.auth` is
// non-null at runtime and the old template placed `options.apikey` in the
// authorization header regardless of what the spec declared. The generated
// secrets feature and the auth-null probe both depend on exactly that.
//
// Gating the no-op on isAuthActive instead turns two csharp tests red -
// `csharp: auth null beats an explicit apikey` ("baseline broken: an
// ordinary apikey was not sent") and `csharp: the secrets feature runs with
// the feature active` - because the generate harness model IS case (2)
// (`main: kit: info: { ..., auth: false }`). Losing the ability to
// authenticate is the defect this whole change exists to fix, so it is not
// worth re-introducing at the other end.
function authSwitchedOff(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return null != auth && false === auth.active
}


function render(spec: {
  Name: string, active: boolean, where: string, name: string, basic: boolean
}): string {
  const Name = spec.Name

  // AUTH SWITCHED OFF FOR THIS SDK (`config.auth.active: false`). The
  // project has said it wants no credential placed, so prepareAuth places
  // none - rather than one that deletes a header nobody set.
  if (!spec.active) {
    return `// ${Name} SDK utility: prepareAuth - this SDK is built with auth
// switched off, so there is no credential to place.

namespace ${Name}Sdk.Util;

public static partial class SdkUtility
{
    // Still in the pipeline: MakeSpec calls PrepareAuth unconditionally, and
    // a missing spec is still the same error it always was.
    internal static Spec PrepareAuthUtil(Context ctx)
    {
        return ctx.Spec ?? throw ctx.MakeError("auth_no_spec",
            "Expected context spec property to be defined.");
    }
}
`
  }

  if ('query' === spec.where) {
    return renderQuery(Name, csstr(spec.name))
  }

  if ('cookie' === spec.where) {
    return renderCookie(Name, csstr(spec.name))
  }

  // HEADER NAMES ARE LOWERCASED, and the rest of the generated C# is why.
  // `spec.Headers` is a plain Dictionary<string, object?> - case-SENSITIVE -
  // and every other writer of an auth header in this target spells it
  // lowercase: SecretsFeature re-writes `headers["authorization"]` on a
  // refresh, MakeSpec sets `headers["content-type"]`, and the generated
  // tests assert `Headers["authorization"]`. An `Authorization` key here
  // would sit BESIDE those rather than replace them and go out as a second
  // header. Header names are case-insensitive on the wire (RFC 7230) and
  // lowercase on HTTP/2, so nothing is lost. Query parameter and cookie
  // names, which ARE case-sensitive, are emitted verbatim above.
  return renderHeader(Name, csstr(String(spec.name).toLowerCase()), spec.basic)
}


// HEADER. Byte-identical to the template it replaces whenever the resolved
// name is the default (`authorization`) and the scheme is not HTTP Basic.
function renderHeader(Name: string, cred: string, basic: boolean): string {
  // HTTP Basic is header-only by definition: the scheme is
  // `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
  // query parameter or a cookie, so the branch is emitted only here, and
  // only when the model says this API actually uses it - a bearer SDK
  // carries none of it.
  const basicConst = basic ? `
    private const string OptionSecret = "secret";` : ''

  const basicBlock = basic ? `
        // True HTTP Basic Auth needs TWO credentials, base64-joined - a
        // single token in the header (the branch below) can never
        // authenticate against an API that actually checks
        // \`Authorization: Basic base64(user:pass)\`.
        if (StructUtils.GetPath(options, StructUtils.Jt("auth", "basic")) is bool isBasic &&
            isBasic)
        {
            var secret = StructUtils.GetProp(options, OptionSecret, NotFound);

            var noApikey = apikey == null ||
                (apikey is string akStr && (akStr == NotFound || akStr == ""));
            var noSecret = secret == null ||
                (secret is string skStr && (skStr == NotFound || skStr == ""));

            if (noApikey || noSecret)
            {
                headers.Remove(HeaderAuth);
            }
            else
            {
                var basicPrefix = "";
                if (StructUtils.GetPath(options, StructUtils.Jt("auth", "prefix")) is string bp)
                {
                    basicPrefix = bp;
                }
                var b64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(
                    (apikey as string ?? "") + ":" + (secret as string ?? "")));
                headers[HeaderAuth] = basicPrefix == ""
                    ? b64
                    : basicPrefix + " " + b64;
            }

            return spec;
        }
` : ''

  return `// ${Name} SDK utility: prepareAuth - shape the ${cred} header
// from the client options.

using Voxgig.Struct;

namespace ${Name}Sdk.Util;

public static partial class SdkUtility
{
    private const string HeaderAuth = "${cred}";
    private const string OptionApikey = "apikey";${basicConst}
    private const string NotFound = "__NOTFOUND__";

    internal static Spec PrepareAuthUtil(Context ctx)
    {
        var spec = ctx.Spec ?? throw ctx.MakeError("auth_no_spec",
            "Expected context spec property to be defined.");

        var headers = spec.Headers;
        var options = ctx.Client!.OptionsMap();

        // Public APIs that need no auth omit the options.auth block entirely.
        if (!options.TryGetValue("auth", out var auth) || auth == null)
        {
            headers.Remove(HeaderAuth);
            return spec;
        }

        var apikey = StructUtils.GetProp(options, OptionApikey, NotFound);
${basicBlock}
        var skip = apikey == null ||
            (apikey is string apikeyStr && (apikeyStr == NotFound || apikeyStr == ""));

        if (skip)
        {
            headers.Remove(HeaderAuth);
        }
        else
        {
            var authPrefix = "";
            if (StructUtils.GetPath(options, StructUtils.Jt("auth", "prefix")) is string ap)
            {
                authPrefix = ap;
            }
            var apikeyVal = apikey as string ?? "";
            // Empty prefix (raw apiKey credential) must not add a leading space.
            headers[HeaderAuth] = authPrefix == ""
                ? apikeyVal
                : authPrefix + " " + apikeyVal;
        }

        return spec;
    }
}
`
}


// QUERY. MakeSpec fills spec.Query before it calls PrepareAuth, and MakeUrl
// reads spec.Query afterwards (via MakeFetchDef), url-escaping every key and
// value - so the credential placed here reaches the wire as `?name=value`.
function renderQuery(Name: string, cred: string): string {
  return `// ${Name} SDK utility: prepareAuth - carry the API credential in the
// ${cred} query parameter, from the client options.

using Voxgig.Struct;

namespace ${Name}Sdk.Util;

public static partial class SdkUtility
{
    private const string QueryAuth = "${cred}";
    private const string OptionApikey = "apikey";
    private const string NotFound = "__NOTFOUND__";

    internal static Spec PrepareAuthUtil(Context ctx)
    {
        var spec = ctx.Spec ?? throw ctx.MakeError("auth_no_spec",
            "Expected context spec property to be defined.");

        var query = spec.Query;
        var options = ctx.Client!.OptionsMap();

        // Public APIs that need no auth omit the options.auth block entirely.
        if (!options.TryGetValue("auth", out var auth) || auth == null)
        {
            query.Remove(QueryAuth);
            return spec;
        }

        var apikey = StructUtils.GetProp(options, OptionApikey, NotFound);

        var skip = apikey == null ||
            (apikey is string apikeyStr && (apikeyStr == NotFound || apikeyStr == ""));

        if (skip)
        {
            query.Remove(QueryAuth);
        }
        else
        {
            var apikeyVal = apikey as string ?? "";
            // NO PREFIX IN A QUERY STRING. \`?token=Bearer%20abc\` is not a thing
            // any API reads; the prefix is a header convention, so
            // options.auth.prefix is dropped here deliberately rather than
            // silently concatenated.
            query[QueryAuth] = apikeyVal;
        }

        return spec;
    }
}
`
}


// COOKIE. A cookie IS a header, so the credential rides in the shared
// `cookie` header - APPENDED to whatever options.headers (or an earlier
// feature) already put there, never assigned over it.
function renderCookie(Name: string, cred: string): string {
  return `// ${Name} SDK utility: prepareAuth - carry the API credential in the
// ${cred} cookie, from the client options.

using Voxgig.Struct;

namespace ${Name}Sdk.Util;

public static partial class SdkUtility
{
    private const string CookieAuth = "${cred}";
    private const string HeaderCookie = "cookie";
    private const string OptionApikey = "apikey";
    private const string NotFound = "__NOTFOUND__";

    internal static Spec PrepareAuthUtil(Context ctx)
    {
        var spec = ctx.Spec ?? throw ctx.MakeError("auth_no_spec",
            "Expected context spec property to be defined.");

        var headers = spec.Headers;
        var options = ctx.Client!.OptionsMap();

        // Public APIs that need no auth omit the options.auth block entirely.
        if (!options.TryGetValue("auth", out var auth) || auth == null)
        {
            // Nothing of ours to remove: the credential rides INSIDE the
            // shared cookie header, which this function only ever appends to.
            // Returning here is what withholds it.
            return spec;
        }

        var apikey = StructUtils.GetProp(options, OptionApikey, NotFound);

        var skip = apikey == null ||
            (apikey is string apikeyStr && (apikeyStr == NotFound || apikeyStr == ""));

        if (!skip)
        {
            var apikeyVal = apikey as string ?? "";
            // Append, never assign: a cookie header set by options.headers
            // would otherwise be clobbered by the credential. No prefix - a
            // cookie value is the credential itself.
            var existing = StructUtils.GetProp(headers, HeaderCookie, "") as string ?? "";
            var pair = CookieAuth + "=" + apikeyVal;
            headers[HeaderCookie] = existing == ""
                ? pair
                : existing + "; " + pair;
        }

        return spec;
    }
}
`
}


// A C# double-quoted string literal body. These names come from the API's
// own securityScheme, so they are not guaranteed to be bare identifiers.
function csstr(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}


export {
  PrepareAuth
}
