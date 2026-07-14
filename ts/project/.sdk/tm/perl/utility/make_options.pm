# ProjectName SDK utility: make_options

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));

package ProjectNameUtilities;

our %REGISTRY;

$REGISTRY{make_options} = sub {
  my ($ctx) = @_;
  my $options = $ctx->{options} || {};

  my $custom_utils = ProjectNameHelpers::gp($options, 'utility');
  if (Voxgig::Struct::ismap($custom_utils) && $ctx->{utility}) {
    for my $k (keys %$custom_utils) {
      $ctx->{utility}{custom}{$k} = $custom_utils->{$k};
    }
  }

  my $opts = Voxgig::Struct::clone($options);
  $opts = {} unless Voxgig::Struct::ismap($opts);

  # Feature add-order. options.feature may be given as an ordered ARRAY of
  # { name, active, ...opts } entries (the array position IS the order in
  # which features are added), or as a { name => {opts} } map. Normalize an
  # array to a map (so merge/validate/init are unchanged) and remember the
  # explicit order; a map defaults to test-first so the `test` mock transport
  # is installed as the base of the transport wrapper chain.
  my @featureorder;
  my $feature_raw = ProjectNameHelpers::gp($opts, 'feature');
  if (Voxgig::Struct::islist($feature_raw)) {
    my %fmap;
    for my $entry (@$feature_raw) {
      next unless Voxgig::Struct::ismap($entry);
      my $name = ProjectNameHelpers::gp($entry, 'name');
      next unless defined $name && !ref $name;
      my %fopts = %$entry;
      delete $fopts{name};
      $fmap{$name} = \%fopts;
      push @featureorder, $name;
    }
    $opts->{feature} = \%fmap;
  }

  # Normalize plain-scalar booleans at the known boolean slots so
  # validation sees proper JSON booleans.
  ProjectNameHelpers::coerce_bools($opts);

  my $config = $ctx->{config} || {};
  my $cfgopts = Voxgig::Struct::ismap($config->{options}) ? $config->{options} : {};

  my $JT = Voxgig::Struct::JTRUE();
  my $JF = Voxgig::Struct::JFALSE();

  my $optspec = {
    'apikey' => '',
    'base' => 'http://localhost:8000',
    'prefix' => '',
    'suffix' => '',
    'auth' => { 'prefix' => '' },
    'headers' => { '`$CHILD`' => '`$STRING`' },
    'allow' => {
      'method' => 'GET,PUT,POST,PATCH,DELETE,OPTIONS',
      'op' => 'create,update,load,list,remove,command,direct',
    },
    'entity' => { '`$CHILD`' => { '`$OPEN`' => $JT, 'active' => $JF, 'alias' => {} } },
    'feature' => { '`$CHILD`' => { '`$OPEN`' => $JT, 'active' => $JF } },
    'utility' => {},
    'system' => {},
    'test' => { 'active' => $JF, 'entity' => { '`$OPEN`' => $JT } },
    'clean' => { 'keys' => 'key,token,id' },
  };

  my $sys_fetch = ProjectNameHelpers::gpath($opts, 'system.fetch');

  my $merged = Voxgig::Struct::merge([{}, $cfgopts, $opts]);
  my $validated = Voxgig::Struct::validate($merged, $optspec);
  $opts = Voxgig::Struct::ismap($validated) ? $validated : {};

  if ($sys_fetch) {
    $opts->{system} = {} unless Voxgig::Struct::ismap($opts->{system});
    $opts->{system}{fetch} = $sys_fetch;
  }

  my $clean_keys = ProjectNameHelpers::gpath($opts, 'clean.keys');
  $clean_keys = 'key,token,id' unless defined $clean_keys && !ref $clean_keys;
  my @parts;
  for my $p (split /,/, $clean_keys) {
    $p =~ s/^\s+|\s+$//g;
    push @parts, Voxgig::Struct::escre($p) if '' ne $p;
  }
  my $keyre = join('|', @parts);

  # Resolve the feature add-order: an explicit array order (above) wins;
  # otherwise order the map test-first, then the remaining names sorted, so
  # the outcome is deterministic and `test` is always the base transport.
  if (!@featureorder) {
    my $fmap = ProjectNameHelpers::to_map(
      ProjectNameHelpers::gp($opts, 'feature')) || {};
    my @names = sort keys %$fmap;
    @featureorder = (grep { 'test' eq $_ } @names)
      ? ('test', grep { 'test' ne $_ } @names)
      : @names;
  }

  $opts->{__derived__} = {
    'clean' => ('' eq $keyre ? {} : { 'keyre' => $keyre }),
    'featureorder' => \@featureorder,
  };

  return $opts;
};

1;
