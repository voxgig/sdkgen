
import {
  Content,
  File,
  Folder,
  cmp,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


import {
  perlStringLiteral,
} from './utility_perl'


// WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so it is generated
// rather than templated. The perl peer of cmp/ts/PrepareAuth_ts.ts.
//
// This was a static file at `tm/perl/utility/prepare_auth.pm` that opened
// with `my $HEADER_AUTH = 'authorization';` and never looked further.
// apidef has always resolved the scheme's `in` and `name` into
// `main.kit.info.security` — joplin's says `in: "query", name: "token"` —
// and generation dropped both. The result was an SDK that sent a header
// the API does not read and never sent the query parameter it does, so it
// could not authenticate at all. Four repos in the cedar fleet shipped
// that way: joplin (`token`), pipedrive (`api_token`), trello (`key`),
// lm-umbrella (`apiKey`).
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in
// a bearer-token SDK, and no runtime `if` on a value that is fixed at
// generation time.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { model } = props.ctx$

  // `!isAuthSuppressed`, NOT `isAuthActive`. The latter is also false when
  // the SPEC merely declares no security scheme (`main.kit.info.auth:
  // false`), and those SDKs still carry a credential: optspec always
  // declares `apikey` and makeOptions fills `options.auth` from its
  // defaults, so the runtime guard never fired and they have always sent
  // it. Only an explicit `main.kit.config.auth.active: false` means "no
  // credential, ever", which is what isAuthSuppressed reads.
  const active = !isAuthSuppressed(model)
  const where = resolveAuthIn(model)
  const name = resolveAuthName(model)
  const basic = isHttpBasicAuth(model)

  // EXACTLY ONE folder, and it is opened HERE.
  //
  // Unlike ts — whose Main opens `Folder({name:'src'})` around Config,
  // SdkError and this component — perl's Main calls PrepareAuth at the
  // TOP LEVEL, with no folder open. The template's own path says what the
  // layout is: `tm/perl/utility/prepare_auth.pm`, copied by Main's
  // blanket `Copy({from:'tm/perl'})` (which excludes only `src/`), lands
  // at `<sdk>/utility/prepare_auth.pm`. perl has no `src/` tree at all —
  // Main writes `lib/`, `config.pm` and `features.pm` straight into the
  // root. So this component must open `utility` and nothing above it:
  // opening a second folder would write `src/utility/` or `./utility/`,
  // a path nothing requires, while the copied file kept being loaded.
  Folder({ name: 'utility' }, () => {
    File({ name: 'prepare_auth.pm' }, () => {
      Content(render({ Name: model.const.Name, active, where, name, basic }))
    })
  })
})


type AuthSpec = {
  Name: string,
  active: boolean,
  where: string,
  name: string,
  basic: boolean,
}


// PERL KEEPS ITS HEADER KEYS LOWERCASE, and here that is load-bearing
// rather than cosmetic. The template's constant was `'authorization'`,
// and two other generated perl files address that exact spelling:
// `feature/secrets_feature.pm` rewrites `$headers->{'authorization'}` at
// the transport seam (it rebuilds the header the way prepare_auth does,
// so the two must not drift), and `t/pipeline.t` asserts on
// `$ctx->{spec}{headers}{authorization}`. Emitting the resolved name
// verbatim would give every default SDK `Authorization` and silently
// split those three into two different hash keys.
//
// Header field names are case-insensitive on the wire (and HTTP/2
// requires them lowercase), so lowercasing costs nothing and keeps a
// header-based SDK behaving exactly as it did. A QUERY PARAMETER and a
// COOKIE name are case-sensitive, and go in verbatim.
function credName(spec: AuthSpec): string {
  return 'header' === spec.where ? spec.name.toLowerCase() : spec.name
}


function render(spec: AuthSpec): string {
  return spec.active ? renderActive(spec) : renderInactive(spec)
}


// NO AUTH AT ALL. A public API's SDK gets a prepare_auth that is honest
// about it rather than one that deletes a header nobody set.
function renderInactive(spec: AuthSpec): string {
  return `# ${spec.Name} SDK utility: prepare_auth

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));

package ${spec.Name}Utilities;

our %REGISTRY;

# This API declares no authentication, so there is no credential to
# place. The entry stays in the registry because make_spec calls it
# unconditionally, and still guards the spec so the auth_no_spec contract
# holds for every SDK.
$REGISTRY{prepare_auth} = sub {
  my ($ctx) = @_;
  my $spec = $ctx->{spec};
  return (undef, $ctx->make_error('auth_no_spec',
    'Expected context spec property to be defined.')) unless $spec;

  return ($spec, undef);
};

1;
`
}


