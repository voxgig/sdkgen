import {
  cmp,
  File,
  Content,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


import { perlStringLiteral } from './utility_perl'


// The canary sweep: every credential slot holds a distinctive value, every
// diagnostic feature this SDK ships is switched on with a capturing sink, a
// real operation runs through every outcome, and every string that leaves
// is searched for the canaries and their encoded forms; a second sweep does
// the same for a body of bytes. With clean off the canary MUST show.
const TestClean = cmp(function TestClean(props: any) {
  const { model } = props.ctx$

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  File({ name: 'clean.t' }, () => Content(render(model.const.Name, auth)))
})


function render(Name: string, auth: {
  suppressed: boolean, where: string, name: string, basic: boolean
}): string {
  return `#!perl
# ${Name} SDK clean test
#
# The canary sweep: every credential slot holds a distinctive value, every
# diagnostic feature this SDK ships is switched on with a capturing sink, a
# real operation runs through every outcome, and every string that leaves
# is searched for the canaries and their encoded forms; a second sweep does
# the same for a body of bytes. With clean off the canary MUST show.

use strict;
use warnings;
use Test::More;
use FindBin;
use lib "$FindBin::Bin/../lib";
use Scalar::Util ();
use MIME::Base64 ();
use Data::Dumper ();
use JSON::PP ();
use File::Temp ();
use IO::File ();

use ${Name}SDK;

# Generated: the credential's wire placement is fixed when the SDK is built.
my %AUTH = (
  'suppressed' => ${auth.suppressed ? 1 : 0},
  'where' => ${perlStringLiteral(auth.where)},
  'name' => ${perlStringLiteral(auth.name)},
  'basic' => ${auth.basic ? 1 : 0},
);

my %CANARY = (
  'apikey' => 'CANARY-APIKEY-k9x2m7q4p1',
  'secret' => 'CANARY-SECRET-w3e8r5t2y6',
  'header' => 'CANARY-HEADER-z1x4c7v0b3',
  'value' => 'CANARY-VALUE-n5m8b2v9c4',
  'config' => 'CANARY-CONFIG-h6j3k8l2m5',
);

my $MASK = '[redacted]';

# encodeURIComponent, the form a query credential travels in.
sub pct {
  my ($value) = @_;
  my $b = "$value";
  $b =~ s/([^A-Za-z0-9\\-_.!~*'()])/sprintf('%%%02X', ord($1))/ge;
  return $b;
}

# Every form a canary can travel in.
my @FORMS;
for my $v (sort values %CANARY) {
  push @FORMS, $v, MIME::Base64::encode_base64($v, ''), pct($v);
}
push @FORMS, MIME::Base64::encode_base64("$CANARY{apikey}:$CANARY{secret}", '');

# The marker a body of bytes carries.
my $CONTENT = 'CANARY-CONTENT-b7n3v9x1c5';

# The marker a response of bytes carries.
my $RESPONSE = 'CANARY-RESPONSE-k2m8q4w6z0';

my $CONTENT_FILE = File::Temp->new;
print {$CONTENT_FILE} $CONTENT;
$CONTENT_FILE->flush;

# Every value this SDK accepts as a raw body. A filehandle is read once, so
# each run opens its own.
my @CARRIERS = (
  ['byte string', sub { my $bytes = $CONTENT; utf8::downgrade($bytes); return $bytes }],
  ['character string', sub { my $chars = $CONTENT; utf8::upgrade($chars); return $chars }],
  ['filehandle', sub {
    open(my $fh, '<:raw', $CONTENT_FILE->filename) or die "clean harness: $!";
    return $fh;
  }],
  ['IO::File', sub { return IO::File->new($CONTENT_FILE->filename, 'r') }],
);

# Blessed objects encode through TO_JSON; anything else that cannot be
# encoded is null rather than a die.
my $JSON = JSON::PP->new->canonical->convert_blessed->allow_blessed->allow_unknown;

# Header maps keep the caller's spelling; the assertion should not care.
sub header {
  my ($map, $name) = @_;
  return undef unless ref $map && (Scalar::Util::reftype($map) // '') eq 'HASH';
  for my $k (keys %$map) {
    return $map->{$k} if lc($k) eq lc($name);
  }
  return undef;
}

sub leaks {
  my ($text) = @_;
  return grep { index($text, $_) >= 0 } @FORMS;
}

# The forms bytes travel in once copied: a string prints as its text, and a
# dump of one shows its byte values, hex or base64.
sub content_leaks {
  my ($text, $marker) = @_;
  $marker = $CONTENT unless defined $marker;
  (my $flat = $text) =~ s/\\s+//g;
  my @found;
  push @found, 'text' if index($text, $marker) >= 0;
  push @found, 'byte values' if index($flat, join(',', unpack('C*', $marker))) >= 0;
  push @found, 'hex' if index(lc $flat, unpack('H*', $marker)) >= 0;
  push @found, 'base64' if index($flat, MIME::Base64::encode_base64($marker, '')) >= 0;
  return @found;
}

sub surface {
  my ($out, $name, $kind, $fn) = @_;
  my $text = eval { $fn->() };
  return if $@;
  push @$out, { 'name' => "$name:$kind", 'text' => (defined $text ? "$text" : '') };
  return;
}

# Every printed form of a value that left the SDK. A blessed object is
# read through its own serialisers (TO_JSON, to_string), the way a logger
# or a JSON encoder reads it; a plain record and the error are also dumped
# whole, since Data::Dumper and Test::More's explain print every key.
sub forms {
  my ($name, $val) = @_;
  my $out = [];
  my $blessed = Scalar::Util::blessed($val);
  my $sdkerr = $blessed && $val->isa('${Name}Error');

  surface($out, $name, 'string', sub { "$val" });
  surface($out, $name, 'json', sub { $JSON->encode($val) });
  # The struct's own serialiser has no cycle guard, so a live object (what
  # the negative control gets with clean off) is read only through JSON::PP,
  # which stops at its nesting limit.
  surface($out, $name, 'struct', sub { Voxgig::Struct::stringify($val) }) unless $blessed;
  surface($out, $name, 'to_string', sub { $val->to_string })
    if $blessed && $val->can('to_string');

  if (!$blessed || $sdkerr) {
    surface($out, $name, 'dumper', sub {
      local $Data::Dumper::Sortkeys = 1;
      local $Data::Dumper::Indent = 1;
      Data::Dumper::Dumper($val);
    });
    surface($out, $name, 'explain', sub { join('', Test::More::explain($val)) });
  }

  if ($sdkerr) {
    surface($out, $name, 'msg', sub { $val->{msg} });
    surface($out, $name, 'fields', sub {
      join(' ', map {
        "$_=" . (defined $val->{$_}
          ? (ref $val->{$_} ? Voxgig::Struct::stringify($val->{$_}) : $val->{$_})
          : 'undef')
      } sort keys %$val);
    });
  }
  return @$out;
}

sub response {
  my ($status, $data, $headers) = @_;
  my %h = ('content-type' => 'application/json', %{ $headers || {} });
  return {
    'status' => $status,
    'statusText' => ($status < 400 ? 'OK' : 'ERR'),
    'headers' => \\%h,
    'json' => sub { $data },
    'body' => Voxgig::Struct::stringify($data),
  };
}

# The marker under the type the response declares, as the default transport
# hands on a body it could not parse.
sub unread_response {
  my ($status, $type) = @_;
  return {
    'status' => $status,
    'statusText' => ($status < 400 ? 'OK' : 'ERR'),
    'headers' => { 'content-type' => $type },
    'json' => sub { undef },
    'body' => "$RESPONSE",
    'unreadable' => 1,
  };
}

# Captures the serialised context from inside the pipeline: what a hook
# author would hand to a logger.
{
  package ${Name}CleanCaptureFeature;
  our @ISA = ('${Name}BaseFeature');

  sub new {
    my ($class, $sinks) = @_;
    my $self = ${Name}BaseFeature::new($class);
    $self->{name} = 'capture';
    $self->{version} = '0.0.1';
    $self->{active} = 1;
    $self->{sinks} = $sinks;
    return $self;
  }

  sub PreRequest { my ($s, $ctx) = @_; push @{ $s->{sinks} }, main::forms('ctx@PreRequest', $ctx); return }
  sub PreResponse { my ($s, $ctx) = @_; push @{ $s->{sinks} }, main::forms('ctx@PreResponse', $ctx); return }

  # The SDK's own error as a hook reads it, which an observability feature
  # logs.
  sub PreUnexpected {
    my ($s, $ctx) = @_;
    push @{ $s->{sinks} }, main::forms('ctx@PreUnexpected', $ctx);
    my $err = $ctx->{ctrl}{err};
    push @{ $s->{sinks} }, main::forms('ctrl.err@PreUnexpected', $err)
      if Scalar::Util::blessed($err) && $err->isa('${Name}Error');
    return;
  }
}

# Captures the request data as a hook would log it, before the spec exists
# and after: the other place a raw body sits, and the only one a filehandle
# does. It keeps the context, which the error holds only weakly.
{
  package ${Name}CleanRequestDataFeature;
  our @ISA = ('${Name}BaseFeature');

  sub new {
    my ($class, $sinks) = @_;
    my $self = ${Name}BaseFeature::new($class);
    $self->{name} = 'reqdata';
    $self->{version} = '0.0.1';
    $self->{active} = 1;
    $self->{sinks} = $sinks;
    return $self;
  }

  sub take {
    my ($s, $name, $ctx) = @_;
    $s->{ctx} = $ctx;
    push @{ $s->{sinks} }, main::forms($name, $ctx->{utility}{clean}->($ctx, $ctx->{reqdata}));
    return;
  }

  sub PreSpec { my ($s, $ctx) = @_; return $s->take('reqdata@PreSpec', $ctx) }
  sub PreRequest { my ($s, $ctx) = @_; return $s->take('reqdata@PreRequest', $ctx) }
}

# A feature that dies from inside the pipeline, quoting the request it saw:
# an error make_error never handled.
{
  package ${Name}CleanThrowFeature;
  our @ISA = ('${Name}BaseFeature');

  sub new {
    my ($class, $response, $unexpected) = @_;
    my $self = ${Name}BaseFeature::new($class);
    $self->{name} = 'throwhook';
    $self->{version} = '0.0.1';
    $self->{active} = 1;
    $self->{response} = defined $response ? $response : 1;
    $self->{unexpected} = $unexpected ? 1 : 0;
    return $self;
  }

  sub PreResponse {
    my ($s, $ctx) = @_;
    die 'hook saw ' . $JSON->encode({ %{ $ctx->{spec} } }) if $s->{response};
    return;
  }

  # Fires in make_error, and in the catch path before its cleaning.
  sub PreUnexpected {
    my ($s, $ctx) = @_;
    die 'hook saw ' . $JSON->encode({ %{ $ctx->{spec} } }) if $s->{unexpected};
    return;
  }
}

# A stream that succeeds; the pipeline's terminal step ran before it.
{
  package ${Name}CleanStreamOkFeature;
  our @ISA = ('${Name}BaseFeature');

  sub new {
    my ($class) = @_;
    my $self = ${Name}BaseFeature::new($class);
    $self->{name} = 'streamok';
    $self->{version} = '0.0.1';
    $self->{active} = 1;
    return $self;
  }

  sub PreDone {
    my ($s, $ctx) = @_;
    my $data = $ctx->{result}{resdata};
    my @items = ref $data eq 'ARRAY' ? @$data : (defined $data ? ($data) : ());
    $ctx->{result}{stream} = sub { return shift @items };
    return;
  }
}

# A stream that fails while the caller pulls from it, quoting a credential.
{
  package ${Name}CleanStreamThrowFeature;
  our @ISA = ('${Name}BaseFeature');

  sub new {
    my ($class) = @_;
    my $self = ${Name}BaseFeature::new($class);
    $self->{name} = 'streamthrow';
    $self->{version} = '0.0.1';
    $self->{active} = 1;
    return $self;
  }

  sub PreDone {
    my ($s, $ctx) = @_;
    $ctx->{result}{stream} = sub { die "stream saw $CANARY{apikey}\\n" };
    return;
  }
}

# A hook that cleans the live spec itself, as one that logs the request
# would, and keeps what came back.
{
  package ${Name}CleanSpecFeature;
  our @ISA = ('${Name}BaseFeature');

  sub new {
    my ($class) = @_;
    my $self = ${Name}BaseFeature::new($class);
    $self->{name} = 'specclean';
    $self->{version} = '0.0.1';
    $self->{active} = 1;
    return $self;
  }

  sub PreRequest {
    my ($s, $ctx) = @_;
    $s->{live} = Scalar::Util::refaddr($ctx->{spec});
    $s->{cleaned} = $ctx->{utility}{clean}->($ctx, $ctx->{spec});
    return;
  }
}

# An exception class this SDK does not define, as a caller's own code has.
{
  package ${Name}CleanOwnError;
  use overload '""' => sub { $_[0]->{message} }, fallback => 1;

  sub new {
    my ($class, $message) = @_;
    return bless { 'message' => $message }, $class;
  }
}

# A feature that dies with what it was given, in a hook or in its stream.
{
  package ${Name}CleanDieFeature;
  our @ISA = ('${Name}BaseFeature');

  sub new {
    my ($class, $err, $instream) = @_;
    my $self = ${Name}BaseFeature::new($class);
    $self->{name} = 'diehook';
    $self->{version} = '0.0.1';
    $self->{active} = 1;
    $self->{err} = $err;
    $self->{instream} = $instream ? 1 : 0;
    return $self;
  }

  sub PreResponse {
    my ($s) = @_;
    die $s->{err} unless $s->{instream};
    return;
  }

  sub PreDone {
    my ($s, $ctx) = @_;
    my $err = $s->{err};
    $ctx->{result}{stream} = sub { die $err } if $s->{instream};
    return;
  }
}

# Each scenario answers the transport's (response, err) pair.
my @SCENARIOS = (
  ['ok', sub {
    return (response(200, { 'id' => 'i1', 'name' => 'n1' },
      { 'x-session-token' => 'RESP-TOKEN-a1b2c3d4e5' }), undef);
  }],
  ['notfound', sub { return (response(404, { 'error' => 'no such record' }), undef) }],
  ['server', sub { return (response(500, { 'error' => 'boom' }), undef) }],
  ['transport', sub {
    my ($url) = @_;
    return (undef, "socket hang up (URL was: \\"$url\\")");
  }],
  # The SDK's own error, its code quoting a registered value.
  ['coded', sub { return (undef, ${Name}Error->new("denied_$CANARY{apikey}", 'coded failure')) }],
  ['notjson', sub {
    return ({
      'status' => 200, 'statusText' => 'OK', 'headers' => {},
      'json' => sub { die "Unexpected token < in JSON\\n" },
      'body' => '<html>',
    }, undef);
  }],
);

my @VARIANTS = (
  ['throw', sub { return {} }],
  ['explain', sub { return { 'explain' => {} } }],
  ['nothrow', sub { return { 'throw' => 0, 'explain' => {} } }],
);

# True when this SDK was generated with the named feature.
sub has_feature {
  my ($name) = @_;
  my $f = ${Name}Config::shared_config()->{feature};
  return (Voxgig::Struct::ismap($f) && defined $f->{$name}) ? 1 : 0;
}

# Offline, as every generated suite is: the test OPTION resolves a required
# server variable to test-<name>, and installs no transport.
sub offline {
  my ($opts) = @_;
  return { %$opts, 'test' => { 'active' => 1 } };
}

# A client the sweep cannot build leaves nothing swept: a harness error, not a
# leak.
sub construct {
  my ($opts) = @_;
  my $client = eval { ${Name}SDK->new(offline($opts)) };
  die "clean harness: the client could not be constructed, so nothing was swept: $@"
    unless defined $client;
  return $client;
}

sub make_sdk {
  my ($scenario, $sinks, $cleanopts, $extra, $auth) = @_;
  my $capture = sub {
    my ($name) = @_;
    return sub { push @$sinks, forms($name, $_[0]); return };
  };
  my %feature;
  $feature{log} = { 'active' => 1,
    'logger' => sub { push @$sinks, { 'name' => 'log', 'text' => "$_[0]" }; return } }
    if has_feature('log');
  $feature{debug} = { 'active' => 1, 'on_entry' => $capture->('debug') } if has_feature('debug');
  $feature{audit} = { 'active' => 1, 'sink' => $capture->('audit') } if has_feature('audit');
  $feature{telemetry} = { 'active' => 1, 'exporter' => $capture->('telemetry') }
    if has_feature('telemetry');
  $feature{cost} = { 'active' => 1, 'sink' => $capture->('cost') } if has_feature('cost');
  $feature{metrics} = { 'active' => 1 } if has_feature('metrics');
  $feature{clienttrack} = { 'active' => 1 } if has_feature('clienttrack');

  my $respond = $scenario->[1];
  my $opts = {
    'apikey' => $CANARY{apikey},
    'secret' => $CANARY{secret},
    'headers' => { 'X-Custom-Token' => $CANARY{header} },
    'clean' => { 'values' => $CANARY{value}, %{ $cleanopts || {} } },
    'feature' => \\%feature,
    'extend' => [ ${Name}CleanCaptureFeature->new($sinks), @{ $extra || [] } ],
    'utility' => { 'fetcher' => sub {
      my (undef, $url, $fetchdef) = @_;
      return $respond->($url, $fetchdef);
    } },
  };
  $opts->{auth} = $auth if defined $auth;
  return construct($opts);
}

# An entity accessor is a capitalised client method whose result answers
# get_name, as the feature corpus runner finds them.
sub accessors {
  my ($plain) = @_;
  my %found;
  my $pkg = ref $plain;
  {
    no strict 'refs';
    for my $sym (sort keys %{"\${pkg}::"}) {
      next unless $sym =~ /^[A-Z]/;
      next unless defined &{"\${pkg}::\${sym}"};
      my $ent = eval { $plain->$sym() };
      next unless defined $ent && Scalar::Util::blessed($ent) && $ent->can('get_name');
      my $entname = eval { $ent->get_name };
      next unless defined $entname && length $entname;
      $found{$entname} = $sym;
    }
  }
  return %found;
}

# The first operation that completes against a plain 200: with no
# arguments, else with every path parameter its points declare filled in.
sub usable_op {
  my $plain = construct({
    'apikey' => $CANARY{apikey},
    'utility' => { 'fetcher' => sub { return (response(200, { 'id' => 'i1' }), undef) } },
  });

  my %found = accessors($plain);

  my $entities = ${Name}Config::shared_config()->{entity} || {};
  for my $entname (sort keys %found) {
    my $accessor = $found{$entname};
    for my $op (qw(list load create update patch remove)) {
      next unless $plain->$accessor()->can($op);
      my %filled;
      my $opdef = eval { $entities->{$entname}{op}{$op} };
      my $points = ref $opdef eq 'HASH' ? $opdef->{points} : undef;
      for my $point (ref $points eq 'ARRAY' ? @$points : ()) {
        my $params = ref $point eq 'HASH' && ref $point->{args} eq 'HASH'
          ? $point->{args}{params} : undef;
        for my $p (ref $params eq 'ARRAY' ? @$params : ()) {
          $filled{ $p->{name} } = 'p1' if ref $p eq 'HASH' && defined $p->{name} && !ref $p->{name};
        }
      }
      for my $match ({}, \\%filled) {
        my $ok = eval { $plain->$accessor()->$op({ %$match }, {}); 1 };
        return { 'accessor' => $accessor, 'op' => $op, 'match' => $match } if $ok;
      }
    }
  }
  return undef;
}

# The first operation with a point that sends a raw body the model marks
# binary, with every path parameter of that point filled in.
sub binary_op {
  my $plain = construct({ 'apikey' => $CANARY{apikey} });
  my %found = accessors($plain);
  my $entities = ${Name}Config::shared_config()->{entity} || {};
  for my $entname (sort keys %found) {
    my $accessor = $found{$entname};
    my $ops = eval { $entities->{$entname}{op} };
    for my $op (ref $ops eq 'HASH' ? sort keys %$ops : ()) {
      next unless $plain->$accessor()->can($op);
      my $points = ref $ops->{$op} eq 'HASH' ? $ops->{$op}{points} : undef;
      for my $point (ref $points eq 'ARRAY' ? @$points : ()) {
        my $body = ref $point eq 'HASH' ? $point->{body} : undef;
        next unless ref $body eq 'HASH' && defined $body->{kind} && 'raw' eq $body->{kind}
          && ${Name}Helpers::is_true($body->{binary});
        my %match;
        my $params = ref $point->{args} eq 'HASH' ? $point->{args}{params} : undef;
        for my $p (ref $params eq 'ARRAY' ? @$params : ()) {
          $match{ $p->{name} } = 'p1' if ref $p eq 'HASH' && defined $p->{name} && !ref $p->{name};
        }
        my $action = ref $point->{select} eq 'HASH' ? $point->{select}{'$action'} : undef;
        $match{'$action'} = $action if defined $action;
        return { 'accessor' => $accessor, 'op' => $op, 'match' => \\%match, 'media' => $body->{media} };
      }
    }
  }
  return undef;
}

sub drive {
  my ($sdk, $target, $ctrl, $sinks, $data) = @_;
  # A caller may keep the record it passed rather than read ctrl.explain.
  my $held = $ctrl->{explain};
  my ($acc, $op) = ($target->{accessor}, $target->{op});
  my $entity = $sdk->$acc();
  my $out;
  my $ok = eval { $out = $entity->$op({ %{ $target->{match} }, %{ $data || {} } }, $ctrl); 1 };
  my $err = $ok ? undef : $@;
  push @$sinks, forms('error', $err) if defined $err;
  push @$sinks, forms('result', $out) if defined $out;
  # Raw, as a caller copying the match into another query reads it.
  push @$sinks, forms('match', $entity->match_get());
  push @$sinks, forms('explain', $ctrl->{explain}) if defined $ctrl->{explain};
  push @$sinks, forms('explain:held', $held) if defined $held && (!defined $ctrl->{explain}
    || Scalar::Util::refaddr($held) != Scalar::Util::refaddr($ctrl->{explain}));
  return $err;
}


my $target = usable_op();
my $binary = binary_op();
plan skip_all => 'no operation of this SDK completes against a plain 200; nothing to sweep'
  unless defined $target || defined $binary;

SKIP: {
  skip 'no operation of this SDK completes against a plain 200; nothing to sweep', 1
    unless defined $target;

  my @sinks;
  my %errors;
  my %explains;

  for my $scenario (@SCENARIOS) {
    for my $variant (@VARIANTS) {
      my ($vname, $make_ctrl) = @$variant;
      my $sdk = make_sdk($scenario, \\@sinks);
      my $ctrl = $make_ctrl->();
      my $err = drive($sdk, $target, $ctrl, \\@sinks);
      my $key = "$scenario->[0]/$vname";
      $errors{$key} = $err if defined $err;
      $explains{$key} = $ctrl->{explain} if defined $ctrl->{explain};
      push @sinks, forms('sdk', $sdk);
    }
  }

  # A name given at run time replaces the declared one: the match leaves out
  # whichever name prepare_auth placed.
  drive(make_sdk($SCENARIOS[0], \\@sinks, undef, undef, { 'name' => 'zzcred' }),
    $target, {}, \\@sinks);

  # A credential mistyped as a map is rejected by validation, whose message
  # quotes the value it rejected.
  my $rejected;
  eval {
    ${Name}SDK->new(offline({
      'apikey' => { 'value' => $CANARY{apikey} },
      'clean' => { 'values' => $CANARY{value} },
    }));
    1;
  } or $rejected = $@;
  ok(defined $rejected, 'a credential mistyped as a map is rejected');
  push @sinks, forms('rejected', $rejected) if defined $rejected;

  # An error a feature hook dies with, quoting the request, skips make_error.
  # The variant dying only in PreUnexpected reaches make_error's own firing
  # through a 404.
  my $hooked;
  for my $hook ([ $SCENARIOS[0], 1, 0 ], [ $SCENARIOS[0], 1, 1 ], [ $SCENARIOS[1], 0, 1 ]) {
    my ($scenario, $response, $unexpected) = @$hook;
    $hooked = make_sdk($scenario, \\@sinks, undef,
      [ ${Name}CleanThrowFeature->new($response, $unexpected) ]);
    ok(defined drive($hooked, $target, { 'explain' => {} }, \\@sinks),
      'the throwing hook fails the operation');
  }

  # Pulling from a stream runs inside the same catch path as the operation,
  # and the explain record the caller passed is cleaned however it ends.
  for my $case ([ 'stream', ${Name}CleanStreamThrowFeature->new ],
    [ 'stream-ok', ${Name}CleanStreamOkFeature->new ], [ 'stream-plain' ]) {
    my ($name, @extra) = @$case;
    my $streamed = make_sdk($SCENARIOS[0], \\@sinks, undef, [ @extra ]);
    my $explain = {};
    my $streamerr;
    eval {
      my ($acc, $op) = ($target->{accessor}, $target->{op});
      my $next = $streamed->$acc()->stream($op, { 'reqmatch' => { %{ $target->{match} } } },
        { 'ctrl' => { 'explain' => $explain } });
      1 while defined $next->();
      1;
    } or $streamerr = $@;
    is(defined $streamerr ? 1 : 0, 'stream' eq $name ? 1 : 0, "$name: only the failing stream dies");
    push @sinks, forms($name, $streamerr) if defined $streamerr;
    ok(scalar(keys %$explain) > 0, "$name: the explain record is filled");
    push @sinks, forms("$name:explain", $explain);
  }

  # A registered value used as a property name is masked; names that mask
  # alike are all kept.
  my $named = $hooked->get_utility()->{clean}->($hooked->get_root_ctx(),
    { $CANARY{header} => 1, $CANARY{value} => 2, 'plain' => 3 });
  is_deeply($named, { $MASK => 1, "$MASK#1" => 2, 'plain' => 3 },
    'a registered value used as a property name is masked, collisions kept');
  push @sinks, forms('named', $named);

  # An exception object of another class is the caller's own: it leaves an
  # operation, a stream and direct() as the object it is.
  my $own = ${Name}CleanOwnError->new('refused');
  my $same = sub { return (ref $_[0] && Scalar::Util::refaddr($_[0]) == Scalar::Util::refaddr($own)) ? 1 : 0 };
  my $operr = drive(make_sdk($SCENARIOS[0], \\@sinks, undef, [ ${Name}CleanDieFeature->new($own) ]),
    $target, {}, \\@sinks);
  ok($same->($operr), "a hook's own exception object leaves the operation as it is");
  my $pullerr;
  eval {
    my ($acc, $op) = ($target->{accessor}, $target->{op});
    my $next = make_sdk($SCENARIOS[0], \\@sinks, undef, [ ${Name}CleanDieFeature->new($own, 1) ])
      ->$acc()->stream($op, { 'reqmatch' => { %{ $target->{match} } } }, {});
    1 while defined $next->();
    1;
  } or $pullerr = $@;
  ok($same->($pullerr), "a stream's own exception object leaves the stream as it is");
  my $raw = make_sdk([ 'own', sub { return (undef, $own) } ], \\@sinks)->direct({ 'path' => 'raw' });
  ok(!$raw->{ok} && $same->($raw->{err}), "a fetcher's own error object comes back from direct() as it is");

  # The live spec, cleaned on its own as it is when it sits in a record:
  # what comes back is dumped whole, as a hook's logger would print it.
  my $speclean = ${Name}CleanSpecFeature->new;
  drive(make_sdk($SCENARIOS[0], \\@sinks, undef, [ $speclean ]), $target, {}, \\@sinks);
  my $speccopy = $speclean->{cleaned};
  push @sinks, { 'name' => 'spec:top', 'text' => do {
    local $Data::Dumper::Sortkeys = 1;
    Data::Dumper::Dumper($speccopy);
  } };

  # The generated config's own clean block is read beside the caller's, and
  # is not changed by it.
  my $util = $hooked->get_utility();
  my $cfgclean = { 'keys' => 'zzsens', 'values' => $CANARY{config} };
  my $built = $util->{make_options}->($util->{make_context}->({
    'utility' => $util,
    'config' => { 'options' => { 'clean' => $cfgclean } },
    'options' => { 'clean' => { 'values' => $CANARY{value} } },
  }, undef));
  my $cfgctx = $util->{make_context}->({ 'options' => $built }, undef);
  my $seeded = $util->{clean}->($cfgctx, "config $CANARY{config} caller $CANARY{value}");
  push @sinks, { 'name' => 'config-clean', 'text' => "$seeded" };
  is($seeded, "config $MASK caller $MASK", "the config's clean values are registered");
  is_deeply($util->{clean}->($cfgctx, { 'my_zzsens' => 'x', 'other' => 'y' }),
    { 'my_zzsens' => $MASK, 'other' => 'y' }, "the config's clean keys apply");
  is_deeply($cfgclean, { 'keys' => 'zzsens', 'values' => $CANARY{config} },
    "the config's clean block is unchanged");

  # With no clean option at all, the schema defaults still apply.
  my $bare = construct({
    'apikey' => $CANARY{apikey},
    'secret' => $CANARY{secret},
    'headers' => { 'X-Custom-Token' => $CANARY{header} },
    'utility' => { 'fetcher' => sub {
      my (undef, $url, $fetchdef) = @_;
      return $SCENARIOS[1][1]->($url, $fetchdef);
    } },
  });
  ok(defined drive($bare, $target, { 'explain' => {} }, \\@sinks),
    'the 404 fails without a clean option');

  # A feature's name is not a field name: only the sensitive names inside
  # its settings register. An entity block, of per-entity settings or seeded
  # records keyed by entity name and id, is not read at all, and nor are
  # rbac's rules, keyed by entity and operation names.
  my $featured = construct({
    'apikey' => $CANARY{apikey},
    'feature' => {
      'zzsecrets' => { 'active' => 0, 'kind' => 'PLAINSETTING-q8w2e4r6' },
      'zzfeat' => { 'active' => 0, 'apitoken' => 'FEATTOKEN-z9y8x7w6' },
      'rbac' => { 'active' => 0, 'rules' => { 'zztoken.load' => 'PLAINRULE-k7j5h3g1' } },
      'test' => { 'active' => 0, 'entity' => {
        'zztoken' => { 'ZZTOKEN01' => { 'note' => 'PLAINRECORD-t5r3e1w9' } } } },
    },
    'entity' => { 'zztoken' => { 'alias' => { 'zzkey' => 'PLAINALIAS-m2n4b6v8' } } },
  });
  my $fclean = $featured->get_utility()->{clean};
  my $fplain = $fclean->($featured->get_root_ctx(), 'kind PLAINSETTING-q8w2e4r6');
  my $ftoken = $fclean->($featured->get_root_ctx(), 'token FEATTOKEN-z9y8x7w6');
  my $frecord = $fclean->($featured->get_root_ctx(), 'record PLAINRECORD-t5r3e1w9');
  my $falias = $fclean->($featured->get_root_ctx(), 'alias PLAINALIAS-m2n4b6v8');
  my $frule = $fclean->($featured->get_root_ctx(), 'rule PLAINRULE-k7j5h3g1');

  my @leaked = grep { @{ $_->{found} } }
    map { { 'name' => $_->{name}, 'found' => [ leaks($_->{text}) ] } } @sinks;

  note(sprintf('clean: swept %d surface(s), %d leak(s)', scalar(@sinks), scalar(@leaked)));

  is(scalar(@leaked), 0, 'no credential leaves the SDK in any form')
    or diag('credential leaked through: ' . join('; ',
      map { "$_->{name} [" . join(', ', @{ $_->{found} }) . ']' } @leaked));

  # The positive half: the slot the credential travelled in is masked,
  # and an unregistered token in a response header is masked by name.
  my $notfound = $errors{'notfound/throw'};
  ok(Scalar::Util::blessed($notfound) && $notfound->isa('${Name}Error'),
    'the 404 scenario dies with the SDK error');
  is($notfound->{status}, 404, 'the error carries the status');
  unless ($AUTH{suppressed}) {
    my $spec = ref $notfound->{spec} ? $notfound->{spec} : {};
    if ('query' eq $AUTH{where}) {
      is(header($spec->{query}, $AUTH{name}), $MASK, "$AUTH{name} is masked");
    }
    elsif ('cookie' eq $AUTH{where}) {
      my $cookie = header($spec->{headers}, 'cookie');
      $cookie = '' unless defined $cookie;
      ok(index($cookie, $MASK) >= 0, "cookie is masked: $cookie");
    }
    else {
      my $got = header($spec->{headers}, $AUTH{name});
      $got = '' unless defined $got;
      ok(length($got) >= length($MASK) && substr($got, -length($MASK)) eq $MASK,
        "$AUTH{name} is masked: $got");
    }
  }
  is(header($notfound->{spec}{headers}, 'x-custom-token'), $MASK, 'x-custom-token is masked');

  my $coded = $errors{'coded/throw'};
  ok(Scalar::Util::blessed($coded) && $coded->isa('${Name}Error')
    && $coded->{code} eq "denied_$MASK", 'the coded error keeps its code, masked');

  ok(ref $speccopy && !Scalar::Util::blessed($speccopy)
    && Scalar::Util::refaddr($speccopy) != $speclean->{live},
    'a spec cleaned on its own is a plain copy, not the live spec');
  is(header($speccopy->{headers}, 'x-custom-token'), $MASK,
    'x-custom-token is masked in a spec cleaned on its own');

  is($fplain, 'kind PLAINSETTING-q8w2e4r6', "a feature's name does not register its settings");
  is($ftoken, "token $MASK", 'a sensitive setting inside a feature registers');
  is($frecord, 'record PLAINRECORD-t5r3e1w9', 'the records a test entity block seeds do not register');
  is($falias, 'alias PLAINALIAS-m2n4b6v8', 'a per-entity setting does not register');
  is($frule, 'rule PLAINRULE-k7j5h3g1', 'an rbac rule keyed by entity and operation does not register');

  my $explained = $explains{'ok/explain'} || {};
  ok(defined $explained->{result}, 'the explain record carries the result');
  is(header($explained->{result}{headers}, 'x-session-token'), $MASK,
    'x-session-token in the response is masked');
}

# The sweep can see a leak: clean switched off shows the credential.
SKIP: {
  skip 'no operation of this SDK completes against a plain 200; nothing to sweep', 1
    unless defined $target;

  my @sinks;
  my $sdk = make_sdk($SCENARIOS[1], \\@sinks, { 'active' => 0 });
  my $err = drive($sdk, $target, {}, \\@sinks);
  ok(defined $err, 'clean off: the 404 still dies');

  # Explaining a failure must not cost it its error.
  my $explained = drive(make_sdk($SCENARIOS[1], [], { 'active' => 0 }), $target, { 'explain' => {} }, []);
  is(ref $explained ? $explained->{msg} : $explained, $err->{msg}, 'with clean off, explain keeps the error');

  my @leaked = grep { leaks($_->{text}) } @sinks;
  ok(scalar(@leaked) > 0, 'with clean off, the canary shows: the sweep is not blind');

  unless ($AUTH{suppressed}) {
    # With clean off the spec is the live object; the struct's own
    # serialiser prints every field.
    my $text = Voxgig::Struct::stringify($err->{spec});
    my $pair = MIME::Base64::encode_base64("$CANARY{apikey}:$CANARY{secret}", '');
    ok(index($text, $CANARY{apikey}) >= 0 || index($text, $pair) >= 0,
      'the raw spec carries the credential when clean is off');
  }
}

# No body of bytes leaves the SDK in any form.
SKIP: {
  skip 'no operation of this SDK sends a binary body; nothing to sweep', 1
    unless defined $binary;

  my @sinks;
  my (%given, %sent, %errors, %explains, %watch);

  for my $carrier (@CARRIERS) {
    my ($cname, $make) = @$carrier;
    for my $scenario (@SCENARIOS[0 .. 3]) {
      for my $variant (@VARIANTS) {
        my ($vname, $make_ctrl) = @$variant;
        my $key = "$cname/$scenario->[0]/$vname";
        # The transport is where the bytes are meant to arrive, whole.
        my $seen = [ $scenario->[0], sub {
          my ($url, $fetchdef) = @_;
          $sent{$key} = $fetchdef->{body};
          return $scenario->[1]->($url, $fetchdef);
        } ];
        $watch{$key} = ${Name}CleanRequestDataFeature->new(\\@sinks);
        my $sdk = make_sdk($seen, \\@sinks, undef, [ $watch{$key} ]);
        my $ctrl = $make_ctrl->();
        $given{$key} = $make->();
        my $err = drive($sdk, $binary, $ctrl, \\@sinks, { '$body' => $given{$key} });
        $errors{$key} = $err if defined $err;
        $explains{$key} = $ctrl->{explain} if defined $ctrl->{explain};
        push @sinks, forms('sdk', $sdk);
      }
    }
  }

  my @leaked = grep { @{ $_->{found} } }
    map { { 'name' => $_->{name}, 'found' => [ content_leaks($_->{text}) ] } } @sinks;

  note(sprintf('clean: content swept %d surface(s), %d leak(s)', scalar(@sinks), scalar(@leaked)));

  my %named;
  is(scalar(@leaked), 0, 'no body of bytes leaves the SDK in any form')
    or diag('a body of bytes leaked through: ' . join('; ', grep { !$named{$_}++ }
      map { "$_->{name} [" . join(', ', @{ $_->{found} }) . ']' } @leaked));

  # The positive half: where the body was, what describes it now is. A
  # filehandle is read into the spec before the first attempt, so there it
  # is bytes.
  my $desc = { 'binary$' => 'bytes', 'size' => length($CONTENT), 'type' => $binary->{media} };
  my $stream = { 'binary$' => 'stream', 'type' => $binary->{media} };
  for my $carrier (@CARRIERS) {
    my $cname = $carrier->[0];
    my $key = "$cname/notfound/throw";

    # The request itself is untouched: what the transport was handed is the
    # body.
    is($sent{$key}, $CONTENT, "$cname: the transport is handed the body");

    my $failed = $errors{$key};
    ok(Scalar::Util::blessed($failed) && $failed->isa('${Name}Error'),
      "$cname: the 404 scenario dies with the SDK error");
    is_deeply($failed->{spec}{body}, $desc, "$cname: the thrown spec describes the body");
    my $explained = $explains{"$cname/ok/explain"} || {};
    is_deeply($explained->{spec}{body}, $desc, "$cname: the explain record describes the body");
    is_deeply($explained->{fetchdef}{body}, $desc,
      "$cname: the explained fetch definition describes the body");

    # The request data holds what the caller gave: a filehandle is a stream
    # there, and an equal string is the body wherever it sits.
    my $ctx = $watch{$key}{ctx};
    my $body = $given{$key};
    my $live = $ctx->{reqdata}{'$body'};
    my $held = $ctx->{utility}{clean}->($ctx, { 'reqdata' => $ctx->{reqdata}, 'copy' => "$CONTENT" });
    is_deeply($held->{reqdata}{'$body'}, (ref $body ? $stream : $desc),
      "$cname: the request data describes the body");
    is_deeply($held->{copy}, $desc, "$cname: an equal string is described");
    ok((ref $body ? ref $live && Scalar::Util::refaddr($live) == Scalar::Util::refaddr($body)
      : defined $live && !ref $live && $live eq $body), "$cname: the live request data is untouched");
  }
}

# The sweep can see a body: clean switched off shows the bytes.
SKIP: {
  skip 'no operation of this SDK sends a binary body; nothing to sweep', 1
    unless defined $binary;

  for my $carrier (@CARRIERS) {
    my ($cname, $make) = @$carrier;
    my @sinks;
    my $sdk = make_sdk($SCENARIOS[1], \\@sinks, { 'active' => 0 });
    my $err = drive($sdk, $binary, {}, \\@sinks, { '$body' => $make->() });
    ok(defined $err, "$cname: clean off: the 404 still dies");
    my @leaked = grep { content_leaks($_->{text}) } @sinks;
    ok(scalar(@leaked) > 0, "$cname: with clean off, the bytes show: the sweep is not blind");
  }
}

# No response of bytes leaves the SDK in any form.
SKIP: {
  skip 'no operation of this SDK completes against a plain 200; nothing to sweep', 1
    unless defined $target;

  my @sinks;
  my %errors;

  for my $status (200, 404, 500) {
    for my $variant (@VARIANTS) {
      my ($vname, $make_ctrl) = @$variant;
      my $scenario = [ 'bytes', sub { return (unread_response($status, 'audio/wav'), undef) } ];
      my $sdk = make_sdk($scenario, \\@sinks);
      my $err = drive($sdk, $target, $make_ctrl->(), \\@sinks);
      $errors{"$status/$vname"} = $err if defined $err;
      push @sinks, forms('sdk', $sdk);
    }
  }

  my @leaked = grep { @{ $_->{found} } }
    map { { 'name' => $_->{name}, 'found' => [ content_leaks($_->{text}, $RESPONSE) ] } } @sinks;

  note(sprintf('clean: response swept %d surface(s), %d leak(s)', scalar(@sinks), scalar(@leaked)));

  my %named;
  is(scalar(@leaked), 0, 'no response of bytes leaves the SDK in any form')
    or diag('a response of bytes leaked through: ' . join('; ', grep { !$named{$_}++ }
      map { "$_->{name} [" . join(', ', @{ $_->{found} }) . ']' } @leaked));

  # The failure still names what it could not read.
  my $failed = $errors{'200/throw'};
  ok(Scalar::Util::blessed($failed) && $failed->isa('${Name}Error'),
    'a response of bytes fails the operation');
  is(eval { $failed->{code} }, 'response_content_type', 'the failure is a wrong content type');
  like(eval { $failed->{msg} } // '', qr{audio/wav}, 'the failure names the type');
}

# The sweep can see a response: clean switched off shows the bytes.
SKIP: {
  skip 'no operation of this SDK completes against a plain 200; nothing to sweep', 1
    unless defined $target;

  my @sinks;
  my $scenario = [ 'bytes', sub { return (unread_response(200, 'audio/wav'), undef) } ];
  my $err = drive(make_sdk($scenario, \\@sinks, { 'active' => 0 }), $target, {}, \\@sinks);
  ok(defined $err, 'clean off: a response of bytes still fails the operation');
  my @leaked = grep { content_leaks($_->{text}, $RESPONSE) } @sinks;
  ok(scalar(@leaked) > 0, 'with clean off, the response shows: the sweep is not blind');
}

done_testing();
`
}


export {
  TestClean
}
