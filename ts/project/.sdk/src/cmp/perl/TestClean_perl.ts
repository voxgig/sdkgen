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
// the SDK is searched for the canaries and their encoded forms. It also
// proves its own sensitivity: with clean switched off the canary MUST show.
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
# the SDK is searched for the canaries and their encoded forms. It also
# proves its own sensitivity: with clean switched off the canary MUST show.

use strict;
use warnings;
use Test::More;
use FindBin;
use lib "$FindBin::Bin/../lib";
use Scalar::Util ();
use MIME::Base64 ();
use Data::Dumper ();
use JSON::PP ();

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

# A feature that dies from inside the pipeline, quoting the request it saw:
# an error make_error never handled.
{
  package ${Name}CleanThrowFeature;
  our @ISA = ('${Name}BaseFeature');

  sub new {
    my ($class) = @_;
    my $self = ${Name}BaseFeature::new($class);
    $self->{name} = 'throwhook';
    $self->{version} = '0.0.1';
    $self->{active} = 1;
    return $self;
  }

  sub PreResponse {
    my ($s, $ctx) = @_;
    die 'hook saw ' . $JSON->encode({ %{ $ctx->{spec} } });
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

sub make_sdk {
  my ($scenario, $sinks, $cleanopts, $extra) = @_;
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
  return ${Name}SDK->new({
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
  });
}

# The first operation that completes against a plain 200: with no
# arguments, else with every path parameter its points declare filled in.
# An entity accessor is a capitalised client method whose result answers
# get_name, as the feature corpus runner finds them.
sub usable_op {
  my $plain = ${Name}SDK->new({
    'apikey' => $CANARY{apikey},
    'utility' => { 'fetcher' => sub { return (response(200, { 'id' => 'i1' }), undef) } },
  });

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

  my $entities = ${Name}Config::shared_config()->{entity} || {};
  for my $entname (sort keys %found) {
    my $accessor = $found{$entname};
    for my $op (qw(list load create update remove)) {
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

sub drive {
  my ($sdk, $target, $ctrl, $sinks) = @_;
  my ($acc, $op) = ($target->{accessor}, $target->{op});
  my $out;
  my $ok = eval { $out = $sdk->$acc()->$op({ %{ $target->{match} } }, $ctrl); 1 };
  my $err = $ok ? undef : $@;
  push @$sinks, forms('error', $err) if defined $err;
  push @$sinks, forms('result', $out) if defined $out;
  push @$sinks, forms('explain', $ctrl->{explain}) if defined $ctrl->{explain};
  return $err;
}


my $target = usable_op();
plan skip_all => 'no operation of this SDK completes against a plain 200; nothing to sweep'
  unless defined $target;

{
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

  # A credential mistyped as a map is rejected by validation, whose message
  # quotes the value it rejected.
  my $rejected;
  eval {
    ${Name}SDK->new({
      'apikey' => { 'value' => $CANARY{apikey} },
      'clean' => { 'values' => $CANARY{value} },
    });
    1;
  } or $rejected = $@;
  ok(defined $rejected, 'a credential mistyped as a map is rejected');
  push @sinks, forms('rejected', $rejected) if defined $rejected;

  # An error a feature hook dies with, quoting the request, skips make_error.
  my $hooked = make_sdk($SCENARIOS[0], \\@sinks, undef, [ ${Name}CleanThrowFeature->new ]);
  ok(defined drive($hooked, $target, {}, \\@sinks), 'the throwing hook fails the operation');

  # A registered value used as a property name is masked; names that mask
  # alike are all kept.
  my $named = $hooked->get_utility()->{clean}->($hooked->get_root_ctx(),
    { $CANARY{header} => 1, $CANARY{value} => 2, 'plain' => 3 });
  is_deeply($named, { $MASK => 1, "$MASK#1" => 2, 'plain' => 3 },
    'a registered value used as a property name is masked, collisions kept');
  push @sinks, forms('named', $named);

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

  my $explained = $explains{'ok/explain'} || {};
  ok(defined $explained->{result}, 'the explain record carries the result');
  is(header($explained->{result}{headers}, 'x-session-token'), $MASK,
    'x-session-token in the response is masked');
}

# The sweep can see a leak: clean switched off shows the credential.
{
  my @sinks;
  my $sdk = make_sdk($SCENARIOS[1], \\@sinks, { 'active' => 0 });
  my $err = drive($sdk, $target, {}, \\@sinks);
  ok(defined $err, 'clean off: the 404 still dies');

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

done_testing();
`
}


export {
  TestClean
}