function renderActive(spec: AuthSpec): string {
  const cred = perlStringLiteral(credName(spec))

  // HTTP Basic is header-only by definition: the scheme is
  // `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
  // query parameter or a cookie, so the branch — and the core module it
  // needs — are emitted only where they can mean something.
  const wantBasic = spec.basic && 'header' === spec.where

  const use64 = wantBasic ? `use MIME::Base64 ();\n` : ''
  const secretConst = wantBasic ?
    `my $OPTION_SECRET = 'secret';\n` : ''

  return `# ${spec.Name} SDK utility: prepare_auth

use strict;
use warnings;

use File::Basename ();
use Cwd ();
${use64}
my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));

package ${spec.Name}Utilities;

our %REGISTRY;

${placementNote(spec)}my $CRED_NAME = ${cred};
my $OPTION_APIKEY = 'apikey';
${secretConst}my $NOT_FOUND = '__NOTFOUND__';

$REGISTRY{prepare_auth} = sub {
  my ($ctx) = @_;
  my $spec = $ctx->{spec};
  return (undef, $ctx->make_error('auth_no_spec',
    'Expected context spec property to be defined.')) unless $spec;

${bag(spec)}  my $options = $ctx->{client}->options_map;

  # Public APIs that need no auth omit the options.auth block entirely.
${noCredNote(spec)}  if (!defined ${spec.Name}Helpers::gp($options, 'auth')) {
${clear(spec, '    ')}    return ($spec, undef);
  }

  my $apikey = Voxgig::Struct::getprop($options, $OPTION_APIKEY, $NOT_FOUND);
${basicBlock(spec, wantBasic)}${credBlock(spec)}
  return ($spec, undef);
};

1;
`
}


// The missing-credential test, verbatim from the template so the four
// "no credential" shapes it distinguishes (undef, the NONE sentinel, a
// JSON null, the not-found marker or an empty string) keep behaving
// identically.
const MISSING = `  if (!defined $apikey || Voxgig::Struct::is_none($apikey)
    || Voxgig::Struct::is_jnull($apikey)
    || (!ref $apikey && ($apikey eq $NOT_FOUND || $apikey eq ''))) {`


// Place the credential, or clear what a previous option left behind.
//
// Header and query keep the template's if/else, because both have real
// work to do in both branches. COOKIE HAS NOTHING TO CLEAR (see clear()),
// and an `if` whose whole body is a comment is not perl anybody writes -
// so that one returns early and lets the placement run unindented.
function credBlock(spec: AuthSpec): string {
  if ('cookie' === spec.where) {
    return `
${MISSING}
    return ($spec, undef);
  }

${place(spec).replace(/^ {4}/gm, '  ')}`
  }

  return `
${MISSING}
${clear(spec, '    ')}  }
  else {
${place(spec)}  }
`
}


// For the cookie placement, where the reason there is no `delete` has to
// be stated where the delete would have been.
function noCredNote(spec: AuthSpec): string {
  if ('cookie' !== spec.where) {
    return ''
  }

  return `  # Nothing of OURS to remove either way: this SDK appends its pair to
  # whatever cookie header the caller set and never stores one, and
  # prepare_headers rebuilds that header from options on every request.
`
}


// A one-line reminder, in the generated file, of what the model said —
// so a reader of a joplin SDK is not left wondering why prepare_auth
// touches the query string.
function placementNote(spec: AuthSpec): string {
  if ('query' === spec.where) {
    return `# This API carries its credential as a QUERY PARAMETER (the spec's\n` +
      `# securityScheme says in: query), not as a header.\n`
  }
  if ('cookie' === spec.where) {
    return `# This API carries its credential as a COOKIE (the spec's\n` +
      `# securityScheme says in: cookie), not as a header.\n`
  }
  return ''
}


// The bag the credential lands in. Cookies ride the header bag, because a
// cookie IS a header.
function bag(spec: AuthSpec): string {
  if ('query' === spec.where) {
    // make_spec fills spec.query from prepare_query BEFORE prepare_auth
    // runs, so the bag is normally already there. A spec handed in
    // without one still has to receive the credential, and assigning
    // through an undef lexical would autovivify a hash the spec never
    // sees - so the bag is created ON THE SPEC.
    return `  my $query = $spec->{query};
  unless (Voxgig::Struct::ismap($query)) {
    $query = {};
    $spec->{query} = $query;
  }

`
  }

  // No blank line after it: this is the template's own line, in the
  // template's own place, so a header-based SDK's prepare_auth.pm stays
  // what it was.
  return `  my $headers = $spec->{headers};
`
}


