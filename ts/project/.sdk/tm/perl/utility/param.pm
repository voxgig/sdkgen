# ProjectName SDK utility: param

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

$REGISTRY{param} = sub {
  my ($ctx, $paramdef) = @_;
  my $point = $ctx->{point};
  my $spec = $ctx->{spec};
  my $match_val = $ctx->{match};
  my $reqmatch = $ctx->{reqmatch};
  my $data = $ctx->{data};
  my $reqdata = $ctx->{reqdata};

  my $pt = Voxgig::Struct::typify($paramdef);
  my $key;
  if (($pt & Voxgig::Struct::T_string()) > 0) {
    $key = $paramdef;
  }
  else {
    my $k = ProjectNameHelpers::gp($paramdef, 'name');
    $key = (defined $k && !ref $k) ? $k : '';
  }

  my $akey = '';
  if ($point) {
    my $alias_map = ProjectNameHelpers::to_map(ProjectNameHelpers::gp($point, 'alias'));
    if ($alias_map) {
      my $ak = ProjectNameHelpers::gp($alias_map, $key);
      $akey = $ak if defined $ak && !ref $ak;
    }
  }

  my $val = ProjectNameHelpers::gp($reqmatch, $key);
  $val = ProjectNameHelpers::gp($match_val, $key) if !defined $val;

  if (!defined $val && '' ne $akey) {
    $spec->{alias}{$akey} = $key if $spec;
    $val = ProjectNameHelpers::gp($reqmatch, $akey);
  }

  $val = ProjectNameHelpers::gp($reqdata, $key) if !defined $val;
  $val = ProjectNameHelpers::gp($data, $key) if !defined $val;

  if (!defined $val && '' ne $akey) {
    $val = ProjectNameHelpers::gp($reqdata, $akey);
    $val = ProjectNameHelpers::gp($data, $akey) if !defined $val;
  }

  return $val;
};

# The arguments a point declares in one location, query or header, each with
# the name it travels under and the value this call passes in its match or
# else its data. Unlike a path parameter, the entity's stored match and data
# never supply one.
sub call_args {
  my ($ctx, $kind) = @_;
  my $defs = $ctx->{point} ? ProjectNameHelpers::gpath($ctx->{point}, "args.$kind") : undef;
  return () unless Voxgig::Struct::islist($defs);
  my @out;
  for my $ad (@$defs) {
    my $name = ProjectNameHelpers::gp($ad, 'name');
    next unless defined $name && !ref $name && '' ne $name;
    my $wire = ProjectNameHelpers::gp($ad, 'orig');
    $wire = $name unless defined $wire && !ref $wire && '' ne $wire;
    my $val = ProjectNameHelpers::gp($ctx->{reqmatch} || {}, $name);
    $val = ProjectNameHelpers::gp($ctx->{reqdata} || {}, $name) unless defined $val;
    push @out, [$name, $wire, $val];
  }
  return @out;
}

1;
