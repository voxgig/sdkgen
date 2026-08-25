# ProjectName SDK cost feature
#
# Cost tracking and spend budget. Uses BOTH seams, which is the point of the
# feature: money is spent per HTTP ATTEMPT (a retried call is charged again,
# because the upstream API charges it again), but it is owed by an
# OPERATION. So the transport wrap prices each attempt, and PreDone
# attributes the running total to "<entity>.<op>" and to the caller (the
# per-call ctrl actor, the same actor the audit feature records).
#
# The price of an attempt comes from the first source that answers: a
# response header ("header" x "perUnit"), the rate table ("rates", keyed
# "<entity>.<op>" / "<op>" / "*"), then the flat "unit". A body figure
# ("path" x "perUnit", e.g. "usage.total_tokens") is read at PreDone
# instead, from the already-parsed result, and describes the whole call, so
# it REPLACES the per-attempt estimate rather than adding to it.
#
# "budget" caps total spend. With "onBudget" => "deny" a further operation
# is refused at PrePoint, before an endpoint is resolved and before anything
# reaches the network.
#
# ORDER MATTERS. Cost must sit INSIDE the cache, or a response served from
# cache is charged for money that was never spent. The default (map) order
# puts cache innermost and cost outside it, so activate them in list form
# with cost first.

use strict;
use warnings;

use File::Basename ();
use Cwd ();
use Scalar::Util ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));
require(Cwd::abs_path("$__dir/base_feature.pm"));

package ProjectNameCostFeature;

our @ISA = ('ProjectNameBaseFeature');

sub new {
  my ($class) = @_;
  my $self = ProjectNameBaseFeature::new($class);
  $self->{version} = '0.0.1';
  $self->{name} = 'cost';
  # Inactive until init (feature_init only fires init when active).
  $self->{active} = 0;
  $self->{client} = undef;
  $self->{options} = {};
  # Keyed by ctx refaddr, same as metrics' start markers.
  $self->{pending} = {};
  $self->{seq} = 0;
  return $self;
}

sub init {
  my ($self, $ctx, $options) = @_;
  $self->{client} = $ctx->{client};
  $self->{options} = Voxgig::Struct::ismap($options) ? $options : {};
  $self->{active} = ProjectNameHelpers::is_true($self->{options}{active});
  $self->{pending} = {};
  $self->{seq} = 0;

  my $limit = $self->_limit;

  if (!$self->{client}{_cost}) {
    $self->{client}{_cost} = {
      'currency' => defined $self->{options}{currency} ? $self->{options}{currency} : 'USD',
      'total' => {
        'calls' => 0, 'attempts' => 0,
        'amount' => 0, 'reported' => 0, 'estimated' => 0,
      },
      'ops' => {},
      'actors' => {},
      'budget' => {
        'limit' => $limit, 'spent' => 0,
        'remaining' => $limit, 'exceeded' => 0,
      },
      'last' => undef,
    };
  }

  return unless $self->{active};

  my $feature = $self;
  my $utility = $ctx->{utility};
  my $inner = $utility->{fetcher};

  $utility->{fetcher} = sub {
    my ($fctx, $fullurl, $fetchdef) = @_;
    return $feature->charge($fctx, $fullurl, $fetchdef, $inner);
  };
  return;
}

# The budget gate. Runs before endpoint resolution, so a refused call costs
# nothing at all.
sub PrePoint {
  my ($self, $ctx) = @_;
  return unless $self->{active};
  my $limit = $self->_limit;
  return if $limit <= 0;

  my $cost = $self->{client}{_cost};
  return unless $cost;
  return if $cost->{total}{amount} < $limit;

  $cost->{budget}{exceeded} = 1;

  my $on = defined $self->{options}{onBudget} ? $self->{options}{onBudget} : 'warn';
  return unless 'deny' eq $on;

  my $err = $ctx->make_error('cost_budget',
    'Cost budget of ' . $self->_numstr($limit) . ' ' . $cost->{currency}
    . ' is spent (' . $self->_numstr($cost->{total}{amount}) . ' '
    . $cost->{currency} . ' used)');

  # Short-circuit endpoint resolution; the pipeline surfaces this error.
  $ctx->{out}{point} = $err;
  return;
}

