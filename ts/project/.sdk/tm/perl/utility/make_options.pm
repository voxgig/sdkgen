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
  $opts->{__derived__} = { 'clean' => ('' eq $keyre ? {} : { 'keyre' => $keyre }) };

  return $opts;
};

1;