function clear(spec: AuthSpec, ind: string): string {
  if ('query' === spec.where) {
    return `${ind}delete $query->{$CRED_NAME};\n`
  }

  if ('cookie' === spec.where) {
    // NOTHING TO CLEAR. The header case deletes its header because the
    // caller's own `options.headers` may carry a stale `authorization`
    // that must not go out when auth is suppressed. A cookie is
    // different: this SDK APPENDS its pair to whatever cookie header the
    // caller set, and prepare_headers hands it a fresh clone of that
    // header on every request - so there is never a pair of ours left
    // behind, and surgically removing one pair from the caller's own
    // cookie header would be deleting something they put there
    // deliberately. noCredNote() says so in the generated file.
    return ''
  }

  return `${ind}delete $headers->{$CRED_NAME};\n`
}


function place(spec: AuthSpec): string {
  if ('query' === spec.where) {
    // NO PREFIX IN A QUERY STRING. `?token=Bearer%20abc` is not a thing
    // any API reads; the prefix is a header convention and is dropped
    // here deliberately rather than silently concatenated.
    return `    # NO PREFIX IN A QUERY STRING: \`?token=Bearer%20abc\` is not a thing
    # any API reads. The prefix is a header convention, and is dropped
    # here deliberately rather than silently concatenated. make_url
    # url-encodes both the name and the value.
    $query->{$CRED_NAME} = (!ref $apikey) ? "$apikey" : '';
`
  }

  if ('cookie' === spec.where) {
    return `    my $apikey_val = (!ref $apikey) ? "$apikey" : '';
    my $pair = "$CRED_NAME=$apikey_val";
    # APPEND, never clobber: the caller's own cookie header may already
    # carry a session or consent pair that the API needs alongside this
    # credential.
    my $cookie = $headers->{'cookie'};
    $cookie = '' unless defined $cookie && !ref $cookie;
    $headers->{'cookie'} = ('' eq $cookie) ? $pair : "$cookie; $pair";
`
  }

  return `    my $auth_prefix = ${spec.Name}Helpers::gpath($options, 'auth.prefix');
    $auth_prefix = '' unless defined $auth_prefix && !ref $auth_prefix;
    my $apikey_val = (!ref $apikey) ? "$apikey" : '';
    # Empty prefix (raw apiKey credential) must not add a leading space.
    $headers->{$CRED_NAME} =
      ('' eq $auth_prefix) ? $apikey_val : "$auth_prefix $apikey_val";
`
}


function basicBlock(spec: AuthSpec, wantBasic: boolean): string {
  if (!wantBasic) {
    return ''
  }

  return `
  # True HTTP Basic Auth needs TWO credentials, base64-joined - a single
  # token in the header (the branch below) can never authenticate against
  # an API that actually checks \`Authorization: Basic base64(user:pass)\`.
  if (${spec.Name}Helpers::is_true(${spec.Name}Helpers::gpath($options, 'auth.basic'))) {
    my $secret = Voxgig::Struct::getprop($options, $OPTION_SECRET, $NOT_FOUND);

    my $no_apikey = !defined $apikey || Voxgig::Struct::is_none($apikey)
      || Voxgig::Struct::is_jnull($apikey)
      || (!ref $apikey && ($apikey eq $NOT_FOUND || $apikey eq ''));
    my $no_secret = !defined $secret || Voxgig::Struct::is_none($secret)
      || Voxgig::Struct::is_jnull($secret)
      || (!ref $secret && ($secret eq $NOT_FOUND || $secret eq ''));

    if ($no_apikey || $no_secret) {
      delete $headers->{$CRED_NAME};
    }
    else {
      my $auth_prefix = ${spec.Name}Helpers::gpath($options, 'auth.prefix');
      $auth_prefix = '' unless defined $auth_prefix && !ref $auth_prefix;
      # '' as the eol: encode_base64 wraps at 76 columns by default, and a
      # newline inside a header value is not a header value.
      my $b64 = MIME::Base64::encode_base64("$apikey:$secret", '');
      $headers->{$CRED_NAME} =
        ('' eq $auth_prefix) ? $b64 : "$auth_prefix $b64";
    }

    return ($spec, undef);
  }
`
}


export {
  PrepareAuth
}