sub charge {
  my ($self, $ctx, $url, $fetchdef, $inner) = @_;

  my ($res, $err) = $inner->($ctx, $url, $fetchdef);

  my ($amount, $source) = $self->_price($ctx, $res);

  my $addr = Scalar::Util::refaddr($ctx);
  my $entry = $self->{pending}{$addr};
  if (!$entry) {
    $entry = { 'attempts' => 0, 'amount' => 0, 'source' => 'none' };
    $self->{pending}{$addr} = $entry;
  }

  $entry->{attempts} += 1;

  # Accumulated here, committed once at PreDone. Adding each attempt to the
  # running total and then subtracting it again when a body figure
  # supersedes it loses precision to catastrophic cancellation.
  $entry->{amount} += $amount;
  $entry->{source} = $source;

  my $cost = $self->{client}{_cost};
  $cost->{total}{attempts} += 1 if $cost;

  return ($res, $err);
}

# Attribute the operation's spend once the call is finished.
sub PreDone {
  my ($self, $ctx) = @_;
  return unless $self->{active};
  my $addr = Scalar::Util::refaddr($ctx);
  return unless exists $self->{pending}{$addr};
  my $entry = delete $self->{pending}{$addr};

  my $cost = $self->{client}{_cost};
  return unless $cost;

  my $amount = $entry->{amount};
  my $source = $entry->{source};

  # A body figure prices the whole call, so it replaces the per-attempt
  # estimate rather than adding to it.
  my $body = $self->_body($ctx);
  if (defined $body) {
    $amount = $body;
    $source = 'body';
  }

  $self->_spend($cost, $amount, $source);

  my $entity = ($ctx->{op} && defined $ctx->{op}{entity} && '' ne $ctx->{op}{entity})
    ? $ctx->{op}{entity} : '_';
  my $opname = ($ctx->{op} && defined $ctx->{op}{name} && '' ne $ctx->{op}{name})
    ? $ctx->{op}{name} : '_';
  my $actor = $self->_actor($ctx);

  $cost->{total}{calls} += 1;
  $self->_bump($cost->{ops}, "$entity.$opname", $amount);
  $self->_bump($cost->{actors}, $actor, $amount);

  $self->{seq} += 1;
  my $record = {
    'seq' => $self->{seq},
    'entity' => $entity,
    'op' => $opname,
    'actor' => $actor,
    'amount' => $amount,
    'currency' => $cost->{currency},
    'source' => $source,
    'attempts' => $entry->{attempts},
  };
  $cost->{last} = $record;

  my $sink = $self->{options}{sink};
  if (ref $sink eq 'CODE') {
    # A failing sink must never take down the call.
    eval { $sink->($record) };
  }
  return;
}

# Price one attempt: a reported header figure, else the rate table, else the
# flat unit.
sub _price {
  my ($self, $ctx, $res) = @_;

  my $header = $self->{options}{header};
  if (defined $header && '' ne $header) {
    my $val = $self->_header($res, $header);
    return ($val * $self->_per_unit, 'header') if defined $val;
  }

  my $rate = $self->_rate($ctx);
  return ($rate, 'table') if defined $rate;

  my $unit = $self->{options}{unit};
  return ($unit, 'unit')
    if defined $unit && !ref($unit) && Scalar::Util::looks_like_number($unit) && 0 != $unit;

  return (0, 'none');
}

# The rate table uses the same lookup grammar as rbac's rules:
# "<entity>.<op>", then "<op>", then "*".
sub _rate {
  my ($self, $ctx) = @_;
  my $rates = $self->{options}{rates};
  return undef unless Voxgig::Struct::ismap($rates);

  my $entity = '';
  if ($ctx->{entity} && defined $ctx->{entity}{name}) {
    $entity = $ctx->{entity}{name};
  }
  elsif ($ctx->{op} && defined $ctx->{op}{entity}) {
    $entity = $ctx->{op}{entity};
  }
  my $opname = ($ctx->{op} && defined $ctx->{op}{name}) ? $ctx->{op}{name} : '';

  for my $key ("$entity.$opname", $opname, '*') {
    my $val = $rates->{$key};
    return $val
      if defined $val && !ref($val) && Scalar::Util::looks_like_number($val);
  }
  return undef;
}

# A usage figure from the parsed result body, priced by perUnit. Read here,
# not at the transport seam, because the body is one-shot.
sub _body {
  my ($self, $ctx) = @_;
  my $path = $self->{options}{path};
  return undef unless defined $path && '' ne $path;
  return undef unless $ctx->{result} && defined $ctx->{result}{body};

  my $val = Voxgig::Struct::getpath($ctx->{result}{body}, $path);
  my $num = $self->_num($val);
  return undef unless defined $num;
  return $num * $self->_per_unit;
}

sub _spend {
  my ($self, $cost, $amount, $source) = @_;
  $cost->{total}{amount} += $amount;
  if ('header' eq $source || 'body' eq $source) {
    $cost->{total}{reported} += $amount;
  }
  else {
    $cost->{total}{estimated} += $amount;
  }

  my $limit = $cost->{budget}{limit};
  $cost->{budget}{spent} = $cost->{total}{amount};
  if ($limit > 0) {
    my $rem = $limit - $cost->{total}{amount};
    $cost->{budget}{remaining} = $rem > 0 ? $rem : 0;
    $cost->{budget}{exceeded} = 1 if $cost->{total}{amount} >= $limit;
  }
  else {
    $cost->{budget}{remaining} = 0;
  }
  return;
}

sub _bump {
  my ($self, $bucket, $key, $amount) = @_;
  my $entry = $bucket->{$key};
  if (!$entry) {
    $entry = { 'calls' => 0, 'amount' => 0 };
    $bucket->{$key} = $entry;
  }
  $entry->{calls} += 1;
  $entry->{amount} += $amount;
  return;
}

sub _header {
  my ($self, $res, $name) = @_;
  return undef unless Voxgig::Struct::ismap($res);
  my $headers = $res->{headers};
  return undef unless Voxgig::Struct::ismap($headers);
  my $lower = lc($name);
  for my $key (keys %$headers) {
    return $self->_num($headers->{$key}) if lc("$key") eq $lower;
  }
  return undef;
}

sub _num {
  my ($self, $val) = @_;
  return undef unless defined $val;
  return undef if ref $val;
  return 0 + $val if Scalar::Util::looks_like_number($val);
  return undef;
}

sub _actor {
  my ($self, $ctx) = @_;
  if ($ctx->{ctrl} && defined $ctx->{ctrl}{actor}) {
    return $ctx->{ctrl}{actor};
  }
  return defined $self->{options}{actor} ? $self->{options}{actor} : 'anonymous';
}

sub _per_unit {
  my ($self) = @_;
  my $per = $self->{options}{perUnit};
  return (defined $per && !ref($per) && Scalar::Util::looks_like_number($per)) ? $per : 0;
}

sub _limit {
  my ($self) = @_;
  my $budget = $self->{options}{budget};
  return (defined $budget && !ref($budget) && Scalar::Util::looks_like_number($budget))
    ? $budget : 0;
}

# Render a money amount without an exponent or trailing zeros.
sub _numstr {
  my ($self, $n) = @_;
  my $s = sprintf('%.10f', $n);
  $s =~ s/0+$//;
  $s =~ s/\.$//;
  return '' eq $s ? '0' : $s;
}

1;
